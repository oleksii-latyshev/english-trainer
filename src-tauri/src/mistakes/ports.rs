use super::domain::lesson::{
    Lesson, LessonBatchRequest, LessonRequest, RawLessonBatch, RuleCardContent,
};
use super::domain::rules::RuleKey;
use super::domain::view::{MistakeDetail, MistakeGroups, RuleCardView};
use super::error::{LessonProviderError, MistakesError};

#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct LessonOutcome {
    pub lessons: Vec<(u64, Lesson)>,
    pub cards: Vec<RuleCardContent>,
    pub failed: Vec<u64>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub struct SavedOutcome {
    pub lessons_ready: usize,
    pub relapses: usize,
}

pub trait LessonStore: Send + Sync {
    fn pending(&self, limit: usize) -> Result<Vec<LessonRequest>, MistakesError>;
    fn missing_card_keys(&self) -> Result<Vec<RuleKey>, MistakesError>;
    fn save(&self, outcome: &LessonOutcome, now_ms: i64) -> Result<SavedOutcome, MistakesError>;
}

pub trait MistakeStore: Send + Sync {
    fn groups(&self, now_ms: i64) -> Result<MistakeGroups, MistakesError>;
    fn mistake(&self, id: u64, now_ms: i64) -> Result<Option<MistakeDetail>, MistakesError>;
    fn rule_card(&self, rule: RuleKey) -> Result<RuleCardView, MistakesError>;
    fn archive(&self, id: u64) -> Result<bool, MistakesError>;
    fn reset_failed_lesson(&self, id: u64) -> Result<bool, MistakesError>;
}

pub trait LessonProvider: Send + Sync {
    fn prepare(&self, request: &LessonBatchRequest) -> Result<RawLessonBatch, LessonProviderError>;
}

pub trait MistakesNotifier: Send + Sync {
    fn updated(&self, lessons_ready: usize);
}

pub trait LessonKick: Send + Sync {
    fn kick(&self);
}

pub trait Clock: Send + Sync {
    fn now_ms(&self) -> i64;
}
