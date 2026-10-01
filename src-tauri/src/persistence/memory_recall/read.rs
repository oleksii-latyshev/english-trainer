use super::super::*;
use crate::learning::{
    LearningItemType, LearningStatus, MemoryReviewItem, MemoryReviewRun, ReviewResponse,
};

impl SessionDatabase {
    pub fn active_memory_review_run(&self) -> rusqlite::Result<Option<MemoryReviewRun>> {
        let sql_run_id = self
            .connection
            .query_row(
                "SELECT id FROM memory_review_runs WHERE completed_at IS NULL ORDER BY id DESC LIMIT 1",
                [],
                |row| row.get::<_, i64>(0),
            )
            .optional()?;
        let Some(sql_run_id) = sql_run_id else {
            return Ok(None);
        };

        let mut statement = self.connection.prepare(
            "SELECT position, item_type, item_id, cue, target, transcript, wording_observed,
                    saved_response, next_review_at, interval_days, status, saved_at
             FROM memory_review_items WHERE run_id = ?1 ORDER BY position",
        )?;
        let items = statement
            .query_map([sql_run_id], |row| {
                let saved = row.get::<_, Option<i64>>(11)?.is_some();
                Ok(MemoryReviewItem {
                    position: usize::try_from(row.get::<_, i64>(0)?)
                        .map_err(|_| rusqlite::Error::InvalidQuery)?,
                    item_type: parse_item_type(row.get::<_, String>(1)?.as_str())?,
                    item_id: to_safe_u64_id(row.get(2)?)?,
                    cue: row.get(3)?,
                    target: if saved { Some(row.get(4)?) } else { None },
                    transcript: row.get(5)?,
                    wording_observed: row.get::<_, Option<i64>>(6)?.map(|value| value == 1),
                    saved_response: row
                        .get::<_, Option<String>>(7)?
                        .as_deref()
                        .map(parse_review_response)
                        .transpose()?,
                    next_review_at: row.get(8)?,
                    interval_days: row.get::<_, Option<i64>>(9)?.map(|value| value as u32),
                    status: row
                        .get::<_, Option<String>>(10)?
                        .as_deref()
                        .map(parse_learning_status)
                        .transpose()?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(Some(MemoryReviewRun {
            run_id: to_safe_u64_id(sql_run_id)?,
            items,
            completed: false,
        }))
    }
}

pub(super) fn parse_item_type(value: &str) -> rusqlite::Result<LearningItemType> {
    match value {
        "mistake" => Ok(LearningItemType::Mistake),
        "phrase" => Ok(LearningItemType::Phrase),
        _ => Err(rusqlite::Error::InvalidQuery),
    }
}

pub(super) fn parse_review_response(value: &str) -> rusqlite::Result<ReviewResponse> {
    match value {
        "remembered" => Ok(ReviewResponse::Remembered),
        "need_practice" => Ok(ReviewResponse::NeedPractice),
        _ => Err(rusqlite::Error::InvalidQuery),
    }
}

pub(super) fn parse_learning_status(value: &str) -> rusqlite::Result<LearningStatus> {
    LearningStatus::parse(value).ok_or(rusqlite::Error::InvalidQuery)
}
