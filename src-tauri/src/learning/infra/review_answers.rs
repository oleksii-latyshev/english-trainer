use super::ids::{now_ms, storage, to_safe_u64_id, to_sql_id, to_sql_sequence};
use super::review_runs::{parse_item_type, parse_learning_status, parse_review_response};
use super::review_schedule::record_review_schedule;
use crate::learning::recall::wording_observed;
use crate::learning::review_rules::{
    check_still_answerable, response_for, result_from_saved, slot_of, CurrentItem, QueueItem,
    QueueSlot, ReviewRejection,
};
use crate::learning::{LearningError, LearningItemType, MemoryRecallResult};
use rusqlite::{params, Connection, OptionalExtension, Transaction};

fn reject(rejection: ReviewRejection) -> LearningError {
    LearningError::Review(rejection)
}

fn open_run(transaction: &Transaction<'_>, sql_run_id: i64) -> Result<(), LearningError> {
    let completed_at: Option<Option<i64>> = transaction
        .query_row(
            "SELECT completed_at FROM memory_review_runs WHERE id = ?1",
            [sql_run_id],
            |row| row.get(0),
        )
        .optional()
        .map_err(storage("read"))?;
    match completed_at {
        None => Err(reject(ReviewRejection::RunMissing)),
        Some(Some(_)) => Err(reject(ReviewRejection::RunFinished)),
        Some(None) => Ok(()),
    }
}

fn load_queue(transaction: &Transaction<'_>, run_id: i64) -> rusqlite::Result<Vec<QueueItem>> {
    let mut statement = transaction.prepare(
        "SELECT position, item_type, item_id, cue, target, transcript, wording_observed,
                saved_response, next_review_at, interval_days, status, saved_at
         FROM memory_review_items WHERE run_id = ?1 ORDER BY position",
    )?;
    let rows = statement.query_map([run_id], |row| {
        Ok(QueueItem {
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

fn current_item(
    transaction: &Transaction<'_>,
    item_type: LearningItemType,
    sql_item_id: i64,
) -> rusqlite::Result<Option<CurrentItem>> {
    let (table, cue_column, target_column) = match item_type {
        LearningItemType::Mistake => ("mistakes", "original_example", "corrected_example"),
        LearningItemType::Phrase => ("phrase_cards", "meaning_or_note", "phrase"),
    };
    let query = format!(
        "SELECT status, next_review_at, {cue_column}, {target_column} FROM {table} WHERE id = ?1"
    );
    transaction
        .query_row(&query, [sql_item_id], |row| {
            Ok(CurrentItem {
                status: row.get(0)?,
                due_at: row.get(1)?,
                cue: row.get(2)?,
                target: row.get(3)?,
            })
        })
        .optional()
}

pub(crate) fn record_recall(
    connection: &mut Connection,
    run_id: u64,
    item_type: LearningItemType,
    item_id: u64,
    transcript: &str,
) -> Result<MemoryRecallResult, LearningError> {
    let now = now_ms();
    let transaction = connection.transaction().map_err(storage("update"))?;
    let sql_run_id = to_sql_id(run_id).map_err(storage("update"))?;
    open_run(&transaction, sql_run_id)?;
    let queue = load_queue(&transaction, sql_run_id).map_err(storage("read"))?;
    let item = match slot_of(&queue, item_type, item_id).map_err(reject)? {
        QueueSlot::Skipped => return Err(reject(ReviewRejection::Skipped)),
        QueueSlot::Answered(saved) => return Ok(result_from_saved(run_id, saved)),
        QueueSlot::Next(item) => item,
    };
    let sql_item_id = to_sql_id(item_id).map_err(storage("read"))?;
    let current = current_item(&transaction, item_type, sql_item_id).map_err(storage("read"))?;
    check_still_answerable(item, current.as_ref(), now).map_err(reject)?;
    let observed = wording_observed(&item.target, transcript);
    let response = response_for(observed);
    let scheduled = record_review_schedule(&transaction, item_type, item_id, response, now)
        .map_err(storage("update"))?;
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
                to_sql_sequence(item.position).map_err(storage("update"))?,
            ],
        )
        .map_err(storage("update"))?;
    transaction.commit().map_err(storage("update"))?;
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

pub(crate) fn skip_item(
    connection: &mut Connection,
    run_id: u64,
    item_type: LearningItemType,
    item_id: u64,
) -> Result<(), LearningError> {
    let transaction = connection.transaction().map_err(storage("update"))?;
    let sql_run_id = to_sql_id(run_id).map_err(storage("update"))?;
    open_run(&transaction, sql_run_id)?;
    let queue = load_queue(&transaction, sql_run_id).map_err(storage("read"))?;
    let item = match slot_of(&queue, item_type, item_id).map_err(reject)? {
        QueueSlot::Answered(_) | QueueSlot::Skipped => return Ok(()),
        QueueSlot::Next(item) => item,
    };
    transaction
        .execute(
            "UPDATE memory_review_items SET saved_at = ?1
             WHERE run_id = ?2 AND position = ?3 AND saved_at IS NULL",
            params![
                now_ms(),
                sql_run_id,
                to_sql_sequence(item.position).map_err(storage("update"))?
            ],
        )
        .map_err(storage("update"))?;
    transaction.commit().map_err(storage("update"))?;
    Ok(())
}

pub(crate) fn finish_run(connection: &mut Connection, run_id: u64) -> Result<(), LearningError> {
    let transaction = connection.transaction().map_err(storage("update"))?;
    let sql_run_id = to_sql_id(run_id).map_err(storage("update"))?;
    let completed_at: Option<Option<i64>> = transaction
        .query_row(
            "SELECT completed_at FROM memory_review_runs WHERE id = ?1",
            [sql_run_id],
            |row| row.get(0),
        )
        .optional()
        .map_err(storage("read"))?;
    match completed_at {
        None => return Err(reject(ReviewRejection::UnknownRunToFinish)),
        Some(Some(_)) => return Ok(()),
        Some(None) => {}
    }
    transaction
        .execute(
            "UPDATE memory_review_runs SET completed_at = ?1 WHERE id = ?2 AND completed_at IS NULL",
            params![now_ms(), sql_run_id],
        )
        .map_err(storage("update"))?;
    transaction.commit().map_err(storage("update"))?;
    Ok(())
}
