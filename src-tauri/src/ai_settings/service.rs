use super::{
    domain::AiSettings,
    error::AiSettingsError,
    ports::{AiSettingsStore, ProviderWarmup},
};
use std::sync::Arc;

#[derive(Clone)]
pub struct AiSettingsService {
    store: Arc<dyn AiSettingsStore>,
    warmup: Arc<dyn ProviderWarmup>,
}

impl AiSettingsService {
    pub fn new(
        store: impl AiSettingsStore + 'static,
        warmup: impl ProviderWarmup + 'static,
    ) -> Self {
        Self {
            store: Arc::new(store),
            warmup: Arc::new(warmup),
        }
    }

    pub fn get(&self) -> Result<AiSettings, AiSettingsError> {
        Ok(self.store.load()?.unwrap_or_default())
    }

    pub fn save(&self, settings: AiSettings) -> Result<AiSettings, AiSettingsError> {
        self.store.save(&settings)?;
        Ok(settings)
    }

    pub fn prewarm(&self) -> Result<(), AiSettingsError> {
        self.warmup.warm(&self.get()?)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ai_settings::domain::{AgyModel, ConversationProvider, EvaStyle};
    use std::sync::Mutex;

    #[derive(Clone, Default)]
    struct FakeStore {
        saved: Arc<Mutex<Option<AiSettings>>>,
        failing: bool,
    }

    impl AiSettingsStore for FakeStore {
        fn load(&self) -> Result<Option<AiSettings>, AiSettingsError> {
            if self.failing {
                return Err(storage_failure());
            }
            Ok(self.saved.lock().unwrap().clone())
        }

        fn save(&self, settings: &AiSettings) -> Result<(), AiSettingsError> {
            if self.failing {
                return Err(storage_failure());
            }
            *self.saved.lock().unwrap() = Some(settings.clone());
            Ok(())
        }
    }

    #[derive(Clone, Default)]
    struct RecordingWarmup {
        warmed: Arc<Mutex<Vec<AiSettings>>>,
    }

    impl ProviderWarmup for RecordingWarmup {
        fn warm(&self, settings: &AiSettings) -> Result<(), AiSettingsError> {
            self.warmed.lock().unwrap().push(settings.clone());
            Ok(())
        }
    }

    fn storage_failure() -> AiSettingsError {
        AiSettingsError::Storage {
            operation: "read",
            source: Box::new(std::io::Error::other("disk")),
        }
    }

    fn apple() -> AiSettings {
        AiSettings {
            provider: ConversationProvider::Apple,
            agy_model: AgyModel::FlashLow,
            eva_style: EvaStyle::ShortAndSimple,
        }
    }

    #[test]
    fn nothing_saved_reads_as_the_defaults() {
        let service = AiSettingsService::new(FakeStore::default(), RecordingWarmup::default());
        assert_eq!(service.get().unwrap(), AiSettings::default());
    }

    #[test]
    fn saving_returns_and_persists_the_settings() {
        let service = AiSettingsService::new(FakeStore::default(), RecordingWarmup::default());
        assert_eq!(service.save(apple()).unwrap(), apple());
        assert_eq!(service.get().unwrap(), apple());
    }

    #[test]
    fn prewarming_warms_the_saved_provider() {
        let warmup = RecordingWarmup::default();
        let warmed = warmup.warmed.clone();
        let service = AiSettingsService::new(FakeStore::default(), warmup);
        service.save(apple()).unwrap();
        service.prewarm().unwrap();
        assert_eq!(*warmed.lock().unwrap(), [apple()]);
    }

    #[test]
    fn a_failing_store_fails_every_use_case() {
        let store = FakeStore {
            failing: true,
            ..FakeStore::default()
        };
        let service = AiSettingsService::new(store, RecordingWarmup::default());
        assert!(service.get().is_err());
        assert!(service.save(apple()).is_err());
        assert!(service.prewarm().is_err());
    }
}
