use super::{
    domain::{ApiUsageOverview, UsageEvent},
    error::ApiUsageError,
    ports::UsageStore,
};
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Clone)]
pub struct ApiUsageService {
    store: Arc<dyn UsageStore>,
    now_ms: fn() -> i64,
}

impl ApiUsageService {
    pub fn new(store: impl UsageStore + 'static) -> Self {
        Self::with_clock(store, now_ms)
    }

    fn with_clock(store: impl UsageStore + 'static, now_ms: fn() -> i64) -> Self {
        Self {
            store: Arc::new(store),
            now_ms,
        }
    }

    pub fn overview(&self) -> Result<ApiUsageOverview, ApiUsageError> {
        self.store.overview((self.now_ms)())
    }

    pub fn record(&self, event: &UsageEvent) -> Result<(), ApiUsageError> {
        self.store.record(event)
    }
}

pub fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |elapsed| {
            i64::try_from(elapsed.as_millis()).unwrap_or(i64::MAX)
        })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::api_usage::domain::{AntigravityUsage, GeminiUsage, UsageSource};
    use std::sync::Mutex;

    #[derive(Clone, Default)]
    struct FakeStore {
        events: Arc<Mutex<Vec<UsageEvent>>>,
        asked_at: Arc<Mutex<Vec<i64>>>,
    }

    impl UsageStore for FakeStore {
        fn record(&self, event: &UsageEvent) -> Result<(), ApiUsageError> {
            self.events.lock().unwrap().push(event.clone());
            Ok(())
        }

        fn overview(&self, now_ms: i64) -> Result<ApiUsageOverview, ApiUsageError> {
            self.asked_at.lock().unwrap().push(now_ms);
            Ok(ApiUsageOverview {
                day: "2027-01-15".into(),
                gemini: GeminiUsage {
                    models: Vec::new(),
                    last_limit: None,
                    resets_at_ms: 0,
                },
                antigravity: AntigravityUsage {
                    requests_today: 0,
                    last_quota_error: None,
                },
            })
        }
    }

    fn fixed_clock() -> i64 {
        1_800_043_200_000
    }

    #[test]
    fn the_overview_is_asked_for_the_current_moment() {
        let store = FakeStore::default();
        let asked_at = store.asked_at.clone();
        let service = ApiUsageService::with_clock(store, fixed_clock);
        assert_eq!(service.overview().unwrap().day, "2027-01-15");
        assert_eq!(*asked_at.lock().unwrap(), [fixed_clock()]);
    }

    #[test]
    fn recorded_events_reach_the_store() {
        let store = FakeStore::default();
        let events = store.events.clone();
        let service = ApiUsageService::new(store);
        let event = UsageEvent::Request {
            source: UsageSource::Gemini,
            model: "m".into(),
            at_ms: 1,
        };
        service.record(&event).unwrap();
        assert_eq!(*events.lock().unwrap(), [event]);
    }
}
