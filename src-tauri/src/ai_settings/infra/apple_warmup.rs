use crate::ai_settings::{domain::AiSettings, error::AiSettingsError, ports::ProviderWarmup};
use crate::providers::{prewarm_provider, AppleHelper};

pub struct AppleProviderWarmup {
    apple: AppleHelper,
}

impl AppleProviderWarmup {
    pub fn new(apple: AppleHelper) -> Self {
        Self { apple }
    }
}

impl ProviderWarmup for AppleProviderWarmup {
    fn warm(&self, settings: &AiSettings) -> Result<(), AiSettingsError> {
        prewarm_provider(settings, &self.apple).map_err(AiSettingsError::Provider)
    }
}
