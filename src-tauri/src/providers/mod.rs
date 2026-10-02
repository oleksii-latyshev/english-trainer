mod agy;

use serde::{Deserialize, Serialize};
use std::time::Instant;

pub(crate) fn resolve_agy_binary() -> Option<std::path::PathBuf> {
    agy::resolve_binary()
}

pub fn generate_follow_up(transcript: String) -> Result<ConversationTurn, ProviderError> {
    generate_conversation_turn(&ConversationContext {
        opening_question: String::new(),
        recent_turns: Vec::new(),
        latest_transcript: transcript,
        learning_targets: Vec::new(),
    })
}

pub fn generate_conversation_turn(
    context: &ConversationContext,
) -> Result<ConversationTurn, ProviderError> {
    measure_turn(|| agy::generate_turn(context))
}

pub fn evaluate_turn_feedback(request: &FeedbackRequest) -> Result<TurnFeedback, ProviderError> {
    agy::evaluate_turn_feedback(request)
}

pub fn review_turn_usage(
    request: &UsageReviewRequest,
) -> Result<UsageReviewResponse, ProviderError> {
    agy::review_turn_usage(request)
}

fn measure_turn(
    generate: impl FnOnce() -> Result<ConversationTurn, ProviderError>,
) -> Result<ConversationTurn, ProviderError> {
    let started_at = Instant::now();
    let mut turn = generate()?;
    turn.provider_latency_ms =
        Some(u64::try_from(started_at.elapsed().as_millis()).unwrap_or(u64::MAX));
    Ok(turn)
}

pub trait ConversationEngine: Send + Sync {
    fn generate_turn(
        &self,
        context: &ConversationContext,
    ) -> Result<ConversationTurn, ProviderError>;
}

pub trait FeedbackEngine: Send + Sync {
    fn evaluate_turn(&self, request: &FeedbackRequest) -> Result<TurnFeedback, ProviderError>;
}

pub trait UsageReviewEngine: Send + Sync {
    fn review_usage(
        &self,
        request: &UsageReviewRequest,
    ) -> Result<UsageReviewResponse, ProviderError>;
}

pub use crate::learning::usage::{UsageCandidate, UsageFinding, UsageOutcome};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct UsageReviewRequest {
    pub answered_question: String,
    pub transcript: String,
    pub candidates: Vec<UsageCandidate>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct UsageReviewResponse {
    pub findings: Vec<UsageFinding>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct FeedbackRequest {
    pub question: String,
    pub transcript: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct TurnFeedback {
    pub focus_feedback: Vec<FocusFeedback>,
    pub b2_rewrite: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AttemptComparison {
    pub turn_sequence: usize,
    pub original_transcript: String,
    pub retry_transcript: String,
    pub target: String,
    pub target_evidence: TargetEvidence,
    pub word_count_change: i32,
    pub hesitation: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TargetEvidence {
    AlreadyPresentInBoth,
    NewlyObservedInRetry,
    PartiallyObserved,
    NotObserved,
    Uncertain,
}

pub fn compare_attempts(
    turn_sequence: usize,
    original: &str,
    retry: &str,
    target: &str,
) -> AttemptComparison {
    let target_words = words(target);
    let original_words = words(original);
    let retry_words = words(retry);
    let target_occurs_in_retry = contains_word_sequence(&retry_words, &target_words);
    let target_occurs_in_original = contains_word_sequence(&original_words, &target_words);
    let matched = target_words
        .iter()
        .filter(|word| retry_words.contains(word))
        .count();
    let target_evidence = if target_words.len() < 2 {
        TargetEvidence::Uncertain
    } else if target_occurs_in_retry && target_occurs_in_original {
        TargetEvidence::AlreadyPresentInBoth
    } else if target_occurs_in_retry {
        TargetEvidence::NewlyObservedInRetry
    } else if matched > 0 {
        TargetEvidence::PartiallyObserved
    } else {
        TargetEvidence::NotObserved
    };
    let original_count = original_words.len();
    let retry_count = retry_words.len();
    AttemptComparison {
        turn_sequence,
        original_transcript: original.to_string(),
        retry_transcript: retry.to_string(),
        target: target.to_string(),
        target_evidence,
        word_count_change: i32::try_from(retry_count).unwrap_or(i32::MAX)
            - i32::try_from(original_count).unwrap_or(i32::MAX),
        hesitation: "Not measured from transcript text.".into(),
    }
}

fn words(text: &str) -> Vec<String> {
    text.split(|character: char| !character.is_alphanumeric())
        .filter(|word| !word.is_empty())
        .map(str::to_lowercase)
        .collect()
}

fn contains_word_sequence(words: &[String], target: &[String]) -> bool {
    !target.is_empty() && words.windows(target.len()).any(|window| window == target)
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct FocusFeedback {
    pub category: FocusCategory,
    pub original: String,
    pub improved: String,
    pub explanation: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum FocusCategory {
    Grammar,
    Vocabulary,
    Coherence,
    Interaction,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct ConversationContext {
    pub opening_question: String,
    pub recent_turns: Vec<ContextTurn>,
    pub latest_transcript: String,
    pub learning_targets: Vec<LearningPromptTarget>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct LearningPromptTarget {
    pub kind: String,
    pub cue: String,
    pub target: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct ContextTurn {
    pub learner: String,
    pub assistant_reply: String,
    pub assistant_question: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ConversationTurn {
    pub spoken_reply: String,
    pub question: Option<String>,
    pub session_phase: String,
    pub is_complete: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub provider_latency_ms: Option<u64>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum ProviderErrorCode {
    Unavailable,
    Timeout,
    InvalidOutput,
    ProcessFailed,
    InvalidRequest,
    Busy,
    InvalidSession,
    DatabaseError,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct ProviderError {
    pub code: ProviderErrorCode,
    pub message: String,
}

impl ProviderError {
    pub fn new(code: ProviderErrorCode, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
        }
    }
}

#[cfg(test)]
mod timing_tests {
    use super::*;

    #[test]
    fn provider_boundary_adds_latency_to_the_returned_turn() {
        let turn = measure_turn(|| {
            Ok(ConversationTurn {
                spoken_reply: "I see.".into(),
                question: Some("Why?".into()),
                session_phase: "active".into(),
                is_complete: false,
                provider_latency_ms: None,
            })
        })
        .unwrap();

        assert!(turn.provider_latency_ms.is_some());
        assert!(serde_json::to_value(&turn)
            .unwrap()
            .get("provider_latency_ms")
            .is_some());
    }
}

#[cfg(test)]
mod retry_comparison_tests {
    use super::*;

    #[test]
    fn retry_evidence_reports_ordered_target_words_and_uncertainty_without_pauses() {
        let observed = compare_attempts(1, "I work in there", "I work there now", "I work there");
        assert_eq!(
            observed.target_evidence,
            TargetEvidence::NewlyObservedInRetry
        );
        assert_eq!(observed.hesitation, "Not measured from transcript text.");

        let reversed =
            compare_attempts(1, "I work in there", "There is work for me", "I work there");
        assert_eq!(reversed.target_evidence, TargetEvidence::PartiallyObserved);

        let short_target = compare_attempts(1, "Original", "Retry", "Good");
        assert_eq!(short_target.target_evidence, TargetEvidence::Uncertain);

        let already_present =
            compare_attempts(1, "I work there", "I work there again", "I work there");
        assert_eq!(
            already_present.target_evidence,
            TargetEvidence::AlreadyPresentInBoth
        );
    }
}
