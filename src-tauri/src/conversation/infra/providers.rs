use crate::ai_settings::AiSettings;
use crate::conversation::ports::{MistakeQuestionSource, ReplyEngine};
use crate::learning::mistake_practice::{GeneratedMistakeQuestion, MistakePracticeCandidate};
use crate::providers::{
    self, AppleHelper, ConversationContext, ConversationTurn, ProviderError, ReplyStreamEvent,
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
