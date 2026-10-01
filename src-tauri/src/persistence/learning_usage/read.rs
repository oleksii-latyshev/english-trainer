use super::super::{to_sql_id, to_sql_sequence, SessionDatabase};
use super::PreparedUsageReview;
use crate::learning::{LearningItemType, LearningStatus, MemoryUsageEvidence, TurnUsageAssessment};
use rusqlite::{params, OptionalExtension};

impl SessionDatabase {
    pub(crate) fn prepare_usage_review(
        &self,
        session_id: u64,
        sequence: usize,
    ) -> rusqlite::Result<Option<PreparedUsageReview>> {
        prepare_usage_review_on(&self.connection, session_id, sequence)
    }

    pub(crate) fn usage_item_target(
        &self,
        item_type: LearningItemType,
        item_id: u64,
    ) -> rusqlite::Result<Option<(String, String)>> {
        let sql_id = to_sql_id(item_id)?;
        match item_type {
            LearningItemType::Mistake => self
                .connection
                .query_row(
                    "SELECT corrected_example, status FROM mistakes WHERE id = ?1",
                    params![sql_id],
                    |row| Ok((row.get(0)?, row.get(1)?)),
                )
                .optional(),
            LearningItemType::Phrase => self
                .connection
                .query_row(
                    "SELECT phrase, status FROM phrase_cards WHERE id = ?1",
                    params![sql_id],
                    |row| Ok((row.get(0)?, row.get(1)?)),
                )
                .optional(),
        }
    }

    pub(crate) fn usage_item_status(
        &self,
        item_type: LearningItemType,
        item_id: u64,
    ) -> rusqlite::Result<Option<String>> {
        Ok(self
            .usage_item_target(item_type, item_id)?
            .map(|(_, status)| status))
    }

    pub fn record_session_cue_exposure(
        &mut self,
        session_id: u64,
        item_type: Option<&str>,
        item_id: Option<u64>,
        exposed_at: i64,
    ) -> rusqlite::Result<()> {
        self.connection.execute(
            "INSERT INTO session_cue_exposures (session_id, item_type, item_id, exposed_at)
             VALUES (?1, ?2, ?3, ?4)",
            params![
                to_sql_id(session_id)?,
                item_type,
                item_id.map(to_sql_id).transpose()?,
                exposed_at
            ],
        )?;
        Ok(())
    }

    pub fn has_session_cue_exposure_before(
        &self,
        session_id: u64,
        item_type: Option<&str>,
        item_id: Option<u64>,
        turn_time: i64,
    ) -> rusqlite::Result<bool> {
        let count: i64 = self.connection.query_row(
            "SELECT COUNT(*) FROM session_cue_exposures WHERE session_id = ?1 AND exposed_at <= ?2
             AND ((item_type IS NULL AND item_id IS NULL)
               OR (?3 IS NOT NULL AND item_type = ?3 AND item_id = ?4))",
            params![
                to_sql_id(session_id)?,
                turn_time,
                item_type,
                item_id.map(to_sql_id).transpose()?
            ],
            |row| row.get(0),
        )?;
        Ok(count > 0)
    }

    pub fn get_turn_usage_assessment(
        &self,
        session_id: u64,
        sequence: usize,
    ) -> rusqlite::Result<Option<TurnUsageAssessment>> {
        let encoded: Option<String> = self.connection.query_row(
            "SELECT assessment_json FROM turn_usage_assessments WHERE session_id = ?1 AND sequence = ?2",
            params![to_sql_id(session_id)?, to_sql_sequence(sequence)?],
            |row| row.get(0),
        ).optional()?;
        encoded
            .map(|json| {
                serde_json::from_str(&json).map_err(|error| {
                    rusqlite::Error::FromSqlConversionFailure(
                        0,
                        rusqlite::types::Type::Text,
                        Box::new(error),
                    )
                })
            })
            .transpose()
    }

    pub fn get_memory_usage_evidence(
        &self,
        item_type: LearningItemType,
        item_id: u64,
    ) -> rusqlite::Result<MemoryUsageEvidence> {
        get_memory_usage_evidence_on(&self.connection, item_type, item_id)
    }
}

pub(crate) fn prepare_usage_review_on(
    connection: &rusqlite::Connection,
    session_id: u64,
    sequence: usize,
) -> rusqlite::Result<Option<PreparedUsageReview>> {
    let sql_sid = to_sql_id(session_id)?;
    let sql_seq = to_sql_sequence(sequence)?;
    let session: Option<(String, String)> = connection
        .query_row(
            "SELECT mode, opening_question FROM sessions WHERE id = ?1",
            params![sql_sid],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .optional()?;
    let Some((mode, opening_question)) = session else {
        return Ok(None);
    };
    let turn: Option<(String, i64)> = connection
        .query_row(
            "SELECT user_transcript, created_at FROM turns WHERE session_id = ?1 AND sequence = ?2",
            params![sql_sid, sql_seq],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .optional()?;
    let Some((transcript, turn_time)) = turn else {
        return Ok(None);
    };
    let candidates =
        super::candidates::eligible_usage_candidates_on(connection, session_id, sequence)?;
    let question = if sequence == 1 {
        opening_question.clone()
    } else {
        connection
            .query_row(
                "SELECT assistant_question FROM turns WHERE session_id = ?1 AND sequence = 1",
                params![sql_sid],
                |row| row.get::<_, String>(0),
            )
            .optional()?
            .unwrap_or(opening_question)
    };
    Ok(Some(PreparedUsageReview {
        request: crate::providers::UsageReviewRequest {
            answered_question: question,
            transcript,
            candidates,
        },
        turn_time,
        is_conversation: mode == "conversation",
    }))
}

fn get_memory_usage_evidence_on(
    connection: &rusqlite::Connection,
    item_type: LearningItemType,
    item_id: u64,
) -> rusqlite::Result<MemoryUsageEvidence> {
    let events = super::load_item_events(connection, item_type, item_id)?;
    let sql_id = to_sql_id(item_id)?;
    let (status, interval, due) = match item_type {
        LearningItemType::Mistake => item_schedule(connection, "mistakes", sql_id)?,
        LearningItemType::Phrase => item_schedule(connection, "phrase_cards", sql_id)?,
    };
    let projected = crate::learning::project_mastery_state(status, &events, interval, due);
    Ok(MemoryUsageEvidence {
        item_type,
        item_id,
        distinct_session_count: projected.lifetime_distinct_sessions,
        streak: projected.streak,
        events: events.into_iter().rev().take(5).collect(),
    })
}

fn item_schedule(
    connection: &rusqlite::Connection,
    table: &str,
    item_id: i64,
) -> rusqlite::Result<(LearningStatus, u32, i64)> {
    let sql = format!("SELECT status, interval_days, next_review_at FROM {table} WHERE id = ?1");
    let row: Option<(String, u32, i64)> = connection
        .query_row(&sql, params![item_id], |row| {
            Ok((row.get(0)?, row.get(1)?, row.get(2)?))
        })
        .optional()?;
    let Some((status, interval, due)) = row else {
        return Err(rusqlite::Error::QueryReturnedNoRows);
    };
    let status = LearningStatus::parse(&status).ok_or(rusqlite::Error::InvalidQuery)?;
    Ok((status, interval, due))
}
