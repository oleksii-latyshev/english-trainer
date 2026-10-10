use super::{to_sql_id, SessionDatabase};
use crate::providers::{ProviderError, WrapupAnswer, WrapupResult};
use rusqlite::{params, OptionalExtension};

pub(crate) enum PreparedWrapup {
    Pending,
    Ready(WrapupResult),
    Failed(ProviderError),
}

impl SessionDatabase {
    pub(crate) fn save_wrapup_phrase_cards(
        &self,
        session_id: u64,
        phrases: &[crate::conversation::WrapupPhrase],
    ) -> rusqlite::Result<crate::conversation::SavedWrapupPhrases> {
        let transaction = self.connection.unchecked_transaction()?;
        let prior = self.saved_phrase_keys()?;
        let mut cards = Vec::new();
        let mut created_ids = Vec::new();
        for phrase in phrases {
            let card = self.save_phrase_card(
                &phrase.phrase,
                &phrase.note,
                Some(session_id),
                Some(phrase.sequence),
            )?;
            if !prior.contains(&crate::learning::normalize_phrase(&phrase.phrase)) {
                created_ids.push(card.id);
            }
            cards.push(card);
        }
        transaction.commit()?;
        Ok(crate::conversation::SavedWrapupPhrases { cards, created_ids })
    }

    pub(crate) fn wrapup_record(
        &self,
        session_id: u64,
    ) -> rusqlite::Result<Option<PreparedWrapup>> {
        self.connection
            .query_row(
                "SELECT state, result_json, error_json FROM session_wrapups WHERE session_id = ?1",
                [to_sql_id(session_id)?],
                |row| {
                    let state: String = row.get(0)?;
                    match state.as_str() {
                        "pending" => Ok(PreparedWrapup::Pending),
                        "ready" => decode(row.get::<_, String>(1)?).map(PreparedWrapup::Ready),
                        "failed" => decode(row.get::<_, String>(2)?).map(PreparedWrapup::Failed),
                        _ => Err(rusqlite::Error::InvalidQuery),
                    }
                },
            )
            .optional()
    }

    pub(crate) fn next_wrapup_id(&self) -> rusqlite::Result<Option<u64>> {
        self.connection.query_row(
            "SELECT session_id FROM session_wrapups WHERE state = 'pending' ORDER BY session_id LIMIT 1",
            [], |row| super::to_u64_id(row.get(0)?),
        ).optional()
    }

    /// Numbered, bounded excerpts retain exact substring provenance in the original answers.
    pub(crate) fn wrapup_answers(&self, session_id: u64) -> rusqlite::Result<Vec<WrapupAnswer>> {
        let metadata = self
            .session_metadata(session_id)?
            .ok_or(rusqlite::Error::QueryReturnedNoRows)?;
        let turns = self.turns(session_id)?;
        let mut remaining_chars = 12_000;
        let mut answers = Vec::new();
        for (index, turn) in turns.iter().enumerate().rev().take(24) {
            if remaining_chars == 0 {
                break;
            }
            let transcript: String = turn
                .learner
                .chars()
                .take(1500.min(remaining_chars))
                .collect();
            if transcript.trim().is_empty() {
                continue;
            }
            remaining_chars -= transcript.chars().count();
            // Spoken rehearsal answers replay the written questions, not the last written reply.
            let previous = if metadata.practice_mode == "write_then_speak"
                && index >= metadata.written_turn_count
            {
                (index - metadata.written_turn_count).checked_sub(1)
            } else {
                index.checked_sub(1)
            };
            let question = previous
                .and_then(|prior| turns.get(prior))
                .map(|answer| answer.prompt())
                .unwrap_or(&metadata.opening_question);
            answers.push(WrapupAnswer {
                sequence: index + 1,
                question: question.chars().take(500).collect(),
                transcript,
            });
        }
        answers.reverse();
        Ok(answers)
    }

    pub(crate) fn complete_wrapup(
        &mut self,
        session_id: u64,
        result: &Result<WrapupResult, ProviderError>,
    ) -> rusqlite::Result<bool> {
        let (state, result_json, error_json) = match result {
            Ok(value) => ("ready", Some(encode(value)?), None),
            Err(error) => ("failed", None, Some(encode(error)?)),
        };
        Ok(self.connection.execute(
            "UPDATE session_wrapups SET state = ?2, result_json = ?3, error_json = ?4 WHERE session_id = ?1 AND state = 'pending'",
            params![to_sql_id(session_id)?, state, result_json, error_json],
        )? == 1)
    }

    /// Only explicit retry restarts failed work. Old finished sessions may opt in too.
    pub(crate) fn retry_wrapup(&mut self, session_id: u64) -> rusqlite::Result<bool> {
        Ok(self.connection.execute(
            "INSERT INTO session_wrapups (session_id, state)
             SELECT id, 'pending' FROM sessions WHERE id = ?1 AND ended_at IS NOT NULL
             ON CONFLICT(session_id) DO UPDATE SET state = 'pending', result_json = NULL, error_json = NULL
             WHERE session_wrapups.state = 'failed'",
            [to_sql_id(session_id)?],
        )? == 1)
    }
}

fn decode<T: serde::de::DeserializeOwned>(value: String) -> rusqlite::Result<T> {
    serde_json::from_str(&value).map_err(|error| {
        rusqlite::Error::FromSqlConversionFailure(0, rusqlite::types::Type::Text, Box::new(error))
    })
}
fn encode<T: serde::Serialize>(value: &T) -> rusqlite::Result<String> {
    serde_json::to_string(value)
        .map_err(|error| rusqlite::Error::ToSqlConversionFailure(Box::new(error)))
}

#[cfg(test)]
#[path = "wrapup_generation_tests.rs"]
mod tests;
