use super::*;
use crate::conversation::recall::wording_observed;
use crate::conversation::{DailyRecallItem, DailyRecallPlan, SpokenRecallResult};

impl SessionDatabase {
    pub fn daily_recall_plan(&self, session_id: u64) -> rusqlite::Result<DailyRecallPlan> {
        let sql_id = to_sql_id(session_id)?;
        let completed_count: i64 = self.connection.query_row(
            "SELECT COUNT(*) FROM session_phrase_recalls WHERE session_id = ?1",
            [sql_id],
            |row| row.get(0),
        )?;
        let completed_count = completed_count as usize;
        let remaining = 3_usize.saturating_sub(completed_count);
        if remaining == 0 {
            return Ok(DailyRecallPlan {
                items: Vec::new(),
                completed_count,
            });
        }
        let mut statement = self.connection.prepare(
            "SELECT id, phrase, meaning_or_note FROM phrase_cards
             WHERE status != 'archived' AND next_review_at <= ?1
               AND length(trim(meaning_or_note)) > 0
               AND session_id IS NOT NULL AND session_id != ?2
               AND id NOT IN (SELECT phrase_id FROM session_phrase_recalls WHERE session_id = ?2)
             ORDER BY next_review_at, id",
        )?;
        let rows = statement.query_map(params![now_ms(), sql_id], |row| {
            Ok((
                row.get::<_, i64>(0)? as u64,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
            ))
        })?;
        let candidates: Vec<(u64, String, String)> = rows.collect::<Result<_, _>>()?;
        let items = candidates
            .into_iter()
            .filter(|(_, phrase, cue)| !wording_observed(phrase, cue))
            .take(remaining)
            .map(|(phrase_id, _, cue)| DailyRecallItem { phrase_id, cue })
            .collect();
        Ok(DailyRecallPlan {
            items,
            completed_count,
        })
    }

    pub fn record_daily_recall(
        &mut self,
        session_id: u64,
        phrase_id: u64,
        transcript: &str,
    ) -> rusqlite::Result<Option<SpokenRecallResult>> {
        let sql_session = to_sql_id(session_id)?;
        let sql_phrase = to_sql_id(phrase_id)?;
        let existing: Option<(String, bool)> = self
            .connection
            .query_row(
                "SELECT transcript, wording_observed FROM session_phrase_recalls
             WHERE session_id = ?1 AND phrase_id = ?2",
                params![sql_session, sql_phrase],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .optional()?;
        let target: Option<String> = self
            .connection
            .query_row(
                "SELECT phrase FROM phrase_cards WHERE id = ?1",
                [sql_phrase],
                |row| row.get(0),
            )
            .optional()?;
        let Some(target) = target else {
            return Ok(None);
        };
        if let Some((saved_transcript, observed)) = existing {
            return Ok(Some(SpokenRecallResult {
                phrase_id,
                transcript: saved_transcript,
                target,
                wording_observed: observed,
            }));
        }
        if !self
            .daily_recall_plan(session_id)?
            .items
            .iter()
            .any(|item| item.phrase_id == phrase_id)
        {
            return Ok(None);
        }
        let observed = wording_observed(&target, transcript);
        self.connection.execute(
            "INSERT INTO session_phrase_recalls (session_id, phrase_id, transcript, wording_observed, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![sql_session, sql_phrase, transcript.trim(), observed, now_ms()],
        )?;
        Ok(Some(SpokenRecallResult {
            phrase_id,
            transcript: transcript.trim().to_owned(),
            target,
            wording_observed: observed,
        }))
    }
}
