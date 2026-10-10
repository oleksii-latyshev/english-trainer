use super::super::*;
use crate::learning::{
    is_safe_mistake_cue, is_safe_phrase_cue, LearningItemType, MemoryReviewItem, MemoryReviewRun,
};

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

impl SessionDatabase {
    pub fn start_memory_review_run(&mut self) -> rusqlite::Result<Option<MemoryReviewRun>> {
        if let Some(active) = self.active_memory_review_run()? {
            return Ok(Some(active));
        }
        let now = now_ms();
        let mut candidates = self.due_candidates(now)?;
        candidates.sort_by(|left, right| {
            left.due_at
                .cmp(&right.due_at)
                .then_with(|| left.type_order().cmp(&right.type_order()))
                .then_with(|| left.item_id.cmp(&right.item_id))
        });
        candidates.truncate(3);
        if candidates.is_empty() {
            return Ok(None);
        }

        let transaction = self.connection.transaction()?;
        transaction.execute(
            "INSERT INTO memory_review_runs (started_at) VALUES (?1)",
            [now],
        )?;
        let run_id = to_safe_u64_id(transaction.last_insert_rowid())?;
        let mut items = Vec::with_capacity(candidates.len());
        for (index, candidate) in candidates.into_iter().enumerate() {
            let position = index + 1;
            let item_type = match candidate.item_type {
                LearningItemType::Mistake => "mistake",
                LearningItemType::Phrase => "phrase",
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
        Ok(Some(MemoryReviewRun {
            run_id,
            items,
            completed: false,
        }))
    }

    fn due_candidates(&self, now: i64) -> rusqlite::Result<Vec<Candidate>> {
        let mut candidates = Vec::new();
        {
            let mut statement = self.connection.prepare(
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
            let mut statement = self.connection.prepare(
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
}
