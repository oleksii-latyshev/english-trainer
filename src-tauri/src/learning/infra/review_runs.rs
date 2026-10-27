use super::ids::storage;
use super::ids::{now_ms, to_safe_u64_id, to_sql_id, to_sql_sequence};
use crate::learning::review_rules::ReviewRejection;
use crate::learning::LearningError;
use crate::learning::{
    is_safe_mistake_cue, is_safe_phrase_cue, LearningItemType, LearningStatus, MemoryReviewItem,
    MemoryReviewRun, ReviewResponse,
};
use rusqlite::{params, Connection, OptionalExtension};

const REVIEW_SIZE: usize = 6;
const WARMUP_SIZE: usize = 3;

struct Candidate {
    item_type: LearningItemType,
    item_id: u64,
    cue: String,
    target: String,
    due_at: i64,
}

impl Candidate {
    fn type_order(&self) -> u8 {
        match self.item_type {
            LearningItemType::Mistake => 0,
            LearningItemType::Phrase => 1,
        }
    }
}

pub(crate) fn parse_item_type(value: &str) -> rusqlite::Result<LearningItemType> {
    match value {
        "mistake" => Ok(LearningItemType::Mistake),
        "phrase" => Ok(LearningItemType::Phrase),
        _ => Err(rusqlite::Error::InvalidQuery),
    }
}

pub(crate) fn parse_review_response(value: &str) -> rusqlite::Result<ReviewResponse> {
    match value {
        "remembered" => Ok(ReviewResponse::Remembered),
        "need_practice" => Ok(ReviewResponse::NeedPractice),
        _ => Err(rusqlite::Error::InvalidQuery),
    }
}

pub(crate) fn parse_learning_status(value: &str) -> rusqlite::Result<LearningStatus> {
    LearningStatus::parse(value).ok_or(rusqlite::Error::InvalidQuery)
}

pub(crate) fn active_run(connection: &Connection) -> rusqlite::Result<Option<MemoryReviewRun>> {
    let sql_run_id = connection
        .query_row(
            "SELECT id FROM memory_review_runs WHERE completed_at IS NULL ORDER BY id DESC LIMIT 1",
            [],
            |row| row.get::<_, i64>(0),
        )
        .optional()?;
    let Some(sql_run_id) = sql_run_id else {
        return Ok(None);
    };

    let mut statement = connection.prepare(
        "SELECT position, item_type, item_id, cue, target, transcript, wording_observed,
                saved_response, next_review_at, interval_days, status, saved_at
         FROM memory_review_items WHERE run_id = ?1 ORDER BY position",
    )?;
    let items = statement
        .query_map([sql_run_id], |row| {
            let saved_at = row.get::<_, Option<i64>>(11)?;
            let saved_response = row
                .get::<_, Option<String>>(7)?
                .as_deref()
                .map(parse_review_response)
                .transpose()?;
            let is_scored = saved_response.is_some();
            Ok(MemoryReviewItem {
                position: usize::try_from(row.get::<_, i64>(0)?)
                    .map_err(|_| rusqlite::Error::InvalidQuery)?,
                item_type: parse_item_type(row.get::<_, String>(1)?.as_str())?,
                item_id: to_safe_u64_id(row.get(2)?)?,
                cue: row.get(3)?,
                target: if is_scored { Some(row.get(4)?) } else { None },
                transcript: row.get(5)?,
                wording_observed: row.get::<_, Option<i64>>(6)?.map(|value| value == 1),
                saved_response,
                next_review_at: row.get(8)?,
                interval_days: row.get::<_, Option<i64>>(9)?.map(|value| value as u32),
                status: row
                    .get::<_, Option<String>>(10)?
                    .as_deref()
                    .map(parse_learning_status)
                    .transpose()?,
                is_skipped: saved_at.is_some() && !is_scored,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(Some(MemoryReviewRun {
        run_id: to_safe_u64_id(sql_run_id)?,
        items,
        completed: false,
    }))
}

pub(crate) fn start_run(
    connection: &mut Connection,
    is_warmup: bool,
) -> rusqlite::Result<Option<MemoryReviewRun>> {
    if let Some(active) = active_run(connection)? {
        return Ok(Some(active));
    }
    let now = now_ms();
    let mut candidates = due_candidates(connection, now)?;
    candidates.sort_by(|left, right| {
        left.due_at
            .cmp(&right.due_at)
            .then_with(|| left.type_order().cmp(&right.type_order()))
            .then_with(|| left.item_id.cmp(&right.item_id))
    });
    if is_warmup {
        candidates.retain(|item| item.item_type == LearningItemType::Phrase);
    }
    candidates.truncate(if is_warmup { WARMUP_SIZE } else { REVIEW_SIZE });
    if candidates.is_empty() {
        return Ok(None);
    }
    create_run(connection, candidates, now).map(Some)
}

pub(crate) fn start_item_run(
    connection: &mut Connection,
    item_type: LearningItemType,
    item_id: u64,
) -> Result<Option<MemoryReviewRun>, LearningError> {
    if let Some(active) = active_run(connection).map_err(storage("read"))? {
        return Ok(Some(active));
    }
    let now = now_ms();
    let candidate = item_candidate(connection, item_type, item_id)
        .map_err(storage("read"))?
        .ok_or(LearningError::Review(ReviewRejection::NotReviewable))?;
    let run = create_run(connection, vec![candidate], now).map_err(storage("update"))?;
    Ok(Some(run))
}

fn create_run(
    connection: &mut Connection,
    candidates: Vec<Candidate>,
    now: i64,
) -> rusqlite::Result<MemoryReviewRun> {
    let transaction = connection.transaction()?;
    transaction.execute(
        "INSERT INTO memory_review_runs (started_at) VALUES (?1)",
        [now],
    )?;
    let run_id = to_safe_u64_id(transaction.last_insert_rowid())?;
    let mut items = Vec::with_capacity(candidates.len());
    for (index, candidate) in candidates.into_iter().enumerate() {
        let position = index + 1;
        let (item_type, table) = match candidate.item_type {
            LearningItemType::Mistake => ("mistake", "mistakes"),
            LearningItemType::Phrase => ("phrase", "phrase_cards"),
        };
        transaction.execute(
            "INSERT INTO memory_review_items (run_id, position, item_type, item_id, cue, target)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![
                to_sql_id(run_id)?,
                to_sql_sequence(position)?,
                item_type,
                to_sql_id(candidate.item_id)?,
                candidate.cue,
                candidate.target
            ],
        )?;
        if candidate.due_at > now {
            transaction.execute(
                &format!("UPDATE {table} SET next_review_at = ?1 WHERE id = ?2"),
                params![now, to_sql_id(candidate.item_id)?],
            )?;
        }
        items.push(MemoryReviewItem {
            position,
            item_type: candidate.item_type,
            item_id: candidate.item_id,
            cue: candidate.cue,
            target: None,
            transcript: None,
            wording_observed: None,
            saved_response: None,
            next_review_at: None,
            interval_days: None,
            status: None,
            is_skipped: false,
        });
    }
    transaction.commit()?;
    Ok(MemoryReviewRun {
        run_id,
        items,
        completed: false,
    })
}

fn item_candidate(
    connection: &Connection,
    item_type: LearningItemType,
    item_id: u64,
) -> rusqlite::Result<Option<Candidate>> {
    let sql_id = to_sql_id(item_id)?;
    let candidate = match item_type {
        LearningItemType::Mistake => connection
            .query_row(
                "SELECT original_example, corrected_example, next_review_at FROM mistakes
                 WHERE id = ?1 AND status != 'archived' AND times_seen >= 2",
                [sql_id],
                |row| {
                    Ok((
                        row.get::<_, String>(0)?,
                        row.get::<_, String>(1)?,
                        row.get(2)?,
                    ))
                },
            )
            .optional()?
            .filter(|(cue, target, _)| is_safe_mistake_cue(target, cue)),
        LearningItemType::Phrase => connection
            .query_row(
                "SELECT meaning_or_note, phrase, next_review_at FROM phrase_cards
                 WHERE id = ?1 AND status != 'archived'",
                [sql_id],
                |row| {
                    Ok((
                        row.get::<_, String>(0)?,
                        row.get::<_, String>(1)?,
                        row.get(2)?,
                    ))
                },
            )
            .optional()?
            .filter(|(cue, target, _)| is_safe_phrase_cue(target, cue)),
    };
    Ok(candidate.map(|(cue, target, due_at)| Candidate {
        item_type,
        item_id,
        cue,
        target,
        due_at,
    }))
}

fn due_candidates(connection: &Connection, now: i64) -> rusqlite::Result<Vec<Candidate>> {
    let mut candidates = Vec::new();
    {
        let mut statement = connection.prepare(
            "SELECT id, original_example, corrected_example, next_review_at FROM mistakes
             WHERE status != 'archived' AND times_seen >= 2 AND next_review_at <= ?1",
        )?;
        let rows = statement.query_map([now], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, i64>(3)?,
            ))
        })?;
        for row in rows {
            let (raw_id, cue, target, due_at) = row?;
            if is_safe_mistake_cue(&target, &cue) {
                candidates.push(Candidate {
                    item_type: LearningItemType::Mistake,
                    item_id: to_safe_u64_id(raw_id)?,
                    cue,
                    target,
                    due_at,
                });
            }
        }
    }
    {
        let mut statement = connection.prepare(
            "SELECT id, phrase, meaning_or_note, next_review_at FROM phrase_cards
             WHERE status != 'archived' AND next_review_at <= ?1",
        )?;
        let rows = statement.query_map([now], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, i64>(3)?,
            ))
        })?;
        for row in rows {
            let (raw_id, target, cue, due_at) = row?;
            if is_safe_phrase_cue(&target, &cue) {
                candidates.push(Candidate {
                    item_type: LearningItemType::Phrase,
                    item_id: to_safe_u64_id(raw_id)?,
                    cue,
                    target,
                    due_at,
                });
            }
        }
    }
    Ok(candidates)
}
