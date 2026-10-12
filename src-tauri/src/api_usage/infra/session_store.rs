use crate::api_usage::{
    domain::{ApiUsageOverview, UsageEvent},
    error::ApiUsageError,
    ports::UsageStore,
};
use crate::conversation::SessionStore;

pub struct SessionUsageStore {
    sessions: SessionStore,
}

impl SessionUsageStore {
    pub fn new(sessions: SessionStore) -> Self {
        Self { sessions }
    }
}

impl UsageStore for SessionUsageStore {
    fn record(&self, event: &UsageEvent) -> Result<(), ApiUsageError> {
        self.sessions
            .record_api_usage(event)
            .map_err(|source| ApiUsageError::Storage {
                operation: "save",
                source: Box::new(source),
            })
    }

    fn overview(&self, now_ms: i64) -> Result<ApiUsageOverview, ApiUsageError> {
        self.sessions
            .api_usage_overview(now_ms)
            .map_err(|source| ApiUsageError::Storage {
                operation: "read",
                source: Box::new(source),
            })
    }
}
