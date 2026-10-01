use super::super::to_sql_id;
use crate::learning::{LearningItemType, UsageEventRecord, UsageOutcome};
use rusqlite::{params, OptionalExtension};
use std::time::{SystemTime, UNIX_EPOCH};

pub(crate) fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64
}

pub(crate) fn load_item_events(
    conn: &rusqlite::Connection,
    item_type: LearningItemType,
    item_id: u64,
) -> rusqlite::Result<Vec<UsageEventRecord>> {
    let type_str = match item_type {
        LearningItemType::Mistake => "mistake",
        LearningItemType::Phrase => "phrase",
    };
    let sql_id = to_sql_id(item_id)?;
    let mut stmt = conn.prepare(
        "SELECT id, session_id, sequence, origin, original_turn_time, outcome, exact_excerpt, confidence, created_at
         FROM learning_usage_events
         WHERE item_type = ?1 AND item_id = ?2
         ORDER BY original_turn_time ASC, id ASC",
    )?;
    let rows = stmt.query_map(params![type_str, sql_id], |row| {
        let outcome_str: String = row.get(5)?;
        let outcome = UsageOutcome::parse(&outcome_str).unwrap_or(UsageOutcome::Uncertain);
        Ok(UsageEventRecord {
            id: row.get::<_, i64>(0)? as u64,
            item_type,
            item_id,
            session_id: row.get::<_, i64>(1)? as u64,
            sequence: row.get::<_, i64>(2)? as usize,
            origin: row.get(3)?,
            original_turn_time: row.get(4)?,
            outcome,
            exact_excerpt: row.get(6)?,
            confidence: row.get(7)?,
            created_at: row.get(8)?,
        })
    })?;
    rows.collect()
}

pub(crate) fn candidate_key(
    item_type: LearningItemType,
    item_id: u64,
) -> rusqlite::Result<(&'static str, i64)> {
    let item_type = match item_type {
        LearningItemType::Mistake => "mistake",
        LearningItemType::Phrase => "phrase",
    };
    Ok((item_type, to_sql_id(item_id)?))
}

pub(crate) fn counter_baseline(
    connection: &rusqlite::Connection,
    mistake_id: i64,
) -> rusqlite::Result<i64> {
    connection
        .query_row(
            "SELECT baseline_count FROM learning_usage_counter_baselines WHERE item_id = ?1",
            params![mistake_id],
            |row| row.get(0),
        )
        .optional()
        .map(|value| value.unwrap_or(0))
}
