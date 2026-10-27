use super::error::LearningError;
use super::models::LearningItemType;
use super::usage::{
    contains_normalized_words, TurnUsageAssessment, UsageOutcome, MAX_EXCERPT_CHARS, MIN_CONFIDENCE,
};
use super::validation::MAX_ITEM_ID;
use crate::core::IpcErrorCode;
use crate::providers::{UsageReviewRequest, UsageReviewResponse};
use std::collections::HashSet;

pub enum UsagePreparation {
    Saved(TurnUsageAssessment),
    NothingToAssess(TurnUsageAssessment),
    NeedsReview {
        request: UsageReviewRequest,
        turn_time: i64,
    },
}

pub const REVIEWABLE_ANSWERS: usize = 2;
pub const MAX_CANDIDATES: usize = 3;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum UsageRejection {
    OutOfRange,
    AlreadyRunning,
    NotSpoken,
    NotConversation,
    UnknownTurn,
    Stale,
    Unverifiable,
    InvalidLookup,
}

impl UsageRejection {
    pub fn code(self) -> IpcErrorCode {
        match self {
            Self::AlreadyRunning => IpcErrorCode::Busy,
            Self::UnknownTurn => IpcErrorCode::InvalidSession,
            Self::Unverifiable => IpcErrorCode::InvalidOutput,
            _ => IpcErrorCode::InvalidRequest,
        }
    }

    pub fn message(self) -> &'static str {
        match self {
            Self::OutOfRange => "Usage review is only available for conversation answers 1 and 2.",
            Self::AlreadyRunning => "A memory usage review is already running for this answer.",
            Self::NotSpoken => {
                "Typed or edited answers cannot count as independent spoken memory evidence."
            }
            Self::NotConversation => "Usage review is only available for conversation sessions.",
            Self::UnknownTurn => {
                "This practice session is no longer active. Start a new session and retry."
            }
            Self::Stale => {
                "The saved answer or learning targets changed during review. Please try again."
            }
            Self::Unverifiable => {
                "The AI review returned findings that could not be verified. Please retry."
            }
            Self::InvalidLookup => "Invalid session or turn sequence.",
        }
    }
}

fn reject(rejection: UsageRejection) -> LearningError {
    LearningError::Usage(rejection)
}

pub fn validate_review_turn(session_id: u64, sequence: usize) -> Result<(), LearningError> {
    if session_id == 0 || session_id > MAX_ITEM_ID || sequence == 0 || sequence > REVIEWABLE_ANSWERS
    {
        return Err(reject(UsageRejection::OutOfRange));
    }
    Ok(())
}

pub fn validate_saved_turn(session_id: u64, sequence: usize) -> Result<(), LearningError> {
    if session_id == 0 || session_id > MAX_ITEM_ID || sequence == 0 {
        return Err(reject(UsageRejection::InvalidLookup));
    }
    Ok(())
}

pub fn stale_review() -> LearningError {
    reject(UsageRejection::Stale)
}

pub fn unknown_turn() -> LearningError {
    reject(UsageRejection::UnknownTurn)
}

pub fn already_running() -> LearningError {
    reject(UsageRejection::AlreadyRunning)
}

pub fn not_spoken() -> LearningError {
    reject(UsageRejection::NotSpoken)
}

pub fn not_conversation() -> LearningError {
    reject(UsageRejection::NotConversation)
}

pub fn credit_decision(
    reported: UsageOutcome,
    confidence: f64,
    was_helped: bool,
    is_target_unchanged: bool,
) -> (UsageOutcome, bool) {
    let is_confident = confidence >= MIN_CONFIDENCE;
    if !is_target_unchanged {
        return (UsageOutcome::Uncertain, false);
    }
    match reported {
        UsageOutcome::Correct if !is_confident => (UsageOutcome::Uncertain, false),
        UsageOutcome::Correct if was_helped => (UsageOutcome::WithHelp, true),
        UsageOutcome::Correct => (UsageOutcome::Correct, true),
        UsageOutcome::Incorrect if !is_confident => (UsageOutcome::Uncertain, false),
        UsageOutcome::Incorrect => (UsageOutcome::Incorrect, true),
        UsageOutcome::WithHelp | UsageOutcome::Uncertain => (UsageOutcome::Uncertain, false),
    }
}

pub fn validate_findings(
    request: &UsageReviewRequest,
    response: &UsageReviewResponse,
) -> Result<(), LearningError> {
    let invalid = || reject(UsageRejection::Unverifiable);
    if request.candidates.is_empty()
        || request.candidates.len() > MAX_CANDIDATES
        || response.findings.len() != request.candidates.len()
    {
        return Err(invalid());
    }
    let mut candidates = HashSet::new();
    for candidate in &request.candidates {
        if candidate.item_id == 0 || !candidates.insert((candidate.item_type, candidate.item_id)) {
            return Err(invalid());
        }
    }
    let mut seen = HashSet::new();
    for finding in &response.findings {
        let Some(candidate) = request.candidates.iter().find(|candidate| {
            candidate.item_type == finding.item_type && candidate.item_id == finding.item_id
        }) else {
            return Err(invalid());
        };
        if !seen.insert((finding.item_type, finding.item_id))
            || !finding.confidence.is_finite()
            || !(0.0..=1.0).contains(&finding.confidence)
            || finding.exact_excerpt.chars().count() > MAX_EXCERPT_CHARS
        {
            return Err(invalid());
        }
        match finding.outcome {
            UsageOutcome::Correct => {
                if finding.confidence < MIN_CONFIDENCE
                    || finding.exact_excerpt.is_empty()
                    || !request.transcript.contains(&finding.exact_excerpt)
                    || !contains_normalized_words(&finding.exact_excerpt, &candidate.target)
                {
                    return Err(invalid());
                }
            }
            UsageOutcome::Incorrect => {
                let has_original_mistake = candidate.item_type == LearningItemType::Mistake
                    && contains_normalized_words(&finding.exact_excerpt, &candidate.cue);
                if finding.confidence < MIN_CONFIDENCE
                    || finding.exact_excerpt.is_empty()
                    || !request.transcript.contains(&finding.exact_excerpt)
                    || (!contains_normalized_words(&finding.exact_excerpt, &candidate.target)
                        && !has_original_mistake)
                {
                    return Err(invalid());
                }
            }
            UsageOutcome::WithHelp => return Err(invalid()),
            UsageOutcome::Uncertain => {
                if !finding.exact_excerpt.is_empty()
                    && !request.transcript.contains(&finding.exact_excerpt)
                {
                    return Err(invalid());
                }
            }
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::learning::is_independent_success;

    #[test]
    fn a_confident_correct_use_without_an_earlier_cue_is_credited() {
        assert_eq!(
            credit_decision(UsageOutcome::Correct, 0.95, false, true),
            (UsageOutcome::Correct, true)
        );
    }

    #[test]
    fn a_helped_or_cued_correct_use_is_recorded_as_with_help() {
        assert_eq!(
            credit_decision(UsageOutcome::Correct, 0.99, true, true),
            (UsageOutcome::WithHelp, true)
        );
    }

    #[test]
    fn a_with_help_use_is_never_independent_evidence() {
        assert!(!is_independent_success(UsageOutcome::WithHelp, 1.0));
    }

    #[test]
    fn a_helped_use_below_the_confidence_floor_is_not_recorded() {
        assert_eq!(
            credit_decision(UsageOutcome::Correct, 0.5, true, true),
            (UsageOutcome::Uncertain, false)
        );
    }

    #[test]
    fn a_changed_target_is_never_recorded_even_with_help() {
        assert_eq!(
            credit_decision(UsageOutcome::Correct, 0.99, true, false),
            (UsageOutcome::Uncertain, false)
        );
    }

    #[test]
    fn the_provider_cannot_report_with_help() {
        assert_eq!(
            credit_decision(UsageOutcome::WithHelp, 0.99, false, true),
            (UsageOutcome::Uncertain, false)
        );
    }

    #[test]
    fn low_confidence_is_never_credited() {
        assert_eq!(
            credit_decision(UsageOutcome::Correct, 0.5, false, true),
            (UsageOutcome::Uncertain, false)
        );
        assert_eq!(
            credit_decision(UsageOutcome::Incorrect, 0.5, false, true),
            (UsageOutcome::Uncertain, false)
        );
    }

    #[test]
    fn a_confident_relapse_is_credited_even_after_a_cue() {
        assert_eq!(
            credit_decision(UsageOutcome::Incorrect, 0.95, true, true),
            (UsageOutcome::Incorrect, true)
        );
    }

    #[test]
    fn a_changed_or_archived_target_is_never_credited() {
        assert_eq!(
            credit_decision(UsageOutcome::Correct, 0.95, false, false),
            (UsageOutcome::Uncertain, false)
        );
    }

    #[test]
    fn only_answers_one_and_two_can_be_reviewed() {
        assert!(validate_review_turn(1, 1).is_ok());
        assert!(validate_review_turn(1, 2).is_ok());
        assert!(validate_review_turn(1, 3).is_err());
        assert!(validate_review_turn(0, 1).is_err());
    }
}
