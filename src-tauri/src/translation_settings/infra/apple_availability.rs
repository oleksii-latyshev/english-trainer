use crate::translation::{TranslationService, TranslationStatus};
use crate::translation_settings::{error::TranslationSettingsError, ports::LanguageAvailability};

pub struct AppleLanguageAvailability {
    translation: TranslationService,
}

impl AppleLanguageAvailability {
    pub fn new(translation: TranslationService) -> Self {
        Self { translation }
    }
}

impl LanguageAvailability for AppleLanguageAvailability {
    fn status(&self, native_language: &str) -> Result<TranslationStatus, TranslationSettingsError> {
        self.translation
            .status(native_language)
            .map_err(TranslationSettingsError::Availability)
    }

    fn prepare(
        &self,
        native_language: &str,
    ) -> Result<TranslationStatus, TranslationSettingsError> {
        self.translation
            .prepare(native_language)
            .map_err(TranslationSettingsError::Availability)
    }
}
