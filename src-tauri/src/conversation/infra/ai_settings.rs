use crate::ai_settings::AiSettings;
use crate::conversation::SessionStore;

impl SessionStore {
    pub(crate) fn stored_ai_settings(&self) -> rusqlite::Result<Option<AiSettings>> {
        self.lock().database.stored_ai_settings()
    }

    pub(crate) fn store_ai_settings(&self, settings: &AiSettings) -> rusqlite::Result<()> {
        self.lock().database.save_ai_settings(settings)
    }
}
