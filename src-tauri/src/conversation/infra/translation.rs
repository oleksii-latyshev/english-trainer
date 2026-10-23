use crate::conversation::SessionStore;
use crate::learning::{now_ms, record_cue_exposure};
use crate::translation::{
    validate_request, NativeLanguageSettings, TranslationError, TranslationRequest,
};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PreparedTranslation {
    pub request: TranslationRequest,
    pub native_language: String,
}

impl SessionStore {
    pub fn translation_settings(&self) -> Result<NativeLanguageSettings, TranslationError> {
        self.lock().database.translation_settings()
    }

    pub fn save_translation_settings(
        &self,
        settings: NativeLanguageSettings,
    ) -> Result<NativeLanguageSettings, TranslationError> {
        self.lock().database.save_translation_settings(settings)
    }

    pub fn prepare_translation_lookup(
        &self,
        mut request: TranslationRequest,
    ) -> Result<PreparedTranslation, TranslationError> {
        validate_request(&mut request)?;
        let state = self.lock();
        let settings = state.database.translation_settings()?;
        if let Some(session_id) = state.active.as_ref().map(|session| session.id) {
            record_cue_exposure(
                state.database.connection(),
                session_id,
                None,
                None,
                now_ms(),
            )
            .map_err(|_| TranslationError::database())?;
        }
        Ok(PreparedTranslation {
            request,
            native_language: settings.native_language,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn valid_translation_records_cue_before_helper_while_invalid_input_records_none() {
        let store = SessionStore::default();
        let session = store.start().unwrap();
        let invalid = TranslationRequest {
            word: "two words".to_string(),
            context: String::new(),
        };
        assert_eq!(
            store.prepare_translation_lookup(invalid).unwrap_err().code,
            crate::translation::TranslationErrorCode::InvalidRequest
        );
        {
            let state = store.lock();
            assert!(!state
                .database
                .has_session_cue_exposure_before(session.session_id, None, None, i64::MAX)
                .unwrap());
        }

        let prepared = store
            .prepare_translation_lookup(TranslationRequest {
                word: "resilient".to_string(),
                context: "The system remained resilient.".to_string(),
            })
            .unwrap();
        assert_eq!(prepared.native_language, "ru");
        {
            let state = store.lock();
            assert!(state
                .database
                .has_session_cue_exposure_before(session.session_id, None, None, i64::MAX)
                .unwrap());
        }
    }
}
