use super::{
    domain::{ApiUsageOverview, UsageEvent},
    error::ApiUsageError,
};

pub trait UsageStore: Send + Sync {
    fn record(&self, event: &UsageEvent) -> Result<(), ApiUsageError>;
    fn overview(&self, now_ms: i64) -> Result<ApiUsageOverview, ApiUsageError>;
}
