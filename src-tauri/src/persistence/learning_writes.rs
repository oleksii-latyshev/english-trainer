use super::*;
use crate::learning::{
    mistake_normalized_key, normalize_phrase, LearningStatus, PhraseCardRecord, MS_PER_DAY,
};
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

        let transaction = self.connection.transaction()?;
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
                    // Idempotent: saving the same turn again does not double count
                    transaction.commit()?;
                    return Ok(());
                }
                // A turn contributes at most one observation. If its feedback changes,
                // detach the old observation before linking the replacement correction.
                detach_observation(
                    &transaction,
                    sql_session_id,
                    sql_sequence,
                    linked_mistake_id,
                )?;
            }

            let existing_mistake: Option<i64> = transaction
                .query_row(
                    "SELECT id FROM mistakes WHERE normalized_key = ?1",
                    params![normalized_key],
                    |row| row.get(0),
                )
                .optional()?;

            let mistake_id = if let Some(id) = existing_mistake {
                // Later distinct turn with the same mistake increments observation count
                transaction.execute(
                    "UPDATE mistakes SET times_seen = times_seen + 1, last_seen_at = ?1, status = CASE WHEN status = 'archived' THEN 'new' ELSE status END WHERE id = ?2",
                    params![now, id],
                )?;
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

    pub fn save_phrase_card(
        &mut self,
        phrase: &str,
        meaning_or_note: &str,
        session_id: Option<u64>,
        sequence: Option<usize>,
    ) -> rusqlite::Result<PhraseCardRecord> {
        let normalized = normalize_phrase(phrase);
        if normalized.is_empty() {
            return Err(rusqlite::Error::InvalidParameterName(
                "phrase must contain at least one letter or number".into(),
            ));
        }
        if session_id.is_some() != sequence.is_some() {
            return Err(rusqlite::Error::InvalidParameterName(
                "phrase provenance requires both session_id and sequence".into(),
            ));
        }
        let now = now_ms();

        // Check for deduplication
        let existing: Option<PhraseCardRecord> = self
            .connection
            .query_row(
                "SELECT id, phrase, normalized_phrase, meaning_or_note, session_id, sequence,
                        created_at, last_reviewed_at, next_review_at, interval_days, ease_factor, status
                 FROM phrase_cards WHERE normalized_phrase = ?1",
                params![normalized],
                |row| {
                    let next_review: i64 = row.get(8)?;
                    let status_str: String = row.get(11)?;
                    Ok(PhraseCardRecord {
                        id: row.get::<_, i64>(0)? as u64,
                        phrase: row.get(1)?,
                        normalized_phrase: row.get(2)?,
                        meaning_or_note: row.get(3)?,
                        session_id: row.get::<_, Option<i64>>(4)?.map(|id| id as u64),
                        sequence: row.get::<_, Option<i64>>(5)?.map(|s| s as usize),
                        created_at: row.get(6)?,
                        last_reviewed_at: row.get(7)?,
                        next_review_at: next_review,
                        interval_days: row.get(9)?,
                        ease_factor: row.get(10)?,
                        status: LearningStatus::parse(&status_str).unwrap_or(LearningStatus::Learning),
                        is_due: status_str != "archived" && next_review <= now,
                    })
                },
            )
            .optional()?;

        if let Some(card) = existing {
            return Ok(card);
        }

        let sql_session_id = session_id.map(to_sql_id).transpose()?;
        let sql_sequence = sequence.map(to_sql_sequence).transpose()?;
        let next_review = now + MS_PER_DAY;

        self.connection.execute(
            "INSERT INTO phrase_cards (
                phrase, normalized_phrase, meaning_or_note, session_id, sequence,
                created_at, next_review_at, interval_days, ease_factor, status
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 1, 2.5, 'learning')",
            params![
                phrase,
                normalized,
                meaning_or_note,
                sql_session_id,
                sql_sequence,
                now,
                next_review
            ],
        )?;

        let id = self.connection.last_insert_rowid() as u64;
        Ok(PhraseCardRecord {
            id,
            phrase: phrase.to_string(),
            normalized_phrase: normalized,
            meaning_or_note: meaning_or_note.to_string(),
            session_id,
            sequence,
            created_at: now,
            last_reviewed_at: None,
            next_review_at: next_review,
            interval_days: 1,
            ease_factor: 2.5,
            status: LearningStatus::Learning,
            is_due: false,
        })
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
    let remaining: i64 = transaction.query_row(
        "SELECT COUNT(*) FROM mistake_occurrences WHERE mistake_id = ?1",
        params![mistake_id],
        |row| row.get(0),
    )?;
    transaction.execute(
        "UPDATE mistakes SET times_seen = ?1, status = CASE WHEN ?1 = 0 THEN 'archived' ELSE status END WHERE id = ?2",
        params![remaining, mistake_id],
    )?;
    Ok(())
}
