use super::sqlite;
use crate::conversation::SessionStore;
use crate::learning::{
    error::LearningError,
    ports::{LearningStore, PhraseSource},
    LearningItemType, LearningMemoryView, MemoryUsageEvidence, PhraseCardRecord,
};

pub struct SessionLearningStore {
    sessions: SessionStore,
}

impl SessionLearningStore {
    pub fn new(sessions: SessionStore) -> Self {
        Self { sessions }
    }
}

fn storage(operation: &'static str) -> impl FnOnce(rusqlite::Error) -> LearningError {
    move |source| LearningError::Storage {
        operation,
        source: Box::new(source),
    }
}

impl LearningStore for SessionLearningStore {
    fn memory(&self) -> Result<LearningMemoryView, LearningError> {
        self.sessions
            .with_connection(|connection| sqlite::read_memory(connection, sqlite::now_ms()))
            .map_err(storage("read"))
    }

    fn mark_memory_shown(&self) -> Result<(), LearningError> {
        self.sessions.mark_memory_shown().map_err(storage("update"))
    }

    fn phrase_source_exists(&self, source: PhraseSource) -> Result<bool, LearningError> {
        self.sessions
            .with_connection(|connection| {
                sqlite::turn_exists(connection, source.session_id, source.sequence)
            })
            .map_err(storage("read"))
    }

    fn save_phrase(
        &self,
        phrase: &str,
        meaning_or_note: &str,
        source: Option<PhraseSource>,
    ) -> Result<PhraseCardRecord, LearningError> {
        self.sessions
            .with_connection(|connection| {
                sqlite::save_phrase_card(
                    connection,
                    phrase,
                    meaning_or_note,
                    source.map(|source| source.session_id),
                    source.map(|source| source.sequence),
                )
            })
            .map_err(storage("save"))
    }

    fn archive(&self, item_type: LearningItemType, item_id: u64) -> Result<bool, LearningError> {
        self.sessions
            .with_connection(|connection| sqlite::archive_item(connection, item_type, item_id))
            .map_err(storage("update"))
    }

    fn delete_mistake(&self, mistake_id: u64) -> Result<bool, LearningError> {
        self.sessions
            .with_connection(|connection| sqlite::delete_mistake(connection, mistake_id))
            .map_err(storage("update"))
    }

    fn delete_phrase(&self, phrase_id: u64) -> Result<bool, LearningError> {
        self.sessions
            .with_connection(|connection| sqlite::delete_phrase_card(connection, phrase_id))
            .map_err(storage("update"))
    }

    fn usage_evidence(
        &self,
        item_type: LearningItemType,
        item_id: u64,
    ) -> Result<MemoryUsageEvidence, LearningError> {
        self.sessions
            .memory_usage_evidence(item_type, item_id)
            .map_err(|error| match error {
                rusqlite::Error::QueryReturnedNoRows => LearningError::ItemNotFound,
                other => storage("read")(other),
            })
    }
}
