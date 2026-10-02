use super::SessionStore;
use crate::providers::{AiSettings, ProviderError, ProviderErrorCode};

impl SessionStore {
    pub fn ai_settings(&self) -> Result<AiSettings, ProviderError> {
        self.lock().database.ai_settings().map_err(settings_error)
    }

    pub fn save_ai_settings(&self, settings: AiSettings) -> Result<AiSettings, ProviderError> {
        self.lock()
            .database
            .save_ai_settings(&settings)
            .map_err(settings_error)?;
        Ok(settings)
    }
}

fn settings_error(_: rusqlite::Error) -> ProviderError {
    ProviderError::new(
        ProviderErrorCode::DatabaseError,
        "Could not read or save conversation settings locally. Please retry.",
    )
}
