use super::ids::{now_ms, storage};
use super::sqlite;
use super::usage;
use super::{review_answers, review_material, review_runs};
use crate::conversation::SessionStore;
use crate::learning::review_material::{ReviewMaterialRow, StoredReviewMaterial};
use crate::learning::usage_rules::UsagePreparation;
use crate::learning::{
    error::LearningError,
    ports::{LearningStore, PhraseSource, ReviewMaterialStore, ReviewRunStore, UsageStore},
    LearningItemType, LearningMemoryView, MemoryRecallResult, MemoryReviewRun, MemoryUsageEvidence,
    PhraseCardRecord, TurnUsageAssessment,
};
use crate::providers::{
    ReviewMaterialRequest, ReviewMaterialResult, UsageReviewRequest, UsageReviewResponse,
};

pub struct SessionLearningStore {
    sessions: SessionStore,
}

impl SessionLearningStore {
    pub fn new(sessions: SessionStore) -> Self {
        Self { sessions }
    }
}

impl LearningStore for SessionLearningStore {
    fn memory(&self) -> Result<LearningMemoryView, LearningError> {
        self.sessions
            .with_connection(|connection| sqlite::read_memory(connection, now_ms()))
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
            .with_connection(|connection| {
                usage::read::memory_usage_evidence(connection, item_type, item_id)
            })
            .map_err(|error| match error {
                rusqlite::Error::QueryReturnedNoRows => LearningError::ItemNotFound,
                other => storage("read")(other),
            })
    }
}

impl ReviewRunStore for SessionLearningStore {
    fn start(&self, is_warmup: bool) -> Result<Option<MemoryReviewRun>, LearningError> {
        self.sessions
            .with_connection(|connection| review_runs::start_run(connection, is_warmup))
            .map_err(storage("update"))
    }

    fn active(&self) -> Result<Option<MemoryReviewRun>, LearningError> {
        self.sessions
            .with_connection(|connection| review_runs::active_run(connection))
            .map_err(storage("read"))
    }

    fn record_recall(
        &self,
        run_id: u64,
        item_type: LearningItemType,
        item_id: u64,
        transcript: &str,
    ) -> Result<MemoryRecallResult, LearningError> {
        self.sessions.with_connection(|connection| {
            review_answers::record_recall(connection, run_id, item_type, item_id, transcript)
        })
    }

    fn skip(
        &self,
        run_id: u64,
        item_type: LearningItemType,
        item_id: u64,
    ) -> Result<MemoryReviewRun, LearningError> {
        self.sessions.with_connection(|connection| {
            review_answers::skip_item(connection, run_id, item_type, item_id)?;
            review_runs::active_run(connection)
                .map_err(storage("read"))?
                .ok_or(LearningError::Review(
                    crate::learning::review_rules::ReviewRejection::RunMissing,
                ))
        })
    }

    fn finish(&self, run_id: u64) -> Result<(), LearningError> {
        self.sessions
            .with_connection(|connection| review_answers::finish_run(connection, run_id))
    }
}

impl ReviewMaterialStore for SessionLearningStore {
    fn read(
        &self,
        run_id: u64,
    ) -> Result<(Vec<ReviewMaterialRow>, Option<StoredReviewMaterial>), LearningError> {
        self.sessions
            .with_connection(|connection| review_material::read_material(connection, run_id))
    }

    fn begin_preparation(
        &self,
        run_id: u64,
        retry: bool,
    ) -> Result<Option<ReviewMaterialRequest>, LearningError> {
        self.sessions.with_connection(|connection| {
            review_material::begin_if_unsettled(connection, run_id, retry)
        })
    }

    fn complete_preparation(
        &self,
        run_id: u64,
        result: &Result<ReviewMaterialResult, crate::core::IpcError>,
    ) -> Result<(), LearningError> {
        self.sessions
            .with_connection(|connection| {
                review_material::complete_preparation(connection, run_id, result)
            })
            .map_err(storage("update"))
    }

    fn reveal_phrase(&self, run_id: u64, position: usize) -> Result<(), LearningError> {
        self.sessions
            .with_connection(|connection| {
                review_material::reveal_phrase(connection, run_id, position)
            })
            .map_err(storage("update"))
    }
}

impl UsageStore for SessionLearningStore {
    fn prepare(&self, session_id: u64, sequence: usize) -> Result<UsagePreparation, LearningError> {
        self.sessions.with_database(|database, active| {
            usage::review::prepare_review(database, active, session_id, sequence)
        })
    }

    fn finalize(
        &self,
        request: &UsageReviewRequest,
        turn_time: i64,
        response: &UsageReviewResponse,
        turn: (u64, usize),
    ) -> Result<TurnUsageAssessment, LearningError> {
        self.sessions.with_database(|database, active| {
            usage::review::finalize_review(database, active, request, turn_time, response, turn)
        })
    }

    fn saved(
        &self,
        session_id: u64,
        sequence: usize,
    ) -> Result<Option<TurnUsageAssessment>, LearningError> {
        self.sessions.with_database(|database, active| {
            usage::review::read_saved_assessment(database, active, session_id, sequence)
        })
    }
}
