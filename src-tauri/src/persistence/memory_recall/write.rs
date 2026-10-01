use super::super::*;
use super::read::{parse_item_type, parse_learning_status, parse_review_response};
use crate::conversation::database_error;
use crate::conversation::recall::wording_observed;
use crate::learning::{
    LearningItemType, LearningStatus, MemoryRecallResult, ReviewResponse, MAX_TRANSCRIPT_CHARS,
};
use crate::persistence::learning_reviews::record_review_schedule;
use crate::providers::{ProviderError, ProviderErrorCode};

struct QueueRow {
    position: usize,
    item_type: LearningItemType,
    item_id: u64,
    cue: String,
    target: String,
    transcript: Option<String>,
    wording_observed: Option<bool>,
    saved_response: Option<ReviewResponse>,
    next_review_at: Option<i64>,
    interval_days: Option<u32>,
    status: Option<LearningStatus>,
    saved_at: Option<i64>,
}

impl SessionDatabase {
    pub fn record_memory_recall(
        &mut self,
        run_id: u64,
        item_type: LearningItemType,
        item_id: u64,
        transcript: &str,
    ) -> Result<MemoryRecallResult, ProviderError> {
        let transcript = transcript.trim();
        if transcript.is_empty() || transcript.chars().count() > MAX_TRANSCRIPT_CHARS {
            return Err(invalid_request(
                "Transcript must be between 1 and 4000 characters.",
            ));
        }
        validate_safe_id(run_id).map_err(invalid_request)?;
        validate_safe_id(item_id).map_err(invalid_request)?;
        let now = now_ms();
        let transaction = self.connection.transaction().map_err(database_error)?;
        let sql_run_id = to_sql_id(run_id).map_err(database_error)?;
        let run_exists: Option<Option<i64>> = transaction
            .query_row(
                "SELECT completed_at FROM memory_review_runs WHERE id = ?1",
                [sql_run_id],
                |row| row.get(0),
            )
            .optional()
            .map_err(database_error)?;
        match run_exists {
            None => return Err(invalid_session("This review run no longer exists.")),
            Some(Some(_)) => return Err(invalid_session("This review run is already finished.")),
            Some(None) => {}
        }
        let queue = load_queue(&transaction, sql_run_id).map_err(database_error)?;
        let item = queue
            .iter()
            .find(|row| row.item_type == item_type && row.item_id == item_id)
            .ok_or_else(|| invalid_request("This item is not in the review queue."))?;
        if item.saved_at.is_some() {
            return Ok(result_from_saved(run_id, item));
        }
        let next_pending = queue
            .iter()
            .find(|row| row.saved_at.is_none())
            .map(|row| row.position);
        if next_pending != Some(item.position) {
            return Err(invalid_request("Items must be answered in order."));
        }
        let sql_item_id = to_sql_id(item_id).map_err(database_error)?;
        let table = match item_type {
            LearningItemType::Mistake => "mistakes",
            LearningItemType::Phrase => "phrase_cards",
        };
        let (cue_column, target_column) = match item_type {
            LearningItemType::Mistake => ("original_example", "corrected_example"),
            LearningItemType::Phrase => ("meaning_or_note", "phrase"),
        };
        let query = format!(
            "SELECT status, next_review_at, {cue_column}, {target_column} FROM {table} WHERE id = ?1"
        );
        let current: Option<(String, i64, String, String)> = transaction
            .query_row(&query, [sql_item_id], |row| {
                Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?))
            })
            .optional()
            .map_err(database_error)?;
        let Some((status, due_at, current_cue, current_target)) = current else {
            return Err(invalid_request(
                "This item was removed and cannot be updated.",
            ));
        };
        if current_cue != item.cue || current_target != item.target {
            return Err(invalid_request(
                "This item changed after the review started. End the review and start again.",
            ));
        }
        if status == "archived" || due_at > now {
            return Err(invalid_request(
                "This item is archived or no longer due and cannot be updated.",
            ));
        }
        let observed = wording_observed(&item.target, transcript);
        let response = if observed {
            ReviewResponse::Remembered
        } else {
            ReviewResponse::NeedPractice
        };
        let scheduled = record_review_schedule(&transaction, item_type, item_id, response, now)
            .map_err(database_error)?;
        transaction
            .execute(
                "UPDATE memory_review_items SET transcript = ?1, wording_observed = ?2,
                        saved_response = ?3, next_review_at = ?4, interval_days = ?5,
                        status = ?6, saved_at = ?7 WHERE run_id = ?8 AND position = ?9",
                params![
                    transcript,
                    i64::from(observed),
                    response.as_str(),
                    scheduled.next_review_at,
                    i64::from(scheduled.interval_days),
                    scheduled.status.as_str(),
                    now,
                    sql_run_id,
                    to_sql_sequence(item.position).map_err(database_error)?,
                ],
            )
            .map_err(database_error)?;
        transaction.commit().map_err(database_error)?;
        Ok(MemoryRecallResult {
            run_id,
            position: item.position,
            item_type,
            item_id,
            cue: item.cue.clone(),
            target: item.target.clone(),
            transcript: transcript.to_string(),
            wording_observed: observed,
            saved_response: response,
            next_review_at: scheduled.next_review_at,
            interval_days: scheduled.interval_days,
            status: scheduled.status,
        })
    }

    pub fn finish_memory_review_run(&mut self, run_id: u64) -> Result<bool, ProviderError> {
        validate_safe_id(run_id).map_err(invalid_request)?;
        let transaction = self.connection.transaction().map_err(database_error)?;
        let sql_run_id = to_sql_id(run_id).map_err(database_error)?;
        let completed_at: Option<Option<i64>> = transaction
            .query_row(
                "SELECT completed_at FROM memory_review_runs WHERE id = ?1",
                [sql_run_id],
                |row| row.get(0),
            )
            .optional()
            .map_err(database_error)?;
        match completed_at {
            None => return Err(invalid_request("This review run no longer exists.")),
            Some(Some(_)) => return Ok(true),
            Some(None) => {}
        }
        transaction
            .execute(
                "UPDATE memory_review_runs SET completed_at = ?1 WHERE id = ?2 AND completed_at IS NULL",
                params![now_ms(), sql_run_id],
            )
            .map_err(database_error)?;
        transaction.commit().map_err(database_error)?;
        Ok(true)
    }
}

fn validate_safe_id(value: u64) -> Result<(), &'static str> {
    if value == 0 || value > 9_007_199_254_740_991 {
        return Err("Invalid review ID.");
    }
    Ok(())
}

fn invalid_request(message: impl Into<String>) -> ProviderError {
    ProviderError::new(ProviderErrorCode::InvalidRequest, message)
}

fn invalid_session(message: impl Into<String>) -> ProviderError {
    ProviderError::new(ProviderErrorCode::InvalidSession, message)
}

fn load_queue(
    transaction: &rusqlite::Transaction<'_>,
    run_id: i64,
) -> rusqlite::Result<Vec<QueueRow>> {
    let mut statement = transaction.prepare(
        "SELECT position, item_type, item_id, cue, target, transcript, wording_observed,
                saved_response, next_review_at, interval_days, status, saved_at
         FROM memory_review_items WHERE run_id = ?1 ORDER BY position",
    )?;
    let rows = statement.query_map([run_id], |row| {
        Ok(QueueRow {
            position: usize::try_from(row.get::<_, i64>(0)?)
                .map_err(|_| rusqlite::Error::InvalidQuery)?,
            item_type: parse_item_type(&row.get::<_, String>(1)?)?,
            item_id: to_safe_u64_id(row.get(2)?)?,
            cue: row.get(3)?,
            target: row.get(4)?,
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
            saved_at: row.get(11)?,
        })
    })?;
    rows.collect()
}

fn result_from_saved(run_id: u64, row: &QueueRow) -> MemoryRecallResult {
    MemoryRecallResult {
        run_id,
        position: row.position,
        item_type: row.item_type,
        item_id: row.item_id,
        cue: row.cue.clone(),
        target: row.target.clone(),
        transcript: row.transcript.clone().unwrap_or_default(),
        wording_observed: row.wording_observed.unwrap_or(false),
        saved_response: row.saved_response.unwrap_or(ReviewResponse::NeedPractice),
        next_review_at: row.next_review_at.unwrap_or_default(),
        interval_days: row.interval_days.unwrap_or(1),
        status: row.status.unwrap_or(LearningStatus::Learning),
    }
}
