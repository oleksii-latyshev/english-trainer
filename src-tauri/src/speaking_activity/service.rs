use super::{
    domain::{speaking_day, window_start_ms, SpeakingActivity},
    error::SpeakingActivityError,
    ports::ActivityStore,
};
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Clone)]
pub struct SpeakingActivityService {
    store: Arc<dyn ActivityStore>,
    now_ms: fn() -> i64,
}

impl SpeakingActivityService {
    pub fn new(store: impl ActivityStore + 'static) -> Self {
        Self::with_clock(store, now_ms)
    }

    fn with_clock(store: impl ActivityStore + 'static, now_ms: fn() -> i64) -> Self {
        Self {
            store: Arc::new(store),
            now_ms,
        }
    }

    pub fn overview(&self) -> Result<SpeakingActivity, SpeakingActivityError> {
        let rows = self
            .store
            .active_ms_by_day(window_start_ms((self.now_ms)()))?;
        Ok(SpeakingActivity {
            days: rows
                .into_iter()
                .filter_map(|(date, active_ms)| speaking_day(date, active_ms))
                .collect(),
        })
    }
}

fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |elapsed| {
            i64::try_from(elapsed.as_millis()).unwrap_or(i64::MAX)
        })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::speaking_activity::domain::{SpeakingDay, DAY_MS, WINDOW_DAYS};
    use std::sync::Mutex;

    #[derive(Clone, Default)]
    struct FakeStore {
        rows: Vec<(String, u64)>,
        asked_since: Arc<Mutex<Vec<i64>>>,
        failing: bool,
    }

    impl ActivityStore for FakeStore {
        fn active_ms_by_day(
            &self,
            since_ms: i64,
        ) -> Result<Vec<(String, u64)>, SpeakingActivityError> {
            self.asked_since.lock().unwrap().push(since_ms);
            if self.failing {
                return Err(SpeakingActivityError::Storage {
                    operation: "read",
                    source: Box::new(std::io::Error::other("disk")),
                });
            }
            Ok(self.rows.clone())
        }
    }

    fn fixed_clock() -> i64 {
        WINDOW_DAYS * DAY_MS + 1_000
    }

    #[test]
    fn days_are_reported_in_whole_minutes_and_empty_days_dropped() {
        let store = FakeStore {
            rows: vec![
                ("2026-10-08".into(), 600_000),
                ("2026-10-09".into(), 10_000),
                ("2026-10-10".into(), 150_000),
            ],
            ..FakeStore::default()
        };
        let days = SpeakingActivityService::with_clock(store, fixed_clock)
            .overview()
            .unwrap()
            .days;
        assert_eq!(
            days,
            [
                SpeakingDay {
                    date: "2026-10-08".into(),
                    minutes: 10
                },
                SpeakingDay {
                    date: "2026-10-10".into(),
                    minutes: 3
                },
            ]
        );
    }

    #[test]
    fn only_the_recent_window_is_requested() {
        let store = FakeStore::default();
        let asked = store.asked_since.clone();
        SpeakingActivityService::with_clock(store, fixed_clock)
            .overview()
            .unwrap();
        assert_eq!(*asked.lock().unwrap(), [1_000]);
    }

    #[test]
    fn a_storage_failure_is_returned() {
        let store = FakeStore {
            failing: true,
            ..FakeStore::default()
        };
        let result = SpeakingActivityService::with_clock(store, fixed_clock).overview();
        assert!(matches!(result, Err(SpeakingActivityError::Storage { .. })));
    }
}
