use crate::conversation::SessionStore;
use crate::personal_profile::PersonalProfile;

impl SessionStore {
    pub(crate) fn stored_personal_profile(&self) -> rusqlite::Result<PersonalProfile> {
        self.lock().database.get_personal_profile()
    }

    pub(crate) fn store_personal_profile(&self, profile: &PersonalProfile) -> rusqlite::Result<()> {
        self.lock().database.save_personal_profile(profile)
    }
}
