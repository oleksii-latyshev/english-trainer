use super::SessionStore;

impl SessionStore {
    pub(crate) fn active_ms_by_day(&self, since_ms: i64) -> rusqlite::Result<Vec<(String, u64)>> {
        self.lock().database.active_ms_by_day(since_ms)
    }
}
