use crate::conversation::SessionStore;
use crate::speaking_activity::{error::SpeakingActivityError, ports::ActivityStore};

pub struct SessionActivityStore {
    sessions: SessionStore,
}

impl SessionActivityStore {
    pub fn new(sessions: SessionStore) -> Self {
        Self { sessions }
    }
}

impl ActivityStore for SessionActivityStore {
    fn active_ms_by_day(&self, since_ms: i64) -> Result<Vec<(String, u64)>, SpeakingActivityError> {
        self.sessions
            .active_ms_by_day(since_ms)
            .map_err(|source| SpeakingActivityError::Storage {
                operation: "read",
                source: Box::new(source),
            })
    }
}
