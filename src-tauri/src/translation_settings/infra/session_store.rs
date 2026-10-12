use crate::conversation::SessionStore;
use crate::translation::{NativeLanguageSettings, TranslationError};
use crate::translation_settings::{error::TranslationSettingsError, ports::NativeLanguageStore};

pub struct SessionLanguageStore {
    sessions: SessionStore,
}

impl SessionLanguageStore {
    pub fn new(sessions: SessionStore) -> Self {
        Self { sessions }
    }
}

fn storage(operation: &'static str) -> impl FnOnce(TranslationError) -> TranslationSettingsError {
    move |source| TranslationSettingsError::Storage {
        operation,
        source: Box::new(source),
    }
}

impl NativeLanguageStore for SessionLanguageStore {
    fn load(&self) -> Result<NativeLanguageSettings, TranslationSettingsError> {
        self.sessions
            .translation_settings()
            .map_err(storage("read"))
    }

    fn save(
        &self,
        settings: &NativeLanguageSettings,
    ) -> Result<NativeLanguageSettings, TranslationSettingsError> {
        self.sessions
            .save_translation_settings(settings.clone())
            .map_err(storage("save"))
    }
}
