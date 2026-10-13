use super::error::SpeakingActivityError;

pub trait ActivityStore: Send + Sync {
    fn active_ms_by_day(&self, since_ms: i64) -> Result<Vec<(String, u64)>, SpeakingActivityError>;
}
