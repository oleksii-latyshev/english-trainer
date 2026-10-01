use super::super::{to_sql_id, to_sql_sequence, SessionDatabase};
use super::ledger::{candidate_key, counter_baseline, load_item_events, now_ms};
use super::UsageAssessmentCommit;
use crate::learning::{
    contains_normalized_words, project_mastery_state, LearningItemType, LearningStatus,
    TurnUsageAssessment, UsageOutcome, MAX_EXCERPT_CHARS, MIN_CONFIDENCE,
};
use rusqlite::{params, OptionalExtension};

impl SessionDatabase {
    pub fn save_turn_usage_assessment(
        &mut self,
        commit: UsageAssessmentCommit<'_>,
    ) -> rusqlite::Result<Option<TurnUsageAssessment>> {
        let UsageAssessmentCommit {
            session_id,
            sequence,
            request,
            turn_time,
            mut assessment,
            events,
            active_session_id,
        } = commit;
        let sql_sid = to_sql_id(session_id)?;
        let sql_seq = to_sql_sequence(sequence)?;
        let transaction = self.connection.transaction()?;

        let saved_json: Option<String> = transaction
            .query_row(
                "SELECT assessment_json FROM turn_usage_assessments WHERE session_id = ?1 AND sequence = ?2",
                params![sql_sid, sql_seq],
                |row| row.get(0),
            )
            .optional()?;
        if let Some(json) = saved_json {
            let saved = serde_json::from_str(&json).map_err(|error| {
                rusqlite::Error::FromSqlConversionFailure(
                    0,
                    rusqlite::types::Type::Text,
                    Box::new(error),
                )
            })?;
            return Ok(Some(saved));
        }

        let saved_turn: Option<(String, i64, String, i64)> = transaction
            .query_row(
                "SELECT t.user_transcript, t.created_at, s.mode, s.started_at
             FROM turns t JOIN sessions s ON s.id = t.session_id
             WHERE t.session_id = ?1 AND t.sequence = ?2",
                params![sql_sid, sql_seq],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
            )
            .optional()?;
        let Some((transcript, stored_time, mode, started_at)) = saved_turn else {
            return Ok(None);
        };
        if transcript != request.transcript || stored_time != turn_time || mode != "conversation" {
            return Ok(None);
        }
        let current = super::prepare_usage_review_on(&transaction, session_id, sequence)?;
        let Some(current) = current else {
            return Ok(None);
        };
        if !current.is_conversation || current.turn_time != turn_time || current.request != *request
        {
            return Ok(None);
        }

        for candidate in &request.candidates {
            let (item_type, item_id) = candidate_key(candidate.item_type, candidate.item_id)?;
            let is_still_eligible: bool = match candidate.item_type {
                LearningItemType::Mistake => transaction.query_row(
                    "SELECT EXISTS(
                        SELECT 1 FROM mistakes m WHERE m.id = ?1 AND m.corrected_example = ?2
                          AND m.original_example = ?3 AND m.status != 'archived'
                          AND EXISTS (SELECT 1 FROM mistake_occurrences o WHERE o.mistake_id = m.id
                            AND o.session_id != ?4 AND o.created_at < ?5)
                    )",
                    params![
                        item_id,
                        candidate.target,
                        candidate.cue,
                        sql_sid,
                        started_at
                    ],
                    |row| row.get(0),
                )?,
                LearningItemType::Phrase => transaction.query_row(
                    "SELECT EXISTS(
                        SELECT 1 FROM phrase_cards p WHERE p.id = ?1 AND p.phrase = ?2
                          AND p.meaning_or_note = ?3 AND p.status != 'archived'
                          AND p.created_at < ?4 AND (p.session_id IS NULL OR p.session_id != ?5)
                    )",
                    params![
                        item_id,
                        candidate.target,
                        candidate.cue,
                        started_at,
                        sql_sid
                    ],
                    |row| row.get(0),
                )?,
            };
            let exposed: i64 = transaction.query_row(
                "SELECT COUNT(*) FROM session_cue_exposures WHERE session_id = ?1
                 AND exposed_at <= ?2 AND ((item_type IS NULL AND item_id IS NULL)
                   OR (item_type = ?3 AND item_id = ?4))",
                params![sql_sid, turn_time, item_type, item_id],
                |row| row.get(0),
            )?;
            if !is_still_eligible || exposed > 0 {
                return Ok(None);
            }
        }

        let inserted = transaction.execute(
            "INSERT INTO turn_usage_assessments (session_id, sequence, assessed_at, assessment_json)
             VALUES (?1, ?2, ?3, '{}') ON CONFLICT(session_id, sequence) DO NOTHING",
            params![sql_sid, sql_seq, assessment.assessed_at],
        )?;
        if inserted == 0 {
            let saved: String = transaction.query_row(
                "SELECT assessment_json FROM turn_usage_assessments WHERE session_id = ?1 AND sequence = ?2",
                params![sql_sid, sql_seq],
                |row| row.get(0),
            )?;
            let saved = serde_json::from_str(&saved).map_err(|error| {
                rusqlite::Error::FromSqlConversionFailure(
                    0,
                    rusqlite::types::Type::Text,
                    Box::new(error),
                )
            })?;
            return Ok(Some(saved));
        }

        for event in events {
            let (type_str, sql_item_id) = candidate_key(event.item_type, event.item_id)?;
            let outcome_str = event.outcome.as_str();
            let Some(candidate) = request.candidates.iter().find(|candidate| {
                candidate.item_type == event.item_type && candidate.item_id == event.item_id
            }) else {
                return Err(rusqlite::Error::InvalidQuery);
            };
            if event.session_id != session_id
                || event.sequence != sequence
                || event.original_turn_time != turn_time
                || event.origin != "assessment"
                || !event.confidence.is_finite()
                || !(MIN_CONFIDENCE..=1.0).contains(&event.confidence)
                || event.exact_excerpt.is_empty()
                || event.exact_excerpt.chars().count() > MAX_EXCERPT_CHARS
                || !request.transcript.contains(&event.exact_excerpt)
                || (event.outcome == UsageOutcome::Correct
                    && !contains_normalized_words(&event.exact_excerpt, &candidate.target))
                || (event.outcome == UsageOutcome::Incorrect
                    && !contains_normalized_words(&event.exact_excerpt, &candidate.target)
                    && !(event.item_type == LearningItemType::Mistake
                        && contains_normalized_words(&event.exact_excerpt, &candidate.cue)))
                || event.outcome == UsageOutcome::Uncertain
            {
                return Err(rusqlite::Error::InvalidQuery);
            }
            transaction.execute(
                "INSERT INTO learning_usage_events
                 (item_type, item_id, session_id, sequence, origin, original_turn_time, outcome, exact_excerpt, confidence, created_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
                params![
                    type_str,
                    sql_item_id,
                    sql_sid,
                    sql_seq,
                    "assessment",
                    event.original_turn_time,
                    outcome_str,
                    event.exact_excerpt,
                    event.confidence,
                    event.created_at
                ],
            )?;

            // Recompute projection for this item
            let (status, interval, next_rev) = match event.item_type {
                LearningItemType::Mistake => {
                    let (s, i, n): (String, u32, i64) = transaction.query_row(
                        "SELECT status, interval_days, next_review_at FROM mistakes WHERE id = ?1",
                        params![sql_item_id],
                        |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
                    )?;
                    (
                        LearningStatus::parse(&s).unwrap_or(LearningStatus::New),
                        i,
                        n,
                    )
                }
                LearningItemType::Phrase => {
                    let (s, i, n): (String, u32, i64) = transaction.query_row(
                        "SELECT status, interval_days, next_review_at FROM phrase_cards WHERE id = ?1",
                        params![sql_item_id],
                        |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
                    )?;
                    (
                        LearningStatus::parse(&s).unwrap_or(LearningStatus::Learning),
                        i,
                        n,
                    )
                }
            };

            let all_events = load_item_events(&transaction, event.item_type, event.item_id)?;
            let projected = project_mastery_state(status, &all_events, interval, next_rev);
            let (projected_interval, projected_due) = if event.outcome == UsageOutcome::Incorrect {
                (1, event.original_turn_time)
            } else {
                (interval, next_rev)
            };

            match event.item_type {
                LearningItemType::Mistake => {
                    transaction.execute(
                        "UPDATE mistakes
                         SET status = ?1, interval_days = ?2, next_review_at = ?3, times_correct_afterwards = ?4
                         WHERE id = ?5",
                        params![
                            projected.status.as_str(),
                            projected_interval,
                            projected_due,
                            counter_baseline(&transaction, sql_item_id)?
                                + projected.lifetime_distinct_sessions as i64,
                            sql_item_id
                        ],
                    )?;
                }
                LearningItemType::Phrase => {
                    transaction.execute(
                        "UPDATE phrase_cards
                         SET status = ?1, interval_days = ?2, next_review_at = ?3
                         WHERE id = ?4",
                        params![
                            projected.status.as_str(),
                            projected_interval,
                            projected_due,
                            sql_item_id
                        ],
                    )?;
                }
            }
        }

        for finding in &mut assessment.findings {
            let status = match finding.item_type {
                LearningItemType::Mistake => transaction
                    .query_row(
                        "SELECT status FROM mistakes WHERE id = ?1",
                        params![to_sql_id(finding.item_id)?],
                        |row| row.get::<_, String>(0),
                    )
                    .optional()?,
                LearningItemType::Phrase => transaction
                    .query_row(
                        "SELECT status FROM phrase_cards WHERE id = ?1",
                        params![to_sql_id(finding.item_id)?],
                        |row| row.get::<_, String>(0),
                    )
                    .optional()?,
            };
            if let Some(status) = status {
                finding.status_after =
                    LearningStatus::parse(&status).unwrap_or(finding.status_after);
            }
        }

        let mut exposure_sessions = std::collections::HashSet::from([session_id]);
        if let Some(active_id) = active_session_id {
            exposure_sessions.insert(active_id);
        }
        for exposure_session in exposure_sessions {
            let exposure_sid = to_sql_id(exposure_session)?;
            for candidate in &request.candidates {
                let (item_type, item_id) = candidate_key(candidate.item_type, candidate.item_id)?;
                transaction.execute(
                    "INSERT INTO session_cue_exposures (session_id, item_type, item_id, exposed_at)
                     VALUES (?1, ?2, ?3, ?4)",
                    params![exposure_sid, item_type, item_id, now_ms()],
                )?;
            }
        }

        let json_data = serde_json::to_string(&assessment)
            .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
        transaction.execute(
            "UPDATE turn_usage_assessments SET assessment_json = ?1 WHERE session_id = ?2 AND sequence = ?3",
            params![json_data, sql_sid, sql_seq],
        )?;

        // Record cue exposure for this session
        transaction.commit()?;
        Ok(Some(assessment))
    }
}
