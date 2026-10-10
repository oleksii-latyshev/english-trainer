use super::{database_error, SessionStore};
use crate::providers::{
    parse_wrapup_result, ProviderError, ProviderErrorCode, WrapupRequest, WrapupResult,
};
use serde::Serialize;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(tag = "state", rename_all = "snake_case")]
pub enum WrapupPreparation {
    Legacy,
    Pending,
    Ready,
    Failed { error: ProviderError },
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct SavedWrapupPhrases {
    pub cards: Vec<crate::learning::PhraseCardRecord>,
    pub created_ids: Vec<u64>,
}

impl SessionStore {
    pub fn save_wrapup_phrases(
        &self,
        session_id: u64,
        phrases: &[String],
    ) -> Result<SavedWrapupPhrases, ProviderError> {
        let state = self.lock();
        if state
            .active
            .as_ref()
            .is_some_and(|active| active.id == session_id)
            || phrases.is_empty()
            || phrases.len() > 3
        {
            return Err(invalid_save());
        }
        let available = super::wrapup::build(&state.database, session_id)
            .map_err(database_error)?
            .phrases;
        let mut selected = Vec::new();
        let mut unique = std::collections::HashSet::new();
        for phrase in phrases {
            if !unique.insert(phrase) {
                return Err(invalid_save());
            }
            let item = available
                .iter()
                .find(|item| &item.phrase == phrase)
                .ok_or_else(invalid_save)?;
            selected.push(item.clone());
        }
        state
            .database
            .save_wrapup_phrase_cards(session_id, &selected)
            .map_err(database_error)
    }
    pub(super) fn next_wrapup_request(
        &self,
    ) -> Result<Option<(u64, WrapupRequest)>, ProviderError> {
        let state = self.lock();
        let Some(id) = state.database.next_wrapup_id().map_err(database_error)? else {
            return Ok(None);
        };
        let answers = state.database.wrapup_answers(id).map_err(database_error)?;
        Ok(Some((id, WrapupRequest { answers })))
    }

    pub(super) fn complete_session_wrapup(
        &self,
        session_id: u64,
        request: &WrapupRequest,
        result: Result<WrapupResult, ProviderError>,
    ) -> Result<bool, ProviderError> {
        // Any future adapter must satisfy the same provenance contract before learning content is saved.
        let checked = result.and_then(|value| {
            if request.answers.is_empty() && value.phrases.is_empty() {
                return Ok(value);
            }
            let raw = serde_json::to_string(&value).map_err(|_| {
                ProviderError::new(
                    ProviderErrorCode::InvalidOutput,
                    "Could not check the session phrases. Retry preparation.",
                )
            })?;
            parse_wrapup_result(&raw, request)
        });
        let mut state = self.lock();
        let checked = checked.and_then(|mut result| {
            let saved = state.database.saved_phrase_keys().map_err(database_error)?;
            result
                .phrases
                .retain(|item| !saved.contains(&crate::learning::normalize_phrase(&item.phrase)));
            Ok(result)
        });
        state
            .database
            .complete_wrapup(session_id, &checked)
            .map_err(database_error)
    }

    pub fn retry_session_wrapup(&self, session_id: u64) -> Result<(), ProviderError> {
        if self
            .lock()
            .database
            .retry_wrapup(session_id)
            .map_err(database_error)?
        {
            return Ok(());
        }
        Err(ProviderError::new(ProviderErrorCode::InvalidRequest,
            "Session phrases are already preparing or ready. Finish a session before preparing its phrases."))
    }
}

fn invalid_save() -> ProviderError {
    ProviderError::new(ProviderErrorCode::InvalidRequest,
        "Could not save these session phrases. Choose up to three phrases from the finished wrap-up and retry.")
}

#[cfg(test)]
#[path = "wrapup_generation_tests.rs"]
mod tests;
