use super::{domain::PersonalProfile, error::PersonalProfileError, ports::PersonalProfileStore};
use std::sync::Arc;

#[derive(Clone)]
pub struct PersonalProfileService {
    store: Arc<dyn PersonalProfileStore>,
}

impl PersonalProfileService {
    pub fn new(store: impl PersonalProfileStore + 'static) -> Self {
        Self {
            store: Arc::new(store),
        }
    }

    pub fn get(&self) -> Result<PersonalProfile, PersonalProfileError> {
        self.store.load()
    }

    pub fn save(&self, profile: PersonalProfile) -> Result<PersonalProfile, PersonalProfileError> {
        let profile = profile.trimmed();
        if let Some(field) = profile.first_field_over_limit() {
            return Err(PersonalProfileError::FieldTooLong { field });
        }
        self.store.save(&profile)?;
        Ok(profile)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Mutex;

    #[derive(Clone, Default)]
    struct FakeStore {
        saved: Arc<Mutex<PersonalProfile>>,
        failing: bool,
    }

    impl PersonalProfileStore for FakeStore {
        fn load(&self) -> Result<PersonalProfile, PersonalProfileError> {
            if self.failing {
                return Err(storage_failure());
            }
            Ok(self.saved.lock().unwrap().clone())
        }

        fn save(&self, profile: &PersonalProfile) -> Result<(), PersonalProfileError> {
            if self.failing {
                return Err(storage_failure());
            }
            *self.saved.lock().unwrap() = profile.clone();
            Ok(())
        }
    }

    fn storage_failure() -> PersonalProfileError {
        PersonalProfileError::Storage {
            operation: "read",
            source: Box::new(std::io::Error::other("disk")),
        }
    }

    fn engineer() -> PersonalProfile {
        PersonalProfile {
            name: "  Oleksii ".into(),
            role: "  Engineer  ".into(),
            stack: "Rust, Tauri".into(),
            interests: "hiking".into(),
            goals: "Speak more naturally".into(),
        }
    }

    #[test]
    fn nothing_saved_reads_as_an_empty_profile() {
        let service = PersonalProfileService::new(FakeStore::default());
        assert_eq!(service.get().unwrap(), PersonalProfile::default());
    }

    #[test]
    fn saving_trims_persists_and_returns_the_profile() {
        let service = PersonalProfileService::new(FakeStore::default());
        let saved = service.save(engineer()).unwrap();
        assert_eq!(saved.name, "Oleksii");
        assert_eq!(saved.role, "Engineer");
        assert_eq!(service.get().unwrap(), saved);
    }

    #[test]
    fn an_empty_profile_clears_what_was_saved() {
        let service = PersonalProfileService::new(FakeStore::default());
        service.save(engineer()).unwrap();
        service.save(PersonalProfile::default()).unwrap();
        assert_eq!(service.get().unwrap(), PersonalProfile::default());
    }

    #[test]
    fn an_over_long_field_is_rejected_and_nothing_is_stored() {
        let service = PersonalProfileService::new(FakeStore::default());
        let rejected = service.save(PersonalProfile {
            role: "x".repeat(151),
            ..Default::default()
        });
        assert!(matches!(
            rejected,
            Err(PersonalProfileError::FieldTooLong { field: "Role" })
        ));
        assert_eq!(service.get().unwrap(), PersonalProfile::default());
    }

    #[test]
    fn an_over_long_name_is_rejected() {
        let service = PersonalProfileService::new(FakeStore::default());
        let rejected = service.save(PersonalProfile {
            name: "x".repeat(41),
            ..Default::default()
        });
        assert!(matches!(
            rejected,
            Err(PersonalProfileError::FieldTooLong { field: "Name" })
        ));
    }

    #[test]
    fn a_failing_store_fails_every_use_case() {
        let store = FakeStore {
            failing: true,
            ..FakeStore::default()
        };
        let service = PersonalProfileService::new(store);
        assert!(service.get().is_err());
        assert!(service.save(engineer()).is_err());
    }
}
