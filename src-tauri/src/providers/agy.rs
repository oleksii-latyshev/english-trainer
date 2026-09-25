mod conversation;
mod feedback;
mod runner;

use super::{ConversationContext, ConversationTurn, FeedbackRequest, ProviderError, TurnFeedback};
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
