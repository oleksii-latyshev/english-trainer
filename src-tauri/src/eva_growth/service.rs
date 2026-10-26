use super::{
    domain::{grow, EvaGrowth},
    error::EvaGrowthError,
    ports::GrowthStore,
};
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Clone)]
pub struct EvaGrowthService {
    store: Arc<dyn GrowthStore>,
    now_ms: fn() -> i64,
}

impl EvaGrowthService {
    pub fn new(store: impl GrowthStore + 'static) -> Self {
        Self::with_clock(store, now_ms)
    }

    fn with_clock(store: impl GrowthStore + 'static, now_ms: fn() -> i64) -> Self {
        Self {
            store: Arc::new(store),
            now_ms,
        }
    }

    pub fn growth(&self) -> Result<EvaGrowth, EvaGrowthError> {
        Ok(grow(&self.store.activity((self.now_ms)())?))
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
    use crate::eva_growth::domain::{GrowthActivity, SpokenSession};

    struct FakeStore {
        sessions: Vec<SpokenSession>,
        failing: bool,
    }

    impl GrowthStore for FakeStore {
        fn activity(&self, _now_ms: i64) -> Result<GrowthActivity, EvaGrowthError> {
            if self.failing {
                return Err(EvaGrowthError::Storage {
                    operation: "read",
                    source: Box::new(std::io::Error::other("disk")),
                });
            }
            Ok(GrowthActivity {
                sessions: self.sessions.clone(),
                sunshine: Vec::new(),
            })
        }
    }

    fn clock() -> i64 {
        0
    }

    #[test]
    fn the_stored_activity_becomes_growth() {
        let store = FakeStore {
            sessions: vec![SpokenSession {
                session_id: 1,
                days_ago: 0,
                active_ms: 600_000,
                topic: "Travel".into(),
            }],
            failing: false,
        };
        let growth = EvaGrowthService::with_clock(store, clock).growth().unwrap();
        assert_eq!(growth.drops, 10);
        assert_eq!(growth.stage, 1);
    }

    #[test]
    fn a_storage_failure_is_returned() {
        let store = FakeStore {
            sessions: Vec::new(),
            failing: true,
        };
        let result = EvaGrowthService::with_clock(store, clock).growth();
        assert!(matches!(result, Err(EvaGrowthError::Storage { .. })));
    }
}
