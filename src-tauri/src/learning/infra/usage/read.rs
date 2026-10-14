use super::candidates::eligible_usage_candidates_on;
use super::ledger::load_item_events;
use crate::learning::infra::ids::{to_sql_id, to_sql_sequence};
use crate::learning::{LearningItemType, LearningStatus, MemoryUsageEvidence, TurnUsageAssessment};
use crate::providers::UsageReviewRequest;
use rusqlite::{params, Connection, OptionalExtension};

#[derive(Debug, Clone)]
pub(crate) struct PreparedUsageReview {
    pub(crate) request: UsageReviewRequest,
    pub(crate) turn_time: i64,
    pub(crate) is_conversation: bool,
}

pub(crate) fn item_target_and_status(
    connection: &Connection,
    item_type: LearningItemType,
    item_id: u64,
) -> rusqlite::Result<Option<(String, String)>> {
    let sql_id = to_sql_id(item_id)?;
    let query = match item_type {
        LearningItemType::Mistake => "SELECT corrected_example, status FROM mistakes WHERE id = ?1",
        LearningItemType::Phrase => "SELECT phrase, status FROM phrase_cards WHERE id = ?1",
    };
    connection
        .query_row(query, params![sql_id], |row| Ok((row.get(0)?, row.get(1)?)))
        .optional()
}

pub(crate) fn item_status(
    connection: &Connection,
    item_type: LearningItemType,
    item_id: u64,
) -> rusqlite::Result<Option<String>> {
    Ok(item_target_and_status(connection, item_type, item_id)?.map(|(_, status)| status))
}

pub(crate) fn saved_assessment(
    connection: &Connection,
    session_id: u64,
    sequence: usize,
) -> rusqlite::Result<Option<TurnUsageAssessment>> {
    let encoded: Option<String> = connection
        .query_row(
            "SELECT assessment_json FROM turn_usage_assessments WHERE session_id = ?1 AND sequence = ?2",
            params![to_sql_id(session_id)?, to_sql_sequence(sequence)?],
            |row| row.get(0),
        )
        .optional()?;
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

pub(crate) fn prepare_usage_review_on(
    connection: &Connection,
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
    let candidates = eligible_usage_candidates_on(connection, session_id, sequence)?;
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
        request: UsageReviewRequest {
            answered_question: question,
            transcript,
            candidates,
        },
        turn_time,
        is_conversation: mode == "conversation",
    }))
}

pub(crate) fn memory_usage_evidence(
    connection: &Connection,
    item_type: LearningItemType,
    item_id: u64,
) -> rusqlite::Result<MemoryUsageEvidence> {
    let events = load_item_events(connection, item_type, item_id)?;
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
    connection: &Connection,
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
