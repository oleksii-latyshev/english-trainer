pub(crate) mod agy;
mod answered_by;
mod apple;
mod context;
mod gemini;
mod plain_prompt;
mod race;
mod reply_text;
mod settings;
pub use agy::guided::{generate_guided_answer, GuidedAnswer};
pub use answered_by::{AnswerProvider, AnsweredBy};
pub use apple::AppleHelper;
pub use gemini::{configure_key_store, delete_api_key, key_status, save_api_key, GeminiKeyStatus};
pub use settings::{AgyModel, AiSettings, ConversationProvider, EvaStyle};

use serde::{Deserialize, Serialize};
use std::time::{Duration, Instant};

// Gemini's measured first word is ~0.8 s median, ~1 s p90 when healthy. With no word by this
// point the free tier is usually overloaded, so the on-device model starts answering in parallel.
// 2 s, not less: the on-device answers are generic and slow, so a merely busy Gemini should win.
const APPLE_BACKUP_AFTER: Duration = Duration::from_millis(2_000);

/// The legacy `agy` window: its schema prompt embeds the whole context as JSON.
const AGY_MAX_TURNS: usize = 8;
const AGY_MAX_CHARS: usize = 8_000;
const AGY_MAX_QUESTIONS: usize = 10;

/// Characters of the system instruction plus dialogue a plain-text provider would receive.
#[cfg(test)]
pub(crate) fn primary_prompt_chars(context: &ConversationContext) -> usize {
    plain_prompt::instructions(context).chars().count()
        + plain_prompt::dialogue(context)
            .iter()
            .map(|line| line.text.chars().count())
            .sum::<usize>()
}

pub(crate) fn resolve_agy_binary() -> Option<std::path::PathBuf> {
    agy::resolve_binary()
}

/// Reply text delivered to the UI while a turn is still being generated.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum ReplyStreamEvent {
    Delta { text: String },
}

pub fn generate_configured_turn(
    context: &ConversationContext,
    settings: &AiSettings,
    apple: &AppleHelper,
    on_delta: &mut dyn FnMut(&str),
) -> Result<ConversationTurn, ProviderError> {
    let mut styled = context.clone();
    styled.eva_style = settings.eva_style;
    let context = &styled;
    measure_turn(on_delta, |forward| match settings.provider {
        ConversationProvider::Agy => {
            let context = context.compact(AGY_MAX_TURNS, AGY_MAX_CHARS, AGY_MAX_QUESTIONS);
            let mut turn =
                agy::conversation::generate_turn_with_model(&context, settings.agy_model)?;
            turn.answered_by = Some(AnsweredBy::agy(settings.agy_model));
            forward(&format!(
                "{} {}",
                turn.spoken_reply,
                turn.question.as_deref().unwrap_or_default()
            ));
            Ok(turn)
        }
        ConversationProvider::Apple => apple.generate_turn(context, forward),
        ConversationProvider::Gemini => {
            let backup = race::Backup {
                leg: apple.backup_leg(context.clone()),
                after: APPLE_BACKUP_AFTER,
                label: AnsweredBy::apple(true),
            };
            gemini::generate_turn(context, Some(backup), forward)
        }
    })
}

/// Starts slow-to-start providers (helper process, key decryption) before the first answer.
pub fn prewarm_provider(settings: &AiSettings, apple: &AppleHelper) -> Result<(), ProviderError> {
    match settings.provider {
        ConversationProvider::Apple => apple.prewarm(),
        ConversationProvider::Gemini => {
            // The on-device backup is optional; Gemini still works when it is unavailable.
            let _ = apple.prewarm();
            gemini::prewarm()
        }
        ConversationProvider::Agy => Ok(()),
    }
}

/// Checks up to five answers with one background Antigravity call; see `agy::coaching`.
pub fn coach_answers(answers: &[CoachingAnswer]) -> Result<Vec<CoachedAnswer>, ProviderError> {
    agy::coaching::coach_answers(answers)
}

pub fn review_turn_usage(
    request: &UsageReviewRequest,
) -> Result<UsageReviewResponse, ProviderError> {
    agy::review_turn_usage(request)
}

fn measure_turn(
    on_delta: &mut dyn FnMut(&str),
    generate: impl FnOnce(&mut dyn FnMut(&str)) -> Result<ConversationTurn, ProviderError>,
) -> Result<ConversationTurn, ProviderError> {
    let started_at = Instant::now();
    let mut first_token_ms = None;
    let mut forward = |text: &str| {
        if first_token_ms.is_none() {
            first_token_ms = Some(elapsed_ms(started_at));
        }
        on_delta(text);
    };
    let mut turn = generate(&mut forward)?;
    turn.provider_latency_ms = Some(elapsed_ms(started_at));
    turn.first_token_ms = first_token_ms;
    Ok(turn)
}

fn elapsed_ms(started_at: Instant) -> u64 {
    u64::try_from(started_at.elapsed().as_millis()).unwrap_or(u64::MAX)
}

#[cfg(test)]
pub trait ConversationEngine: Send + Sync {
    fn generate_turn(
        &self,
        context: &ConversationContext,
    ) -> Result<ConversationTurn, ProviderError>;
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

/// One of the learner's answers waiting to be coached, with the question it answered.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CoachingAnswer {
    pub sequence: usize,
    pub question: String,
    pub transcript: String,
}

/// The coaching a batch returned for one answer.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CoachedAnswer {
    pub sequence: usize,
    pub feedback: TurnFeedback,
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

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Default)]
pub struct ConversationContext {
    pub opening_question: String,
    pub recent_turns: Vec<ContextTurn>,
    pub latest_transcript: String,
    pub learning_targets: Vec<LearningPromptTarget>,
    /// The learner's answers older than `recent_turns`, each condensed, oldest first.
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub earlier_answers: Vec<String>,
    /// Questions Eva already asked this session, oldest first.
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub asked_questions: Vec<String>,
    /// How Eva should sound; set from the saved settings, never part of the data sent to a model.
    #[serde(skip)]
    pub eva_style: EvaStyle,
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
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub first_token_ms: Option<u64>,
    /// The model that wrote this reply; absent only for replies stored before it was recorded.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub answered_by: Option<AnsweredBy>,
}

impl ConversationTurn {
    /// Time until Eva's first words, or the whole provider latency when no first-token time exists.
    pub fn reply_time_ms(&self) -> Option<u64> {
        self.first_token_ms.or(self.provider_latency_ms)
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ProviderErrorCode {
    Unavailable,
    Unauthorized,
    RateLimited,
    Timeout,
    InvalidOutput,
    ProcessFailed,
    InvalidRequest,
    Busy,
    InvalidSession,
    DatabaseError,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ReplyStage {
    Envelope,
    Schema,
    Content,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ProviderError {
    pub code: ProviderErrorCode,
    pub message: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reply_stage: Option<ReplyStage>,
}

impl ProviderError {
    pub fn new(code: ProviderErrorCode, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
            reply_stage: None,
        }
    }
}

#[cfg(test)]
mod timing_tests {
    use super::*;

    #[test]
    fn the_on_device_backup_starts_after_two_seconds_without_a_word() {
        assert_eq!(APPLE_BACKUP_AFTER, Duration::from_secs(2));
    }

    #[test]
    fn provider_boundary_adds_latency_and_first_token_time_to_the_returned_turn() {
        let mut forwarded = Vec::new();
        let turn = measure_turn(&mut |text| forwarded.push(text.to_string()), |forward| {
            forward("I see.");
            Ok(ConversationTurn {
                spoken_reply: "I see.".into(),
                question: Some("Why?".into()),
                session_phase: "active".into(),
                is_complete: false,
                provider_latency_ms: None,
                first_token_ms: None,
                answered_by: None,
            })
        })
        .unwrap();

        assert_eq!(forwarded, ["I see."]);
        assert!(turn.provider_latency_ms.is_some());
        assert!(turn.first_token_ms.is_some());
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
