use super::usage_support::now_ms;
use super::SessionStore;
use crate::learning::{LearningItemType, MemoryUsageEvidence};
use rusqlite::Connection;

impl SessionStore {
    pub(crate) fn with_connection<T>(&self, work: impl FnOnce(&mut Connection) -> T) -> T {
        work(self.lock().database.connection_mut())
    }

    pub(crate) fn mark_memory_shown(&self) -> rusqlite::Result<()> {
        let mut state = self.lock();
        let Some(active_id) = state.active.as_ref().map(|active| active.id) else {
            return Ok(());
        };
        state
            .database
            .record_session_cue_exposure(active_id, None, None, now_ms())
    }

    pub(crate) fn memory_usage_evidence(
        &self,
        item_type: LearningItemType,
        item_id: u64,
    ) -> rusqlite::Result<MemoryUsageEvidence> {
        self.lock()
            .database
            .get_memory_usage_evidence(item_type, item_id)
    }
}

#[cfg(test)]
mod learning_facade {
    use super::SessionStore;
    use crate::core::IpcError;
    use crate::learning::{
        LearningItemType, LearningMemoryView, LearningService, PhraseCardRecord,
        SessionLearningStore,
    };
    use crate::providers::ProviderError;

    impl SessionStore {
        fn learning(&self) -> LearningService {
            LearningService::new(SessionLearningStore::new(self.clone()))
        }

        pub fn get_learning_memory(&self) -> Result<LearningMemoryView, ProviderError> {
            self.learning().memory().map_err(failure)
        }

        pub fn save_phrase(
            &self,
            phrase: String,
            meaning_or_note: String,
            session_id: Option<u64>,
            sequence: Option<usize>,
        ) -> Result<PhraseCardRecord, ProviderError> {
            self.learning()
                .save_phrase(&phrase, &meaning_or_note, session_id, sequence)
                .map_err(failure)
        }

        pub fn delete_phrase(&self, phrase_id: u64) -> Result<bool, ProviderError> {
            self.learning().delete_phrase(phrase_id).map_err(failure)
        }

        pub fn delete_mistake(&self, mistake_id: u64) -> Result<bool, ProviderError> {
            self.learning().delete_mistake(mistake_id).map_err(failure)
        }

        pub fn archive_learning_item(
            &self,
            item_type: LearningItemType,
            item_id: u64,
        ) -> Result<bool, ProviderError> {
            self.learning().archive(item_type, item_id).map_err(failure)
        }
    }

    fn failure(error: crate::learning::LearningError) -> ProviderError {
        ProviderError::from(IpcError::from(error))
    }
}
