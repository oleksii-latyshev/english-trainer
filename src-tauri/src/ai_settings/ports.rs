use super::{domain::AiSettings, error::AiSettingsError};

pub trait AiSettingsStore: Send + Sync {
    fn load(&self) -> Result<Option<AiSettings>, AiSettingsError>;
    fn save(&self, settings: &AiSettings) -> Result<(), AiSettingsError>;
}

pub trait ProviderWarmup: Send + Sync {
    fn warm(&self, settings: &AiSettings) -> Result<(), AiSettingsError>;
}
