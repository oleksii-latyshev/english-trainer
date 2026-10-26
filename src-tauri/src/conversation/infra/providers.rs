use crate::ai_settings::AiSettings;
use crate::conversation::ports::{
    AnswerPlanner, GuidedAnswerSource, MistakeQuestionSource, ReplyEngine, RescueProvider,
};
use crate::learning::mistake_practice::{GeneratedMistakeQuestion, MistakePracticeCandidate};
use crate::providers::{
    self, AnswerPlan, AppleHelper, ConversationContext, ConversationTurn, GuidedAnswer,
    ProviderError, ReplyStreamEvent, RescueRequest, RescueResponse,
};
use std::sync::atomic::AtomicBool;
use std::sync::Arc;
use tauri::ipc::Channel;

pub struct ConfiguredReplyEngine {
    settings: AiSettings,
    apple: AppleHelper,
    channel: Channel<ReplyStreamEvent>,
}

impl ConfiguredReplyEngine {
    pub fn new(
        settings: AiSettings,
        apple: AppleHelper,
        channel: Channel<ReplyStreamEvent>,
    ) -> Self {
        Self {
            settings,
            apple,
            channel,
        }
    }
}

impl ReplyEngine for ConfiguredReplyEngine {
    fn generate(
        &mut self,
        context: &ConversationContext,
        cancelled: Arc<AtomicBool>,
    ) -> Result<ConversationTurn, ProviderError> {
        let channel = &self.channel;
        providers::generate_configured_turn_cancellable(
            context,
            &self.settings,
            &self.apple,
            &mut |text| ignore_closed_ui_channel(channel.send(delta(text))),
            cancelled,
        )
    }
}

fn delta(text: &str) -> ReplyStreamEvent {
    ReplyStreamEvent::Delta { text: text.into() }
}

fn ignore_closed_ui_channel(result: tauri::Result<()>) {
    drop(result);
}

pub struct AgyMistakeQuestions;

impl MistakeQuestionSource for AgyMistakeQuestions {
    fn generate(
        &mut self,
        candidates: &[MistakePracticeCandidate],
    ) -> Result<Vec<GeneratedMistakeQuestion>, ProviderError> {
        providers::agy::mistake_practice::generate(candidates)
    }
}

pub struct GeminiAnswerPlanner;

impl AnswerPlanner for GeminiAnswerPlanner {
    fn plan(&self, question: &str) -> Result<AnswerPlan, ProviderError> {
        providers::generate_answer_plan(question)
    }
}

pub struct AgyGuidedAnswers;

impl GuidedAnswerSource for AgyGuidedAnswers {
    fn guide(&self, question: &str) -> Result<GuidedAnswer, ProviderError> {
        providers::generate_guided_answer(question)
    }
}

pub struct AgyRescue;

impl RescueProvider for AgyRescue {
    fn rescue(&self, request: &RescueRequest) -> Result<RescueResponse, ProviderError> {
        providers::generate_rescue(request)
    }
}
