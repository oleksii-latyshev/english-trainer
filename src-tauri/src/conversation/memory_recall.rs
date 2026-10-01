use super::{database_error, SessionStore};
use crate::learning::{LearningItemType, MemoryRecallResult, MemoryReviewRun};
use crate::providers::{ProviderError, ProviderErrorCode};

impl SessionStore {
    pub fn start_memory_review(&self) -> Result<Option<MemoryReviewRun>, ProviderError> {
        let mut state = self.lock();
        state
            .database
            .start_memory_review_run()
            .map_err(database_error)
    }

    pub fn get_memory_review(&self) -> Result<Option<MemoryReviewRun>, ProviderError> {
        let state = self.lock();
        state
            .database
            .active_memory_review_run()
            .map_err(database_error)
    }

    pub fn submit_memory_recall(
        &self,
        run_id: u64,
        item_type: LearningItemType,
        item_id: u64,
        transcript: String,
    ) -> Result<MemoryRecallResult, ProviderError> {
        validate_memory_id(run_id)?;
        validate_memory_id(item_id)?;
        let mut state = self.lock();
        state
            .database
            .record_memory_recall(run_id, item_type, item_id, &transcript)
    }

    pub fn finish_memory_review(&self, run_id: u64) -> Result<bool, ProviderError> {
        validate_memory_id(run_id)?;
        let mut state = self.lock();
        state.database.finish_memory_review_run(run_id)
    }
}

fn validate_memory_id(value: u64) -> Result<(), ProviderError> {
    if value == 0 || value > super::MAX_SAFE_SESSION_ID {
        return Err(ProviderError::new(
            ProviderErrorCode::InvalidRequest,
            "Invalid review ID.",
        ));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn starts_and_retrieves_memory_review_run_via_store() {
        let store = SessionStore::default();
        assert_eq!(store.get_memory_review().unwrap(), None);

        // No due items => returns None without fake run
        let started = store.start_memory_review().unwrap();
        assert_eq!(started, None);
        assert_eq!(store.get_memory_review().unwrap(), None);
    }
}
