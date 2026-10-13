use super::error::LearningError;
use super::models::{LearningItemType, LearningMemoryView, PhraseCardRecord};
use super::usage::MemoryUsageEvidence;

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
