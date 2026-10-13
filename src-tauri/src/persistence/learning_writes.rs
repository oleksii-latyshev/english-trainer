use super::*;
use crate::learning::{mistake_normalized_key, LearningStatus, MS_PER_DAY};
use crate::providers::{FocusCategory, TurnFeedback};

impl SessionDatabase {
    pub fn save_turn_feedback(
        &mut self,
        session_id: u64,
        sequence: usize,
        feedback: &TurnFeedback,
    ) -> rusqlite::Result<()> {
        let sql_session_id = to_sql_id(session_id)?;
        let sql_sequence = to_sql_sequence(sequence)?;
        let encoded = serde_json::to_string(feedback)
            .map_err(|error| rusqlite::Error::ToSqlConversionFailure(Box::new(error)))?;
        let now = now_ms();

        let is_voice = self.is_voice_turn(session_id, sequence)?;
        let transaction = self.connection.transaction()?;
        let prior_feedback: Option<TurnFeedback> = transaction
            .query_row(
                "SELECT feedback_json FROM turn_feedback WHERE session_id = ?1 AND sequence = ?2",
                params![sql_session_id, sql_sequence],
                |row| {
                    let json: String = row.get(0)?;
                    serde_json::from_str(&json).map_err(|error| {
                        rusqlite::Error::FromSqlConversionFailure(
                            0,
                            rusqlite::types::Type::Text,
                            Box::new(error),
                        )
                    })
                },
            )
            .optional()?;
        if prior_feedback.as_ref() == Some(feedback) {
            transaction.commit()?;
            return Ok(());
        }

        let (turn_time, transcript): (i64, String) = transaction.query_row(
            "SELECT created_at, user_transcript FROM turns WHERE session_id = ?1 AND sequence = ?2",
            params![sql_session_id, sql_sequence],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )?;
        transaction.execute(
            "INSERT INTO turn_feedback (session_id, sequence, feedback_json) VALUES (?1, ?2, ?3) ON CONFLICT(session_id, sequence) DO UPDATE SET feedback_json = excluded.feedback_json",
            params![sql_session_id, sql_sequence, encoded],
        )?;

        let existing_occurrence: Option<i64> = transaction
            .query_row(
                "SELECT mistake_id FROM mistake_occurrences WHERE session_id = ?1 AND sequence = ?2",
                params![sql_session_id, sql_sequence],
                |row| row.get(0),
            )
            .optional()?;

        let session_mode: String = transaction.query_row(
            "SELECT mode FROM sessions WHERE id = ?1",
            params![sql_session_id],
            |row| row.get(0),
        )?;

        let mut reused_same_observation = false;
        let mut had_feedback_relapse = false;
        if let Some(focus) = feedback.focus_feedback.first() {
            let normalized_key = mistake_normalized_key(&focus.category, &focus.improved);
            let category_str = match focus.category {
                FocusCategory::Grammar => "grammar",
                FocusCategory::Vocabulary => "vocabulary",
                FocusCategory::Coherence => "coherence",
                FocusCategory::Interaction => "interaction",
            };

            if let Some(linked_mistake_id) = existing_occurrence {
                let existing_key: String = transaction.query_row(
                    "SELECT normalized_key FROM mistakes WHERE id = ?1",
                    params![linked_mistake_id],
                    |row| row.get(0),
                )?;
                if existing_key == normalized_key {
                    reused_same_observation = true;
                    had_feedback_relapse = transaction.query_row(
                        "SELECT EXISTS(SELECT 1 FROM learning_usage_events
                         WHERE session_id = ?1 AND sequence = ?2 AND item_type = 'mistake'
                           AND item_id = ?3 AND origin = 'feedback')",
                        params![sql_session_id, sql_sequence, linked_mistake_id],
                        |row| row.get(0),
                    )?;
                    transaction.execute(
                        "DELETE FROM learning_usage_events WHERE session_id = ?1 AND sequence = ?2
                         AND item_type = 'mistake' AND item_id = ?3 AND origin = 'feedback'",
                        params![sql_session_id, sql_sequence, linked_mistake_id],
                    )?;
                    reproject_mistake(&transaction, linked_mistake_id, None)?;
                } else {
                    // A changed correction detaches this turn's old observation and relapse.
                    detach_observation(
                        &transaction,
                        sql_session_id,
                        sql_sequence,
                        linked_mistake_id,
                    )?;
                }
            }

            let existing_mistake: Option<i64> = transaction
                .query_row(
                    "SELECT id FROM mistakes WHERE normalized_key = ?1",
                    params![normalized_key],
                    |row| row.get(0),
                )
                .optional()?;

            let mistake_id = if let Some(id) = existing_mistake {
                let status_str: String = transaction.query_row(
                    "SELECT status FROM mistakes WHERE id = ?1",
                    params![id],
                    |row| row.get(0),
                )?;

                let prior_feedback_relapse = reused_same_observation && had_feedback_relapse;
                let grounded_original =
                    !focus.original.trim().is_empty() && transcript.contains(&focus.original);
                if session_mode == "conversation"
                    && is_voice
                    && status_str != "archived"
                    && (status_str == "stable" || prior_feedback_relapse)
                    && grounded_original
                {
                    transaction.execute(
                        "UPDATE mistakes SET times_seen = times_seen + ?1, last_seen_at = ?2 WHERE id = ?3",
                        params![i64::from(!reused_same_observation), now, id],
                    )?;
                    transaction.execute(
                        "INSERT INTO learning_usage_events (item_type, item_id, session_id, sequence, origin, original_turn_time, outcome, exact_excerpt, confidence, created_at)
                         VALUES ('mistake', ?1, ?2, ?3, 'feedback', ?4, 'incorrect', ?5, 1.0, ?6)
                         ON CONFLICT(session_id, sequence, item_type, item_id, origin) DO NOTHING",
                        params![id, sql_session_id, sql_sequence, turn_time, focus.original, now],
                    )?;
                    reproject_mistake(&transaction, id, Some(turn_time))?;
                } else {
                    transaction.execute(
                        "UPDATE mistakes SET times_seen = times_seen + ?1, last_seen_at = ?2, status = CASE WHEN status = 'archived' THEN 'new' ELSE status END WHERE id = ?3",
                        params![i64::from(!reused_same_observation), now, id],
                    )?;
                }
                id
            } else {
                let next_review = now + MS_PER_DAY;
                transaction.execute(
                    "INSERT INTO mistakes (
                        normalized_key, category, original_example, corrected_example,
                        explanation, times_seen, times_correct_afterwards,
                        last_seen_at, next_review_at, interval_days, ease_factor, status
                    ) VALUES (?1, ?2, ?3, ?4, ?5, 1, 0, ?6, ?7, 1, 2.5, 'new')",
                    params![
                        normalized_key,
                        category_str,
                        focus.original,
                        focus.improved,
                        focus.explanation,
                        now,
                        next_review
                    ],
                )?;
                transaction.last_insert_rowid()
            };

            transaction.execute(
                "INSERT INTO mistake_occurrences (mistake_id, session_id, sequence, created_at)
                 VALUES (?1, ?2, ?3, ?4)
                 ON CONFLICT(session_id, sequence) DO UPDATE SET mistake_id = excluded.mistake_id, created_at = excluded.created_at",
                params![mistake_id, sql_session_id, sql_sequence, now],
            )?;
        } else if let Some(linked_mistake_id) = existing_occurrence {
            // A new review with no correction replaces the old feedback for this turn.
            detach_observation(
                &transaction,
                sql_session_id,
                sql_sequence,
                linked_mistake_id,
            )?;
        }

        transaction.commit()
    }
}

fn detach_observation(
    transaction: &rusqlite::Transaction<'_>,
    session_id: i64,
    sequence: i64,
    mistake_id: i64,
) -> rusqlite::Result<()> {
    transaction.execute(
        "DELETE FROM mistake_occurrences WHERE session_id = ?1 AND sequence = ?2",
        params![session_id, sequence],
    )?;
    transaction.execute(
        "DELETE FROM learning_usage_events WHERE session_id = ?1 AND sequence = ?2 AND item_type = 'mistake' AND item_id = ?3 AND origin = 'feedback'",
        params![session_id, sequence, mistake_id],
    )?;
    let remaining: i64 = transaction.query_row(
        "SELECT COUNT(*) FROM mistake_occurrences WHERE mistake_id = ?1",
        params![mistake_id],
        |row| row.get(0),
    )?;
    reproject_mistake(transaction, mistake_id, None)?;
    if remaining == 0 {
        transaction.execute(
            "UPDATE mistakes SET times_seen = 0, status = 'archived' WHERE id = ?1",
            params![mistake_id],
        )?;
    } else {
        transaction.execute(
            "UPDATE mistakes SET times_seen = ?1 WHERE id = ?2",
            params![remaining, mistake_id],
        )?;
    }
    Ok(())
}

fn reproject_mistake(
    transaction: &rusqlite::Transaction<'_>,
    mistake_id: i64,
    relapse_time: Option<i64>,
) -> rusqlite::Result<()> {
    let all_events = learning_usage::load_item_events(
        transaction,
        crate::learning::LearningItemType::Mistake,
        mistake_id as u64,
    )?;
    let (status_str, interval, next_rev): (String, u32, i64) = transaction.query_row(
        "SELECT status, interval_days, next_review_at FROM mistakes WHERE id = ?1",
        params![mistake_id],
        |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
    )?;
    let status = LearningStatus::parse(&status_str).unwrap_or(LearningStatus::New);
    let projected = crate::learning::project_mastery_state(status, &all_events, interval, next_rev);
    transaction.execute(
        "UPDATE mistakes SET status = ?1, interval_days = ?2, next_review_at = ?3,
         times_correct_afterwards = ?4 WHERE id = ?5",
        params![
            projected.status.as_str(),
            relapse_time.map(|_| 1).unwrap_or(interval),
            relapse_time.unwrap_or(next_rev),
            learning_usage::counter_baseline(transaction, mistake_id)?
                + projected.lifetime_distinct_sessions as i64,
            mistake_id
        ],
    )?;
    Ok(())
}
