use crate::api_usage::{ApiUsageOverview, UsageEvent};
use crate::conversation::SessionStore;

impl SessionStore {
    pub(crate) fn record_api_usage(&self, event: &UsageEvent) -> rusqlite::Result<()> {
        self.lock().database.record_api_usage(event)
    }

    pub(crate) fn api_usage_overview(&self, now_ms: i64) -> rusqlite::Result<ApiUsageOverview> {
        self.lock().database.api_usage_overview(now_ms)
    }
}
