use super::SessionStore;
use crate::audio::SpeechSettings;
use crate::providers::{ProviderError, ProviderErrorCode};

impl SessionStore {
    pub fn speech_settings(&self) -> Result<SpeechSettings, ProviderError> {
        self.lock()
            .database
            .speech_settings()
            .map_err(settings_error)
    }

    /// Reads, changes and saves the settings under one lock, so two Settings groups that each
    /// change one field cannot overwrite each other.
    pub fn update_speech_settings(
        &self,
        change: impl FnOnce(&mut SpeechSettings),
    ) -> Result<SpeechSettings, ProviderError> {
        let state = self.lock();
        let mut settings = state.database.speech_settings().map_err(settings_error)?;
        change(&mut settings);
        state
            .database
            .save_speech_settings(&settings)
            .map_err(settings_error)?;
        Ok(settings)
    }

    pub fn glossary_terms(&self) -> Result<Vec<String>, ProviderError> {
        self.lock()
            .database
            .glossary_terms()
            .map_err(settings_error)
    }

    pub fn save_glossary_terms(&self, terms: Vec<String>) -> Result<Vec<String>, ProviderError> {
        self.lock()
            .database
            .replace_glossary_terms(&terms)
            .map_err(settings_error)?;
        Ok(terms)
    }

    /// Where the answer being recorded now will land: the open session and the sequence its turn
    /// will get. `None` outside a practice session (for example a memory review).
    pub fn next_turn_slot(&self) -> Option<(u64, usize)> {
        self.lock()
            .active
            .as_ref()
            .map(|session| (session.id, session.turns.len() + 1))
    }
}

fn settings_error(_: rusqlite::Error) -> ProviderError {
    ProviderError::new(
        ProviderErrorCode::DatabaseError,
        "Could not read or save speech settings locally. Please retry.",
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn changing_one_setting_keeps_the_other() {
        let store = SessionStore::default();
        store
            .update_speech_settings(|settings| settings.keep_raw_audio = true)
            .unwrap();
        let settings = store
            .update_speech_settings(|settings| settings.model_file = "ggml-small.en.bin".into())
            .unwrap();
        assert!(settings.keep_raw_audio);
        assert_eq!(store.speech_settings().unwrap(), settings);
    }

    #[test]
    fn the_next_turn_slot_follows_the_open_session() {
        let store = SessionStore::default();
        assert_eq!(store.next_turn_slot(), None);
        let session = store.start_session().unwrap();
        assert_eq!(store.next_turn_slot(), Some((session.session_id, 1)));
    }
}
