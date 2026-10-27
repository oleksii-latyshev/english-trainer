use super::SessionStore;
use crate::conversation::domain::SavedWrapupPhrases;
use crate::conversation::error::ConversationError;
use crate::core::IpcError;
use crate::providers::{parse_wrapup_result, ProviderError, WrapupRequest, WrapupResult};

impl SessionStore {
    pub fn save_wrapup_phrases(
        &self,
        session_id: u64,
        phrases: &[String],
    ) -> Result<SavedWrapupPhrases, ConversationError> {
        let state = self.lock();
        if state
            .active
            .as_ref()
            .is_some_and(|active| active.id == session_id)
            || phrases.is_empty()
            || phrases.len() > 3
        {
            return Err(ConversationError::WrapupSaveInvalid);
        }
        let available = super::wrapup::build(&state.database, session_id)?.phrases;
        let mut selected = Vec::new();
        let mut unique = std::collections::HashSet::new();
        for phrase in phrases {
            if !unique.insert(phrase) {
                return Err(ConversationError::WrapupSaveInvalid);
            }
            let item = available
                .iter()
                .find(|item| &item.phrase == phrase)
                .ok_or(ConversationError::WrapupSaveInvalid)?;
            selected.push(item.clone());
        }
        state
            .database
            .save_wrapup_phrase_cards(session_id, &selected)
            .map_err(ConversationError::from)
    }
    pub(super) fn next_wrapup_request(
        &self,
    ) -> Result<Option<(u64, WrapupRequest)>, ConversationError> {
        let state = self.lock();
        let Some(id) = state.database.next_wrapup_id()? else {
            return Ok(None);
        };
        let answers = state.database.wrapup_answers(id)?;
        Ok(Some((id, WrapupRequest { answers })))
    }

    pub(super) fn complete_session_wrapup(
        &self,
        session_id: u64,
        request: &WrapupRequest,
        result: Result<WrapupResult, ProviderError>,
    ) -> Result<bool, ConversationError> {
        let checked = result.map_err(IpcError::from).and_then(|value| {
            if request.answers.is_empty() && value.phrases.is_empty() {
                return Ok(value);
            }
            let raw = serde_json::to_string(&value).map_err(|_| {
                IpcError::new(
                    crate::core::IpcErrorCode::InvalidOutput,
                    "Could not check the session phrases. Retry preparation.",
                )
            })?;
            parse_wrapup_result(&raw, request).map_err(IpcError::from)
        });
        let mut state = self.lock();
        let checked = checked.and_then(|mut result| {
            let saved = state
                .database
                .saved_phrase_keys()
                .map_err(|error| IpcError::from(ConversationError::from(error)))?;
            result
                .phrases
                .retain(|item| !saved.contains(&crate::learning::normalize_phrase(&item.phrase)));
            Ok(result)
        });
        state
            .database
            .complete_wrapup(session_id, &checked)
            .map_err(ConversationError::from)
    }

    pub fn retry_session_wrapup(&self, session_id: u64) -> Result<(), ConversationError> {
        if self.lock().database.retry_wrapup(session_id)? {
            return Ok(());
        }
        Err(ConversationError::WrapupNotRetryable)
    }
}

#[cfg(test)]
#[path = "wrapup_generation_tests.rs"]
mod tests;
