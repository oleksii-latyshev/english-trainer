use super::error::LearningError;
use super::memory_recall::{MemoryRecallResult, MemoryReviewRun};
use super::models::{LearningItemType, LearningMemoryView, PhraseCardRecord};
use super::review_material::{ReviewMaterialRow, StoredReviewMaterial};
use super::usage::{MemoryUsageEvidence, TurnUsageAssessment};
use super::usage_rules::UsagePreparation;
use crate::providers::{
    ReviewMaterialRequest, ReviewMaterialResult, UsageReviewRequest, UsageReviewResponse,
};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct PhraseSource {
    pub session_id: u64,
    pub sequence: usize,
}

pub trait LearningStore: Send + Sync {
    fn memory(&self) -> Result<LearningMemoryView, LearningError>;
    fn mark_memory_shown(&self) -> Result<(), LearningError>;
    fn phrase_source_exists(&self, source: PhraseSource) -> Result<bool, LearningError>;
    fn save_phrase(
        &self,
        phrase: &str,
        meaning_or_note: &str,
        source: Option<PhraseSource>,
    ) -> Result<PhraseCardRecord, LearningError>;
    fn archive(&self, item_type: LearningItemType, item_id: u64) -> Result<bool, LearningError>;
    fn delete_mistake(&self, mistake_id: u64) -> Result<bool, LearningError>;
    fn delete_phrase(&self, phrase_id: u64) -> Result<bool, LearningError>;
    fn usage_evidence(
        &self,
        item_type: LearningItemType,
        item_id: u64,
    ) -> Result<MemoryUsageEvidence, LearningError>;
}

pub trait ReviewRunStore: Send + Sync {
    fn start(&self, is_warmup: bool) -> Result<Option<MemoryReviewRun>, LearningError>;
    fn start_item(
        &self,
        item_type: LearningItemType,
        item_id: u64,
    ) -> Result<Option<MemoryReviewRun>, LearningError>;
    fn active(&self) -> Result<Option<MemoryReviewRun>, LearningError>;
    fn record_recall(
        &self,
        run_id: u64,
        item_type: LearningItemType,
        item_id: u64,
        transcript: &str,
    ) -> Result<MemoryRecallResult, LearningError>;
    fn skip(
        &self,
        run_id: u64,
        item_type: LearningItemType,
        item_id: u64,
    ) -> Result<MemoryReviewRun, LearningError>;
    fn finish(&self, run_id: u64) -> Result<(), LearningError>;
}

pub trait ReviewMaterialStore: Send + Sync {
    fn read(
        &self,
        run_id: u64,
    ) -> Result<(Vec<ReviewMaterialRow>, Option<StoredReviewMaterial>), LearningError>;
    fn begin_preparation(
        &self,
        run_id: u64,
        retry: bool,
    ) -> Result<Option<ReviewMaterialRequest>, LearningError>;
    fn complete_preparation(
        &self,
        run_id: u64,
        result: &Result<ReviewMaterialResult, crate::core::IpcError>,
    ) -> Result<(), LearningError>;
    fn reveal_phrase(&self, run_id: u64, position: usize) -> Result<(), LearningError>;
}

pub trait UsageStore: Send + Sync {
    fn prepare(&self, session_id: u64, sequence: usize) -> Result<UsagePreparation, LearningError>;
    fn finalize(
        &self,
        request: &UsageReviewRequest,
        turn_time: i64,
        response: &UsageReviewResponse,
        turn: (u64, usize),
    ) -> Result<TurnUsageAssessment, LearningError>;
    fn saved(
        &self,
        session_id: u64,
        sequence: usize,
    ) -> Result<Option<TurnUsageAssessment>, LearningError>;
}
