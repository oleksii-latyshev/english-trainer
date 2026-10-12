use super::{domain::PersonalProfile, error::PersonalProfileError};

pub trait PersonalProfileStore: Send + Sync {
    fn load(&self) -> Result<PersonalProfile, PersonalProfileError>;
    fn save(&self, profile: &PersonalProfile) -> Result<(), PersonalProfileError>;
}
