#![cfg_attr(
    not(test),
    deny(clippy::unwrap_used, clippy::expect_used, clippy::panic)
)]

pub mod commands;
mod error;
pub(crate) mod infra;
mod ports;
pub mod recall;
pub mod review_commands;
pub(crate) mod review_material;
mod review_rules;
mod review_service;
mod service;
pub mod usage_commands;
mod usage_rules;
mod usage_service;
mod validation;

pub mod memory_recall;
pub(crate) mod mistake_practice;
pub mod models;
pub mod normalization;
pub mod scheduling;
pub mod session_stats;
pub mod usage;

pub use error::LearningError;
#[cfg(test)]
pub(crate) use infra::has_cue_exposure_before;
pub(crate) use infra::ids::now_ms;
pub use infra::SessionLearningStore;
pub(crate) use infra::{
    daily_plan, record_cue_exposure, record_daily_recall, recurring_mistakes, save_turn_feedback,
};
pub use memory_recall::{
    is_safe_mistake_cue, is_safe_phrase_cue, MemoryRecallResult, MemoryReviewItem, MemoryReviewRun,
};
pub use models::{
    LearningItemType, LearningMemoryView, LearningStatus, MistakeRecord, PhraseCardRecord,
    ReviewResponse,
};
pub use normalization::{mistake_normalized_key, normalize_phrase};
pub use review_service::ReviewService;
pub use scheduling::{calculate_next_review, MS_PER_DAY};
pub use service::LearningService;
pub use usage::{
    contains_normalized_words, is_eligible_target_length, is_independent_success,
    is_rejected_by_sources, project_mastery_state, MemoryUsageEvidence, TurnUsageAssessment,
    UsageAssessmentFinding, UsageCandidate, UsageEventRecord, UsageOutcome, MAX_EXCERPT_CHARS,
    MIN_CONFIDENCE,
};
pub use usage_service::UsageReviewService;

#[cfg(test)]
#[path = "tests.rs"]
mod tests;

#[cfg(test)]
#[path = "usage_tests.rs"]
mod usage_tests;

#[cfg(test)]
mod review_service_tests;
#[cfg(test)]
mod usage_service_tests;
