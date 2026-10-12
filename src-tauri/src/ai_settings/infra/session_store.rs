use crate::ai_settings::{domain::AiSettings, error::AiSettingsError, ports::AiSettingsStore};
use crate::conversation::SessionStore;

pub struct SessionSettingsStore {
    sessions: SessionStore,
}

impl SessionSettingsStore {
    pub fn new(sessions: SessionStore) -> Self {
        Self { sessions }
    }
}

impl AiSettingsStore for SessionSettingsStore {
    fn load(&self) -> Result<Option<AiSettings>, AiSettingsError> {
        self.sessions
            .stored_ai_settings()
            .map_err(|source| AiSettingsError::Storage {
                operation: "read",
                source: Box::new(source),
            })
    }

    fn save(&self, settings: &AiSettings) -> Result<(), AiSettingsError> {
        self.sessions
            .store_ai_settings(settings)
            .map_err(|source| AiSettingsError::Storage {
                operation: "save",
                source: Box::new(source),
            })
    }
}
