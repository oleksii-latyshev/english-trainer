use crate::learning::mistake_practice::{GeneratedMistakeQuestion, MistakePracticeCandidate};
use crate::providers::{
    AnswerPlan, ConversationContext, ConversationTurn, ProviderError, RescueRequest, RescueResponse,
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
        &self,
        candidates: &[MistakePracticeCandidate],
    ) -> Result<Vec<GeneratedMistakeQuestion>, ProviderError>;
}

impl<F> MistakeQuestionSource for F
where
    F: Fn(&[MistakePracticeCandidate]) -> Result<Vec<GeneratedMistakeQuestion>, ProviderError>,
{
    fn generate(
        &self,
        candidates: &[MistakePracticeCandidate],
    ) -> Result<Vec<GeneratedMistakeQuestion>, ProviderError> {
        self(candidates)
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

pub trait RescueProvider {
    fn rescue(&self, request: &RescueRequest) -> Result<RescueResponse, ProviderError>;
}

impl<F> RescueProvider for F
where
    F: Fn(&RescueRequest) -> Result<RescueResponse, ProviderError>,
{
    fn rescue(&self, request: &RescueRequest) -> Result<RescueResponse, ProviderError> {
        self(request)
    }
}
