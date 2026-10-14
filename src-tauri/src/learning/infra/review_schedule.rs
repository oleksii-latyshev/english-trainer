use super::ids::to_sql_id;
use crate::learning::{calculate_next_review, LearningItemType, LearningStatus, ReviewResponse};
use rusqlite::{params, Transaction};

pub(crate) struct ReviewSchedule {
    pub status: LearningStatus,
    pub next_review_at: i64,
    pub interval_days: u32,
}

pub(crate) fn record_review_schedule(
    transaction: &Transaction<'_>,
    item_type: LearningItemType,
    item_id: u64,
    response: ReviewResponse,
    now: i64,
) -> rusqlite::Result<ReviewSchedule> {
    let sql_id = to_sql_id(item_id)?;
    let (table, type_str) = match item_type {
        LearningItemType::Mistake => ("mistakes", "mistake"),
        LearningItemType::Phrase => ("phrase_cards", "phrase"),
    };
    let query = format!("SELECT status, interval_days, ease_factor FROM {table} WHERE id = ?1");
    let (status_str, interval, ease): (String, u32, f64) =
        transaction.query_row(&query, [sql_id], |row| {
            Ok((row.get(0)?, row.get(1)?, row.get(2)?))
        })?;
    let fallback = match item_type {
        LearningItemType::Mistake => LearningStatus::New,
        LearningItemType::Phrase => LearningStatus::Learning,
    };
    let current_status = LearningStatus::parse(&status_str).unwrap_or(fallback);
    let scheduled = calculate_next_review(current_status, interval, ease, response, now);
    let update = format!(
        "UPDATE {table} SET status = ?1, next_review_at = ?2, interval_days = ?3,
         ease_factor = ?4, last_reviewed_at = ?5 WHERE id = ?6"
    );
    transaction.execute(
        &update,
        params![
            scheduled.status.as_str(),
            scheduled.next_review_at,
            scheduled.interval_days,
            scheduled.ease_factor,
            now,
            sql_id
        ],
    )?;
    let (mistake_fk, phrase_fk) = match item_type {
        LearningItemType::Mistake => (Some(sql_id), None),
        LearningItemType::Phrase => (None, Some(sql_id)),
    };
    transaction.execute(
        "INSERT INTO review_events (item_type, item_id, response, created_at, mistake_id, phrase_id)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![type_str, sql_id, response.as_str(), now, mistake_fk, phrase_fk],
    )?;
    Ok(ReviewSchedule {
        status: scheduled.status,
        next_review_at: scheduled.next_review_at,
        interval_days: scheduled.interval_days,
    })
}
