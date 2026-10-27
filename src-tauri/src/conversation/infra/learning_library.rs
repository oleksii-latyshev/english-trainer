use crate::conversation::SessionStore;
use crate::learning::{now_ms, record_cue_exposure};
use crate::persistence::SessionDatabase;
use rusqlite::Connection;

impl SessionStore {
    pub(crate) fn with_connection<T>(&self, work: impl FnOnce(&mut Connection) -> T) -> T {
        work(self.lock().database.connection_mut())
    }

    pub(crate) fn with_database<T>(
        &self,
        work: impl FnOnce(&mut SessionDatabase, Option<u64>) -> T,
    ) -> T {
        let mut state = self.lock();
        let active_session_id = state.active.as_ref().map(|active| active.id);
        work(&mut state.database, active_session_id)
    }

    pub(crate) fn mark_memory_shown(&self) -> rusqlite::Result<()> {
        let mut state = self.lock();
        let Some(active_id) = state.active.as_ref().map(|active| active.id) else {
            return Ok(());
        };
        record_cue_exposure(
            state.database.connection_mut(),
            active_id,
            None,
            None,
            now_ms(),
        )
    }
}

#[cfg(test)]
mod learning_facade {
    use super::SessionStore;
    use crate::learning::{
        LearningError, LearningItemType, LearningMemoryView, LearningService, MemoryReviewRun,
        PhraseCardRecord, ReviewService, SessionLearningStore, TurnUsageAssessment,
        UsageReviewService,
    };
    use crate::providers::{ProviderError, UsageReviewRequest, UsageReviewResponse};

    impl SessionStore {
        fn learning(&self) -> LearningService {
            LearningService::new(SessionLearningStore::new(self.clone()))
        }

        pub fn start_memory_review(&self) -> Result<Option<MemoryReviewRun>, LearningError> {
            ReviewService::new(SessionLearningStore::new(self.clone())).start(false)
        }

        pub fn review_memory_usage(
            &self,
            session_id: u64,
            sequence: usize,
            generate: impl FnOnce(&UsageReviewRequest) -> Result<UsageReviewResponse, ProviderError>,
        ) -> Result<TurnUsageAssessment, LearningError> {
            UsageReviewService::new(SessionLearningStore::new(self.clone()))
                .review(session_id, sequence, generate)
        }

        pub fn get_learning_memory(&self) -> Result<LearningMemoryView, LearningError> {
            self.learning().memory()
        }

        pub fn save_phrase(
            &self,
            phrase: String,
            meaning_or_note: String,
            session_id: Option<u64>,
            sequence: Option<usize>,
        ) -> Result<PhraseCardRecord, LearningError> {
            self.learning()
                .save_phrase(&phrase, &meaning_or_note, session_id, sequence)
        }

        pub fn delete_phrase(&self, phrase_id: u64) -> Result<bool, LearningError> {
            self.learning().delete_phrase(phrase_id)
        }

        pub fn delete_mistake(&self, mistake_id: u64) -> Result<bool, LearningError> {
            self.learning().delete_mistake(mistake_id)
        }

        pub fn archive_learning_item(
            &self,
            item_type: LearningItemType,
            item_id: u64,
        ) -> Result<bool, LearningError> {
            self.learning().archive(item_type, item_id)
        }
    }
}
