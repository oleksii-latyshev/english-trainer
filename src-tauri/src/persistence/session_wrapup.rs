//! Reads that feed the session wrap-up, and the removal of a saved phrase card.

use super::{now_ms, to_sql_id, SessionDatabase};
use crate::learning::session_stats::AnswerSample;
use crate::providers::TurnFeedback;
use rusqlite::params;
use std::collections::HashSet;

/// One answer whose feedback was reviewed, with the learner's words.
pub(crate) struct ReviewedAnswer {
    pub(crate) sequence: usize,
    pub(crate) transcript: String,
    pub(crate) feedback: TurnFeedback,
}

/// A mistake that was observed in several answers of one session.
pub(crate) struct RepeatedMistake {
    pub(crate) original: String,
    pub(crate) improved: String,
    pub(crate) explanation: String,
    pub(crate) times: usize,
}

impl SessionDatabase {
    /// Every answer of the session in order, as the wrap-up statistics read it.
    pub(crate) fn answer_samples(&self, session_id: u64) -> rusqlite::Result<Vec<AnswerSample>> {
        let mut statement = self.connection.prepare(
            "SELECT t.user_transcript, t.answer_duration_ms, COALESCE(s.input_source, 'voice')
             FROM turns t LEFT JOIN turn_input_sources s
               ON s.session_id = t.session_id AND s.sequence = t.sequence
             WHERE t.session_id = ?1 ORDER BY t.sequence",
        )?;
        let rows = statement.query_map([to_sql_id(session_id)?], |row| {
            let duration_ms: Option<i64> = row.get(1)?;
            let source: String = row.get(2)?;
            Ok(AnswerSample {
                transcript: row.get(0)?,
                duration_ms: duration_ms.and_then(|value| u64::try_from(value).ok()),
                is_typed: source == "text",
            })
        })?;
        rows.collect()
    }

    /// Finished sessions before this one, newest first.
    pub(crate) fn earlier_finished_session_ids(
        &self,
        session_id: u64,
        limit: usize,
    ) -> rusqlite::Result<Vec<u64>> {
        let mut statement = self.connection.prepare(
            "SELECT id FROM sessions WHERE ended_at IS NOT NULL AND id < ?1 ORDER BY id DESC LIMIT ?2",
        )?;
        let rows = statement.query_map(
            params![
                to_sql_id(session_id)?,
                i64::try_from(limit).unwrap_or(i64::MAX)
            ],
            |row| row.get::<_, i64>(0),
        )?;
        rows.map(|row| super::to_u64_id(row?)).collect()
    }

    /// Time from the start of the session to its end, or to now while it is still open.
    pub(crate) fn session_elapsed_ms(&self, session_id: u64) -> rusqlite::Result<u64> {
        let (started_at, ended_at): (i64, Option<i64>) = self.connection.query_row(
            "SELECT started_at, ended_at FROM sessions WHERE id = ?1",
            [to_sql_id(session_id)?],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )?;
        Ok(u64::try_from(ended_at.unwrap_or_else(now_ms) - started_at).unwrap_or(0))
    }

    /// Answers of the session whose coaching feedback was saved, in order.
    pub(crate) fn reviewed_answers(
        &self,
        session_id: u64,
    ) -> rusqlite::Result<Vec<ReviewedAnswer>> {
        let mut statement = self.connection.prepare(
            "SELECT t.sequence, t.user_transcript, f.feedback_json
             FROM turn_feedback f JOIN turns t
               ON t.session_id = f.session_id AND t.sequence = f.sequence
             WHERE f.session_id = ?1 ORDER BY t.sequence",
        )?;
        let rows = statement.query_map([to_sql_id(session_id)?], |row| {
            let sequence: i64 = row.get(0)?;
            let encoded: String = row.get(2)?;
            let feedback = serde_json::from_str(&encoded).map_err(|error| {
                rusqlite::Error::FromSqlConversionFailure(
                    2,
                    rusqlite::types::Type::Text,
                    Box::new(error),
                )
            })?;
            Ok(ReviewedAnswer {
                sequence: usize::try_from(sequence)
                    .map_err(|_| rusqlite::Error::IntegralValueOutOfRange(0, sequence))?,
                transcript: row.get(1)?,
                feedback,
            })
        })?;
        rows.collect()
    }

    /// Normalized wording of every saved phrase card, to skip phrases already in Memory.
    pub(crate) fn saved_phrase_keys(&self) -> rusqlite::Result<HashSet<String>> {
        let mut statement = self
            .connection
            .prepare("SELECT normalized_phrase FROM phrase_cards")?;
        let rows = statement.query_map([], |row| row.get::<_, String>(0))?;
        rows.collect()
    }

    /// Mistakes observed in at least two answers of the session, most frequent first, using the
    /// wording of the latest answer where it was observed.
    pub(crate) fn repeated_mistakes(
        &self,
        session_id: u64,
        limit: usize,
    ) -> rusqlite::Result<Vec<RepeatedMistake>> {
        let mut statement = self.connection.prepare(
            "SELECT m.original_example, m.corrected_example, m.explanation,
                    COUNT(*) AS times, MAX(o.sequence) AS latest
             FROM mistake_occurrences o JOIN mistakes m ON m.id = o.mistake_id
             WHERE o.session_id = ?1
             GROUP BY m.id HAVING times >= 2
             ORDER BY times DESC, latest DESC LIMIT ?2",
        )?;
        let rows = statement.query_map(
            params![
                to_sql_id(session_id)?,
                i64::try_from(limit).unwrap_or(i64::MAX)
            ],
            |row| {
                Ok((
                    RepeatedMistake {
                        original: row.get(0)?,
                        improved: row.get(1)?,
                        explanation: row.get(2)?,
                        times: usize::try_from(row.get::<_, i64>(3)?).unwrap_or(0),
                    },
                    row.get::<_, i64>(4)?,
                ))
            },
        )?;
        let mut mistakes = Vec::new();
        for row in rows {
            let (mut mistake, latest) = row?;
            let latest = usize::try_from(latest)
                .map_err(|_| rusqlite::Error::IntegralValueOutOfRange(0, latest))?;
            if let Some(focus) = self
                .turn_feedback(session_id, latest)?
                .and_then(|feedback| feedback.focus_feedback.into_iter().next())
            {
                mistake.original = focus.original;
                mistake.improved = focus.improved;
                mistake.explanation = focus.explanation;
            }
            mistakes.push(mistake);
        }
        Ok(mistakes)
    }

    /// Removes a saved phrase card and the evidence kept about it. Returns false when no card
    /// has this id (already removed, or never saved), so a repeated removal is harmless.
    pub fn delete_phrase_card(&mut self, phrase_id: u64) -> rusqlite::Result<bool> {
        let id = to_sql_id(phrase_id)?;
        let transaction = self.connection.transaction()?;
        // These tables point at a card by id without a foreign key. Review events and spoken
        // recalls go with the card through their cascading keys; past review-run rows stay as
        // history and already tolerate a removed item.
        transaction.execute(
            "DELETE FROM learning_usage_events WHERE item_type = 'phrase' AND item_id = ?1",
            [id],
        )?;
        transaction.execute(
            "DELETE FROM session_cue_exposures WHERE item_type = 'phrase' AND item_id = ?1",
            [id],
        )?;
        let removed = transaction.execute("DELETE FROM phrase_cards WHERE id = ?1", [id])?;
        transaction.commit()?;
        Ok(removed == 1)
    }
}
