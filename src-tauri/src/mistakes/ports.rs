use super::domain::check_prompt::{CheckRequest, Verdict};
use super::domain::ladder::{Progress, ScheduleUpdate};
use super::domain::lesson::{
    Lesson, LessonBatchRequest, LessonRequest, RawLessonBatch, RuleCardContent,
};
use super::domain::practice::{
    AttemptOutcome, AttemptRecord, Candidate, CheckedBy, InputKind, RunItem, RunKind, RunRecord,
};
use super::domain::rules::RuleKey;
use super::domain::view::{MistakeDetail, MistakeGroups, RuleCardView};
use super::error::{CheckError, LessonProviderError, MistakesError};

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

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RunTarget {
    Due,
    One(u64),
    Rule(RuleKey),
}

impl RunTarget {
    pub fn kind(self) -> RunKind {
        match self {
            Self::Due => RunKind::Due,
            Self::One(_) => RunKind::One,
            Self::Rule(_) => RunKind::Rule,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct NewAttempt {
    pub mistake_id: u64,
    pub run_id: u64,
    pub step: u8,
    pub input: InputKind,
    pub answer: String,
    pub outcome: AttemptOutcome,
    pub checked_by: CheckedBy,
    pub note: String,
    pub created_at: i64,
}

pub type RunPlanner<'a> = &'a dyn Fn(Vec<Candidate>) -> Vec<RunItem>;

pub trait PracticeStore: Send + Sync {
    fn start_run(
        &self,
        target: RunTarget,
        now_ms: i64,
        plan: RunPlanner<'_>,
    ) -> Result<Option<RunRecord>, MistakesError>;
    fn run(&self, run_id: u64) -> Result<Option<RunRecord>, MistakesError>;
    fn progress(&self, mistake_id: u64) -> Result<Option<Progress>, MistakesError>;
    fn record(
        &self,
        attempt: &NewAttempt,
        update: Option<(u64, ScheduleUpdate)>,
    ) -> Result<u64, MistakesError>;
    fn attempt(&self, attempt_id: u64) -> Result<Option<AttemptRecord>, MistakesError>;
    fn begin_check(&self, attempt_id: u64) -> Result<bool, MistakesError>;
    fn resolve(
        &self,
        attempt_id: u64,
        outcome: AttemptOutcome,
        note: &str,
        update: Option<(u64, ScheduleUpdate)>,
    ) -> Result<bool, MistakesError>;
    fn finish_run(&self, run_id: u64, now_ms: i64) -> Result<bool, MistakesError>;
    fn utc_offset_ms(&self, at_ms: i64) -> Result<i64, MistakesError>;
}

pub trait AnswerChecker: Send + Sync {
    fn check(&self, request: &CheckRequest) -> Result<Verdict, CheckError>;
}
