use super::models::{LearningItemType, LearningStatus, ReviewResponse};
use crate::conversation::recall::wording_observed;
use crate::learning::normalize_phrase;
use serde::{Deserialize, Serialize};

pub const MAX_CUE_CHARS: usize = 500;
pub const MAX_TARGET_CHARS: usize = 300;
pub const MAX_TRANSCRIPT_CHARS: usize = 4000;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct MemoryReviewItem {
    pub position: usize,
    pub item_type: LearningItemType,
    pub item_id: u64,
    pub cue: String,
    pub target: Option<String>,
    pub transcript: Option<String>,
    pub wording_observed: Option<bool>,
    pub saved_response: Option<ReviewResponse>,
    pub next_review_at: Option<i64>,
    pub interval_days: Option<u32>,
    pub status: Option<LearningStatus>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct MemoryReviewRun {
    pub run_id: u64,
    pub items: Vec<MemoryReviewItem>,
    pub completed: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct MemoryRecallResult {
    pub run_id: u64,
    pub position: usize,
    pub item_type: LearningItemType,
    pub item_id: u64,
    pub cue: String,
    pub target: String,
    pub transcript: String,
    pub wording_observed: bool,
    pub saved_response: ReviewResponse,
    pub next_review_at: i64,
    pub interval_days: u32,
    pub status: LearningStatus,
}

pub fn is_safe_phrase_cue(target: &str, cue: &str) -> bool {
    let trimmed_cue = cue.trim();
    let trimmed_target = target.trim();
    if trimmed_cue.is_empty() || trimmed_target.is_empty() {
        return false;
    }
    if normalize_phrase(trimmed_cue).is_empty() || normalize_phrase(trimmed_target).is_empty() {
        return false;
    }
    if trimmed_cue.chars().count() > MAX_CUE_CHARS
        || trimmed_target.chars().count() > MAX_TARGET_CHARS
    {
        return false;
    }
    !wording_observed(trimmed_target, trimmed_cue)
}

pub fn is_safe_mistake_cue(target: &str, cue: &str) -> bool {
    let trimmed_cue = cue.trim();
    let trimmed_target = target.trim();
    if trimmed_cue.is_empty() || trimmed_target.is_empty() {
        return false;
    }
    if normalize_phrase(trimmed_cue).is_empty() || normalize_phrase(trimmed_target).is_empty() {
        return false;
    }
    if trimmed_cue.chars().count() > MAX_CUE_CHARS
        || trimmed_target.chars().count() > MAX_TARGET_CHARS
    {
        return false;
    }
    !wording_observed(trimmed_target, trimmed_cue)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_safe_phrase_cue_that_does_not_reveal_target() {
        assert!(is_safe_phrase_cue(
            "trade-off",
            "A compromise between two competing features."
        ));
        assert!(is_safe_phrase_cue(
            "the main drawback",
            "Replace literal translation 'минус был в том'."
        ));
    }

    #[test]
    fn rejects_phrase_cue_when_cue_reveals_target_wording() {
        assert!(!is_safe_phrase_cue(
            "trade-off",
            "Explain the trade-off between speed and memory."
        ));
        assert!(!is_safe_phrase_cue(
            "bottleneck",
            "The network bottleneck was fixed."
        ));
    }

    #[test]
    fn rejects_blank_or_oversized_phrase_cues_and_targets() {
        assert!(!is_safe_phrase_cue("phrase", ""));
        assert!(!is_safe_phrase_cue("phrase", "   \t\n  "));
        assert!(!is_safe_phrase_cue("", "Valid cue"));
        assert!(!is_safe_phrase_cue("x".repeat(301).as_str(), "Valid cue"));
        assert!(!is_safe_phrase_cue(
            "Valid target",
            "x".repeat(501).as_str()
        ));
        assert!(!is_safe_phrase_cue("... !!!", "???"));
    }

    #[test]
    fn accepts_safe_mistake_cue_when_original_does_not_contain_correction() {
        assert!(is_safe_mistake_cue(
            "I work there",
            "I work in there yesterday."
        ));
        assert!(is_safe_mistake_cue(
            "the main drawback",
            "the minus was that we lacked time."
        ));
    }

    #[test]
    fn rejects_mistake_cue_when_original_already_contains_corrected_wording() {
        assert!(!is_safe_mistake_cue(
            "I work there",
            "I work there and everywhere."
        ));
    }
}
