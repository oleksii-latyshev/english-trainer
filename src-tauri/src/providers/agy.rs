mod conversation;
mod feedback;
mod runner;
mod usage;

use super::{
    ConversationContext, ConversationTurn, FeedbackRequest, ProviderError, TurnFeedback,
    UsageReviewRequest, UsageReviewResponse,
};
use std::path::PathBuf;

pub(super) struct AgyEngine {
    pub(super) binary: PathBuf,
}

pub(super) fn generate_turn(
    context: &ConversationContext,
) -> Result<ConversationTurn, ProviderError> {
    conversation::generate_turn(context)
}

pub(super) fn evaluate_turn_feedback(
    request: &FeedbackRequest,
) -> Result<TurnFeedback, ProviderError> {
    feedback::evaluate_turn_feedback(request)
}

pub(super) fn review_turn_usage(
    request: &UsageReviewRequest,
) -> Result<UsageReviewResponse, ProviderError> {
    usage::review_turn_usage(request)
}

pub(super) fn resolve_binary() -> Option<PathBuf> {
    runner::resolve_binary()
}
