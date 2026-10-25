use crate::conversation::domain::WrapupEvent;
use crate::learning::mistake_practice::{GeneratedMistakeQuestion, MistakePracticeCandidate};
use crate::providers::{
    AnswerPlan, ConversationContext, ConversationTurn, GuidedAnswer, ProviderError, WrapupRequest,
    WrapupResult,
};
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

pub trait WrapupGenerator: Send + Sync {
    fn generate(&self, request: &WrapupRequest) -> Result<WrapupResult, ProviderError>;
}

impl<F> WrapupGenerator for F
where
    F: Fn(&WrapupRequest) -> Result<WrapupResult, ProviderError> + Send + Sync,
{
    fn generate(&self, request: &WrapupRequest) -> Result<WrapupResult, ProviderError> {
        self(request)
    }
}

pub trait WrapupNotifier: Send + Sync {
    fn notify(&self, event: WrapupEvent);
}

impl<F> WrapupNotifier for F
where
    F: Fn(WrapupEvent) + Send + Sync,
{
    fn notify(&self, event: WrapupEvent) {
        self(event);
    }
}

pub trait AnswerPlanner {
    fn plan(&self, question: &str) -> Result<AnswerPlan, ProviderError>;
}

impl<F> AnswerPlanner for F
where
    F: Fn(&str) -> Result<AnswerPlan, ProviderError>,
{
    fn plan(&self, question: &str) -> Result<AnswerPlan, ProviderError> {
        self(question)
    }
}

pub trait GuidedAnswerSource {
    fn guide(&self, question: &str) -> Result<GuidedAnswer, ProviderError>;
}

impl<F> GuidedAnswerSource for F
where
    F: Fn(&str) -> Result<GuidedAnswer, ProviderError>,
{
    fn guide(&self, question: &str) -> Result<GuidedAnswer, ProviderError> {
        self(question)
    }
}
