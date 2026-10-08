use super::SessionStore;
use crate::api_usage::{now_ms, ApiUsageOverview, UsageEvent};
use crate::providers::{ProviderError, ProviderErrorCode};

impl SessionStore {
    pub fn record_api_usage(&self, event: &UsageEvent) -> rusqlite::Result<()> {
        self.lock().database.record_api_usage(event)
    }

    pub fn api_usage_overview(&self) -> Result<ApiUsageOverview, ProviderError> {
        self.lock()
            .database
            .api_usage_overview(now_ms())
            .map_err(|_| {
                ProviderError::new(
                    ProviderErrorCode::DatabaseError,
                    "Could not read the usage counts saved on this Mac. Please retry.",
                )
            })
    }
}
