use super::*;
use crate::learning::{
    calculate_next_review, LearningItemType, LearningMemoryView, LearningStatus, MistakeRecord,
    PhraseCardRecord, ReviewResponse, ReviewResult,
};
use crate::providers::FocusCategory;

pub(super) struct ReviewSchedule {
    pub status: LearningStatus,
    pub next_review_at: i64,
    pub interval_days: u32,
}

pub(super) fn record_review_schedule(
    transaction: &rusqlite::Transaction<'_>,
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

impl SessionDatabase {
    pub fn get_learning_memory(&self) -> rusqlite::Result<LearningMemoryView> {
        let now = now_ms();
        let mut mistakes_stmt = self.connection.prepare(
            "SELECT id, normalized_key, category, original_example, corrected_example,
                    explanation, times_seen, times_correct_afterwards, last_seen_at,
                    last_reviewed_at, next_review_at, interval_days, ease_factor, status
             FROM mistakes ORDER BY next_review_at ASC, id DESC",
        )?;
        let mistakes_rows = mistakes_stmt.query_map([], |row| {
            let cat_str: String = row.get(2)?;
            let category = match cat_str.as_str() {
                "vocabulary" => FocusCategory::Vocabulary,
                "coherence" => FocusCategory::Coherence,
                "interaction" => FocusCategory::Interaction,
                _ => FocusCategory::Grammar,
            };
            let status_str: String = row.get(13)?;
            let next_review: i64 = row.get(10)?;
            Ok(MistakeRecord {
                id: row.get::<_, i64>(0)? as u64,
                normalized_key: row.get(1)?,
                category,
                original_example: row.get(3)?,
                corrected_example: row.get(4)?,
                explanation: row.get(5)?,
                times_seen: row.get::<_, i64>(6)? as usize,
                times_correct_afterwards: row.get::<_, i64>(7)? as usize,
                last_seen_at: row.get(8)?,
                last_reviewed_at: row.get(9)?,
                next_review_at: next_review,
                interval_days: row.get(11)?,
                ease_factor: row.get(12)?,
                status: LearningStatus::parse(&status_str).unwrap_or(LearningStatus::New),
                is_due: status_str != "archived" && next_review <= now,
            })
        })?;
        let mistakes: Vec<MistakeRecord> = mistakes_rows.collect::<Result<_, _>>()?;

        let mut phrases_stmt = self.connection.prepare(
            "SELECT id, phrase, normalized_phrase, meaning_or_note, session_id, sequence,
                    created_at, last_reviewed_at, next_review_at, interval_days, ease_factor, status
             FROM phrase_cards ORDER BY next_review_at ASC, id DESC",
        )?;
        let phrases_rows = phrases_stmt.query_map([], |row| {
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
        })?;
        let phrase_cards: Vec<PhraseCardRecord> = phrases_rows.collect::<Result<_, _>>()?;

        let due_count = mistakes.iter().filter(|m| m.is_due).count()
            + phrase_cards.iter().filter(|p| p.is_due).count();

        Ok(LearningMemoryView {
            mistakes,
            phrase_cards,
            due_count,
        })
    }

    pub fn record_review(
        &mut self,
        item_type: LearningItemType,
        item_id: u64,
        response: ReviewResponse,
    ) -> rusqlite::Result<ReviewResult> {
        let now = now_ms();
        let transaction = self.connection.transaction()?;
        let scheduled = record_review_schedule(&transaction, item_type, item_id, response, now)?;

        transaction.commit()?;

        Ok(ReviewResult {
            item_type,
            item_id,
            status: scheduled.status,
            next_review_at: scheduled.next_review_at,
            interval_days: scheduled.interval_days,
            response,
        })
    }
}
