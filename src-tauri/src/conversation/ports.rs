use crate::learning::mistake_practice::{GeneratedMistakeQuestion, MistakePracticeCandidate};
use crate::providers::{ConversationContext, ConversationTurn, ProviderError};
use std::sync::atomic::AtomicBool;
use std::sync::Arc;

pub trait ReplyEngine {
    fn generate(
        &mut self,
        context: &ConversationContext,
        cancelled: Arc<AtomicBool>,
    ) -> Result<ConversationTurn, ProviderError>;
}

pub(crate) trait MistakeQuestionSource {
    fn generate(
        &mut self,
        candidates: &[MistakePracticeCandidate],
    ) -> Result<Vec<GeneratedMistakeQuestion>, ProviderError>;
}
