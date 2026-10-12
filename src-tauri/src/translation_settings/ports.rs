use super::error::TranslationSettingsError;
use crate::translation::{NativeLanguageSettings, TranslationStatus};

pub trait NativeLanguageStore: Send + Sync {
    fn load(&self) -> Result<NativeLanguageSettings, TranslationSettingsError>;
    fn save(
        &self,
        settings: &NativeLanguageSettings,
    ) -> Result<NativeLanguageSettings, TranslationSettingsError>;
}

pub trait LanguageAvailability: Send + Sync {
    fn status(&self, native_language: &str) -> Result<TranslationStatus, TranslationSettingsError>;
    fn prepare(&self, native_language: &str)
        -> Result<TranslationStatus, TranslationSettingsError>;
}
