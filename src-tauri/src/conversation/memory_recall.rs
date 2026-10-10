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

    pub fn start_memory_warmup(&self) -> Result<Option<MemoryReviewRun>, ProviderError> {
        self.lock()
            .database
            .start_memory_warmup()
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

    /// Passes on the next unanswered item without scoring it and returns the run as it stands.
    pub fn skip_memory_review_item(
        &self,
        run_id: u64,
        item_type: LearningItemType,
        item_id: u64,
    ) -> Result<MemoryReviewRun, ProviderError> {
        validate_memory_id(run_id)?;
        validate_memory_id(item_id)?;
        let mut state = self.lock();
        state
            .database
            .skip_memory_review_item(run_id, item_type, item_id)?;
        state
            .database
            .active_memory_review_run()
            .map_err(database_error)?
            .ok_or_else(|| {
                ProviderError::new(
                    ProviderErrorCode::InvalidSession,
                    "This review run no longer exists.",
                )
            })
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

    #[test]
    fn learning_item_commands_reject_invalid_ids_and_report_missing_items() {
        let store = SessionStore::default();
        assert!(!store.delete_mistake(7).unwrap());
        assert!(!store
            .archive_learning_item(LearningItemType::Phrase, 7)
            .unwrap());
        assert_eq!(
            store.delete_mistake(0).unwrap_err().code,
            ProviderErrorCode::InvalidRequest
        );
        assert_eq!(
            store
                .archive_learning_item(LearningItemType::Mistake, 0)
                .unwrap_err()
                .code,
            ProviderErrorCode::InvalidRequest
        );
        assert_eq!(
            store
                .skip_memory_review_item(1, LearningItemType::Phrase, 0)
                .unwrap_err()
                .code,
            ProviderErrorCode::InvalidRequest
        );
    }
}
