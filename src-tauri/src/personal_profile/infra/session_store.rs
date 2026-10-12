use crate::conversation::SessionStore;
use crate::personal_profile::{
    domain::PersonalProfile, error::PersonalProfileError, ports::PersonalProfileStore,
};

pub struct SessionProfileStore {
    sessions: SessionStore,
}

impl SessionProfileStore {
    pub fn new(sessions: SessionStore) -> Self {
        Self { sessions }
    }
}

fn storage(operation: &'static str) -> impl FnOnce(rusqlite::Error) -> PersonalProfileError {
    move |source| PersonalProfileError::Storage {
        operation,
        source: Box::new(source),
    }
}

impl PersonalProfileStore for SessionProfileStore {
    fn load(&self) -> Result<PersonalProfile, PersonalProfileError> {
        self.sessions
            .stored_personal_profile()
            .map_err(storage("read"))
    }

    fn save(&self, profile: &PersonalProfile) -> Result<(), PersonalProfileError> {
        self.sessions
            .store_personal_profile(profile)
            .map_err(storage("save"))
    }
}
