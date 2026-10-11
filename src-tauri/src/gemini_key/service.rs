use super::{
    domain::{validate_key, GeminiKeyStatus, KeySource},
    error::GeminiKeyError,
    ports::KeyStore,
};
use std::sync::{Arc, Mutex, MutexGuard, OnceLock, PoisonError};

const ENV_OVERRIDE: &str = "ENG_TRAINER_GEMINI_API_KEY";

#[derive(Clone)]
pub struct KeyService {
    inner: Arc<Inner>,
}

struct Inner {
    store: Box<dyn KeyStore>,
    env_key: fn() -> Option<String>,
    cached_key: Mutex<Option<String>>,
}

static SERVICE_FOR_PROVIDER_THREADS: OnceLock<KeyService> = OnceLock::new();

fn env_key() -> Option<String> {
    std::env::var(ENV_OVERRIDE)
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
}

impl KeyService {
    pub fn new(store: impl KeyStore + 'static) -> Self {
        Self::with_env_key(store, env_key)
    }

    fn with_env_key(store: impl KeyStore + 'static, env_key: fn() -> Option<String>) -> Self {
        Self {
            inner: Arc::new(Inner {
                store: Box::new(store),
                env_key,
                cached_key: Mutex::new(None),
            }),
        }
    }

    pub fn status(&self) -> Result<GeminiKeyStatus, GeminiKeyError> {
        if (self.inner.env_key)().is_some() {
            return Ok(GeminiKeyStatus::from_source(KeySource::Environment));
        }
        if self.inner.store.exists()? {
            return Ok(GeminiKeyStatus::from_source(KeySource::Settings));
        }
        Ok(GeminiKeyStatus::missing())
    }

    pub fn save(&self, key: &str) -> Result<(), GeminiKeyError> {
        let key = validate_key(key)?;
        self.inner.store.write(key)?;
        *self.cache() = Some(key.to_string());
        Ok(())
    }

    pub fn remove(&self) -> Result<(), GeminiKeyError> {
        self.forget_cached_key();
        self.inner.store.remove()
    }

    pub fn resolve_key(&self) -> Result<String, GeminiKeyError> {
        if let Some(key) = (self.inner.env_key)() {
            return Ok(key);
        }
        if let Some(key) = self.cache().clone() {
            return Ok(key);
        }
        let key = self.inner.store.read()?.ok_or(GeminiKeyError::Missing)?;
        *self.cache() = Some(key.clone());
        Ok(key)
    }

    pub fn forget_cached_key(&self) {
        *self.cache() = None;
    }

    fn cache(&self) -> MutexGuard<'_, Option<String>> {
        self.inner
            .cached_key
            .lock()
            .unwrap_or_else(PoisonError::into_inner)
    }
}

pub fn install(service: KeyService) {
    ignore_repeated_install(SERVICE_FOR_PROVIDER_THREADS.set(service));
}

fn ignore_repeated_install(result: Result<(), KeyService>) {
    let _ = result;
}

pub fn resolve_key() -> Result<String, GeminiKeyError> {
    match SERVICE_FOR_PROVIDER_THREADS.get() {
        Some(service) => service.resolve_key(),
        None => env_key().ok_or(GeminiKeyError::StoreNotConfigured),
    }
}

pub fn forget_cached_key() {
    if let Some(service) = SERVICE_FOR_PROVIDER_THREADS.get() {
        service.forget_cached_key();
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicUsize, Ordering};

    const KEY: &str = "AIzaSyExampleExampleExample1";

    #[derive(Default)]
    struct FakeStore {
        saved: Mutex<Option<String>>,
        reads: Arc<AtomicUsize>,
    }

    impl KeyStore for FakeStore {
        fn exists(&self) -> Result<bool, GeminiKeyError> {
            Ok(self.saved.lock().unwrap().is_some())
        }
        fn read(&self) -> Result<Option<String>, GeminiKeyError> {
            self.reads.fetch_add(1, Ordering::SeqCst);
            Ok(self.saved.lock().unwrap().clone())
        }
        fn write(&self, key: &str) -> Result<(), GeminiKeyError> {
            *self.saved.lock().unwrap() = Some(key.to_string());
            Ok(())
        }
        fn remove(&self) -> Result<(), GeminiKeyError> {
            *self.saved.lock().unwrap() = None;
            Ok(())
        }
    }

    fn no_env() -> Option<String> {
        None
    }

    fn some_env() -> Option<String> {
        Some("env-key-env-key-env-key".into())
    }

    #[test]
    fn a_saved_key_is_reported_as_coming_from_settings() {
        let service = KeyService::with_env_key(FakeStore::default(), no_env);
        assert_eq!(service.status().unwrap(), GeminiKeyStatus::missing());
        service.save(&format!("  {KEY} ")).unwrap();
        assert_eq!(
            service.status().unwrap(),
            GeminiKeyStatus::from_source(KeySource::Settings)
        );
    }

    #[test]
    fn the_environment_override_wins_over_a_saved_key() {
        let service = KeyService::with_env_key(FakeStore::default(), some_env);
        service.save(KEY).unwrap();
        assert_eq!(
            service.status().unwrap(),
            GeminiKeyStatus::from_source(KeySource::Environment)
        );
        assert_eq!(service.resolve_key().unwrap(), "env-key-env-key-env-key");
    }

    #[test]
    fn an_implausible_key_is_rejected_before_it_is_stored() {
        let service = KeyService::with_env_key(FakeStore::default(), no_env);
        assert!(matches!(
            service.save("short"),
            Err(GeminiKeyError::Implausible)
        ));
        assert_eq!(service.status().unwrap(), GeminiKeyStatus::missing());
    }

    #[test]
    fn the_key_is_read_from_the_store_once_then_served_from_memory() {
        let store = FakeStore::default();
        let reads = store.reads.clone();
        *store.saved.lock().unwrap() = Some(KEY.to_string());
        let service = KeyService::with_env_key(store, no_env);
        assert_eq!(service.resolve_key().unwrap(), KEY);
        assert_eq!(service.resolve_key().unwrap(), KEY);
        assert_eq!(reads.load(Ordering::SeqCst), 1);
        service.forget_cached_key();
        assert_eq!(service.resolve_key().unwrap(), KEY);
        assert_eq!(reads.load(Ordering::SeqCst), 2);
    }

    #[test]
    fn removing_the_key_clears_both_the_file_and_the_memory_copy() {
        let service = KeyService::with_env_key(FakeStore::default(), no_env);
        service.save(KEY).unwrap();
        service.remove().unwrap();
        assert_eq!(service.status().unwrap(), GeminiKeyStatus::missing());
        assert!(matches!(
            service.resolve_key(),
            Err(GeminiKeyError::Missing)
        ));
    }
}
