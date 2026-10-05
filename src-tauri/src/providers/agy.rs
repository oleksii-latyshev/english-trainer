pub(crate) mod conversation;
mod feedback;
pub(crate) mod guided;
pub(crate) mod runner;
mod usage;

use super::{
    FeedbackRequest, ProviderError, TurnFeedback, UsageReviewRequest, UsageReviewResponse,
};
use std::path::PathBuf;

pub(super) struct AgyEngine {
    pub(super) binary: PathBuf,
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
