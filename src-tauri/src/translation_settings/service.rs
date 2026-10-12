use super::{
    error::TranslationSettingsError,
    ports::{LanguageAvailability, NativeLanguageStore},
};
use crate::translation::{validate_native_language, NativeLanguageSettings, TranslationStatus};
use std::sync::Arc;

#[derive(Clone)]
pub struct TranslationSettingsService {
    store: Arc<dyn NativeLanguageStore>,
    availability: Arc<dyn LanguageAvailability>,
}

impl TranslationSettingsService {
    pub fn new(
        store: impl NativeLanguageStore + 'static,
        availability: impl LanguageAvailability + 'static,
    ) -> Self {
        Self {
            store: Arc::new(store),
            availability: Arc::new(availability),
        }
    }

    pub fn get(&self) -> Result<NativeLanguageSettings, TranslationSettingsError> {
        self.store.load()
    }

    pub fn save(
        &self,
        settings: NativeLanguageSettings,
    ) -> Result<NativeLanguageSettings, TranslationSettingsError> {
        validate_native_language(&settings.native_language)
            .map_err(|_| TranslationSettingsError::UnsupportedLanguage)?;
        self.store.save(&settings)
    }

    pub fn status(&self) -> Result<TranslationStatus, TranslationSettingsError> {
        let settings = self.store.load()?;
        self.availability.status(&settings.native_language)
    }

    pub fn prepare(&self) -> Result<TranslationStatus, TranslationSettingsError> {
        let settings = self.store.load()?;
        self.availability.prepare(&settings.native_language)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Mutex;

    #[derive(Clone)]
    struct FakeStore {
        language: Arc<Mutex<String>>,
        failing: bool,
    }

    impl FakeStore {
        fn new(language: &str) -> Self {
            Self {
                language: Arc::new(Mutex::new(language.to_string())),
                failing: false,
            }
        }
    }

    impl NativeLanguageStore for FakeStore {
        fn load(&self) -> Result<NativeLanguageSettings, TranslationSettingsError> {
            if self.failing {
                return Err(storage_failure());
            }
            Ok(NativeLanguageSettings {
                native_language: self.language.lock().unwrap().clone(),
            })
        }

        fn save(
            &self,
            settings: &NativeLanguageSettings,
        ) -> Result<NativeLanguageSettings, TranslationSettingsError> {
            if self.failing {
                return Err(storage_failure());
            }
            *self.language.lock().unwrap() = settings.native_language.clone();
            Ok(settings.clone())
        }
    }

    #[derive(Clone, Default)]
    struct RecordingAvailability {
        asked: Arc<Mutex<Vec<String>>>,
    }

    impl LanguageAvailability for RecordingAvailability {
        fn status(
            &self,
            native_language: &str,
        ) -> Result<TranslationStatus, TranslationSettingsError> {
            self.asked
                .lock()
                .unwrap()
                .push(format!("status:{native_language}"));
            Ok(status(native_language))
        }

        fn prepare(
            &self,
            native_language: &str,
        ) -> Result<TranslationStatus, TranslationSettingsError> {
            self.asked
                .lock()
                .unwrap()
                .push(format!("prepare:{native_language}"));
            Ok(status(native_language))
        }
    }

    fn status(native_language: &str) -> TranslationStatus {
        serde_json::from_value(serde_json::json!({
            "native_language": native_language,
            "status": "installed",
            "message": "Ready.",
        }))
        .unwrap()
    }

    fn storage_failure() -> TranslationSettingsError {
        TranslationSettingsError::Storage {
            operation: "read",
            source: Box::new(std::io::Error::other("disk")),
        }
    }

    fn service(
        store: FakeStore,
        availability: RecordingAvailability,
    ) -> TranslationSettingsService {
        TranslationSettingsService::new(store, availability)
    }

    #[test]
    fn saving_a_supported_language_persists_and_returns_it() {
        let service = service(FakeStore::new("ru"), RecordingAvailability::default());
        let saved = service
            .save(NativeLanguageSettings {
                native_language: "de".into(),
            })
            .unwrap();
        assert_eq!(saved.native_language, "de");
        assert_eq!(service.get().unwrap().native_language, "de");
    }

    #[test]
    fn saving_an_unsupported_language_is_rejected_and_keeps_the_saved_one() {
        let service = service(FakeStore::new("ru"), RecordingAvailability::default());
        let rejected = service.save(NativeLanguageSettings {
            native_language: "xx".into(),
        });
        assert!(matches!(
            rejected,
            Err(TranslationSettingsError::UnsupportedLanguage)
        ));
        assert_eq!(service.get().unwrap().native_language, "ru");
    }

    #[test]
    fn status_and_prepare_use_the_saved_language() {
        let availability = RecordingAvailability::default();
        let asked = availability.asked.clone();
        let service = service(FakeStore::new("uk"), availability);
        assert_eq!(service.status().unwrap().native_language, "uk");
        service.prepare().unwrap();
        assert_eq!(*asked.lock().unwrap(), ["status:uk", "prepare:uk"]);
    }

    #[test]
    fn a_failing_store_fails_every_use_case() {
        let store = FakeStore {
            failing: true,
            ..FakeStore::new("ru")
        };
        let service = service(store, RecordingAvailability::default());
        assert!(service.get().is_err());
        assert!(service
            .save(NativeLanguageSettings {
                native_language: "de".into()
            })
            .is_err());
        assert!(service.status().is_err());
        assert!(service.prepare().is_err());
    }
}
