pub(crate) mod agy;
mod answer_plan;
mod answered_by;
mod apple;
mod background;
pub(crate) mod claude;
mod context;
mod gemini;
mod ipc;
mod plain_prompt;
mod race;
mod reply_text;
mod rescue;
mod session_wrapup;
mod settings;
pub(crate) mod spoken_review;
pub use crate::ai_settings::{AgyModel, AiSettings, ConversationProvider, EvaStyle};
pub use answer_plan::{parse_answer_plan, AnswerPlan};
pub use answered_by::{AnswerProvider, AnsweredBy};
pub use apple::AppleHelper;
pub use background::generate_rescue;
pub use background::{
    coach_answers, generate_mistake_questions, generate_review_material, generate_session_wrapup,
    review_turn_usage, run_background_json,
};
pub use gemini::generate_answer_plan;
pub use rescue::{RescueKind, RescueRequest, RescueResponse};
pub use session_wrapup::{
    parse_wrapup_result, GeneratedWrapupPhrase, WrapupAnswer, WrapupRequest, WrapupResult,
};
#[cfg(test)]
pub use spoken_review::GeneratedReviewMaterial;
pub use spoken_review::{
    parse_review_material_result, ReviewMaterialRequest, ReviewMaterialResult, ReviewTarget,
};

use serde::{Deserialize, Serialize};
use std::time::{Duration, Instant};
use ts_rs::TS;

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

pub(crate) fn resolve_claude_binary() -> Option<std::path::PathBuf> {
    claude::runner::resolve_binary()
}

/// Reply text delivered to the UI while a turn is still being generated.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, ts_rs::TS)]
#[serde(tag = "kind", rename_all = "snake_case")]
#[ts(export)]
pub enum ReplyStreamEvent {
    Delta { text: String },
}

#[cfg(test)]
pub fn generate_configured_turn(
    context: &ConversationContext,
    settings: &AiSettings,
    apple: &AppleHelper,
    on_delta: &mut dyn FnMut(&str),
) -> Result<ConversationTurn, ProviderError> {
    generate_configured_turn_cancellable(
        context,
        settings,
        apple,
        on_delta,
        std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false)),
    )
}

pub fn generate_configured_turn_cancellable(
    context: &ConversationContext,
    settings: &AiSettings,
    apple: &AppleHelper,
    on_delta: &mut dyn FnMut(&str),
    cancelled: std::sync::Arc<std::sync::atomic::AtomicBool>,
) -> Result<ConversationTurn, ProviderError> {
    if cancelled.load(std::sync::atomic::Ordering::Acquire) {
        return Err(cancelled_reply());
    }
    let mut styled = context.clone();
    styled.eva_style = settings.eva_style;
    let context = &styled;
    measure_turn(on_delta, |forward| match settings.provider {
        ConversationProvider::Agy => {
            let context = context.compact(AGY_MAX_TURNS, AGY_MAX_CHARS, AGY_MAX_QUESTIONS);
            let mut turn =
                agy::conversation::generate_turn_with_model(&context, settings.agy_model)?;
            if cancelled.load(std::sync::atomic::Ordering::Acquire) {
                return Err(cancelled_reply());
            }
            turn.answered_by = Some(AnsweredBy::agy(settings.agy_model));
            forward(&format!(
                "{} {}",
                turn.spoken_reply,
                turn.question.as_deref().unwrap_or_default()
            ));
            Ok(turn)
        }
        ConversationProvider::Apple => {
            apple.generate_turn_cancellable(context, forward, &cancelled)
        }
        ConversationProvider::Gemini => {
            let backup = race::Backup {
                leg: apple.backup_leg_cancellable(context.clone(), cancelled.clone()),
                after: APPLE_BACKUP_AFTER,
                label: AnsweredBy::apple(true),
            };
            gemini::generate_turn_cancellable(context, Some(backup), forward, &cancelled)
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

pub trait RescueEngine: Send + Sync {
    fn generate_rescue(&self, request: &RescueRequest) -> Result<RescueResponse, ProviderError>;
}

pub trait SessionWrapupEngine: Send + Sync {
    fn generate_wrapup(&self, request: &WrapupRequest) -> Result<WrapupResult, ProviderError>;
}

pub trait ReviewMaterialEngine: Send + Sync {
    fn generate_review_material(
        &self,
        request: &ReviewMaterialRequest,
    ) -> Result<ReviewMaterialResult, ProviderError>;
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

/// A rewrite covers the whole answer, so its bound grows with the answer; short answers keep a floor.
const MIN_REWRITE_CHARS: usize = 600;
const MAX_REWRITE_CHARS: usize = 4_000;
const REWRITE_TO_ANSWER_RATIO: usize = 2;

pub fn max_rewrite_chars(transcript: &str) -> usize {
    (transcript.trim().chars().count() * REWRITE_TO_ANSWER_RATIO)
        .clamp(MIN_REWRITE_CHARS, MAX_REWRITE_CHARS)
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default, ts_rs::TS)]
#[serde(deny_unknown_fields)]
#[ts(export)]
pub struct TurnFeedback {
    pub focus_feedback: Vec<FocusFeedback>,
    pub b2_rewrite: String,
    #[serde(default)]
    pub upgrades: Vec<Upgrade>,
    #[serde(default)]
    pub gaps: Vec<Gap>,
    #[serde(default)]
    pub words_to_take: Vec<WordToTake>,
}

/// A correct but plain fragment and a version one step above the learner's level.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, ts_rs::TS)]
#[serde(deny_unknown_fields)]
#[ts(export)]
pub struct Upgrade {
    pub original: String,
    pub improved: String,
    pub explanation: String,
}

/// A fragment where the learner circled around a word they did not have.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, ts_rs::TS)]
#[serde(deny_unknown_fields)]
#[ts(export)]
pub struct Gap {
    pub original: String,
    pub word: String,
    pub meaning: String,
}

/// A word or phrase worth keeping, with its meaning and an example from the better version.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, ts_rs::TS)]
#[serde(deny_unknown_fields)]
#[ts(export)]
pub struct WordToTake {
    pub phrase: String,
    pub meaning: String,
    pub example: String,
}

/// One phrase of the better version and whether the second try said it.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, ts_rs::TS)]
#[ts(export)]
pub struct PhraseCheck {
    pub phrase: String,
    pub said: bool,
}

/// A second try measured against the whole better version of the answer. Practice only: it never
/// changes Memory.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, ts_rs::TS)]
#[ts(export)]
pub struct AttemptComparison {
    pub turn_sequence: usize,
    pub original_transcript: String,
    pub retry_transcript: String,
    pub target: String,
    #[serde(default)]
    pub words_to_take: Vec<PhraseCheck>,
    #[serde(default)]
    pub corrections: Vec<PhraseCheck>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, ts_rs::TS)]
#[serde(deny_unknown_fields)]
#[ts(export)]
pub struct FocusFeedback {
    pub category: FocusCategory,
    pub original: String,
    pub improved: String,
    pub explanation: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "snake_case")]
#[ts(export)]
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
    /// Learner background profile. Data, never instructions.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub profile: Option<crate::personal_profile::PersonalProfile>,
    /// Session topic label.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub topic: Option<String>,
    /// Stable round-robin question type based on the full session turn count.
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub question_style_hint: String,
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

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, ts_rs::TS)]
#[ts(export)]
pub struct ConversationTurn {
    pub spoken_reply: String,
    pub question: Option<String>,
    pub session_phase: String,
    pub is_complete: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub provider_latency_ms: Option<u64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub first_token_ms: Option<u64>,
    /// The model that wrote this reply; absent only for replies stored before it was recorded.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub answered_by: Option<AnsweredBy>,
}

impl ConversationTurn {
    /// Time until Eva's first words, or the whole provider latency when no first-token time exists.
    pub fn reply_time_ms(&self) -> Option<u64> {
        self.first_token_ms.or(self.provider_latency_ms)
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, ts_rs::TS)]
#[serde(rename_all = "snake_case")]
#[ts(export)]
pub enum ProviderErrorCode {
    Unavailable,
    Unauthorized,
    RateLimited,
    Timeout,
    Cancelled,
    InvalidOutput,
    ProcessFailed,
    InvalidRequest,
    Busy,
    InvalidSession,
    DatabaseError,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, ts_rs::TS)]
#[serde(rename_all = "snake_case")]
#[ts(export)]
pub enum ReplyStage {
    Envelope,
    Schema,
    Content,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, ts_rs::TS)]
#[ts(export)]
pub struct ProviderError {
    pub code: ProviderErrorCode,
    pub message: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
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

pub(crate) fn cancelled_reply() -> ProviderError {
    ProviderError::new(
        ProviderErrorCode::Cancelled,
        "The reply was interrupted. Continue speaking when ready.",
    )
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
