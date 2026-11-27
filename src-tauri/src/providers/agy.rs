pub(crate) mod coaching;
pub(crate) mod conversation;
pub(crate) mod feedback;
pub(crate) mod mistake_practice;
pub(crate) mod rescue;
pub(crate) mod runner;
pub(crate) mod spoken_review;
pub(crate) mod structured;
#[cfg(test)]
pub(crate) mod test_support;
pub(crate) mod usage;

#[cfg(test)]
mod model_pinning_tests;

use super::{ProviderError, UsageReviewRequest, UsageReviewResponse};
use std::path::PathBuf;

pub(super) struct AgyEngine {
    pub(super) binary: PathBuf,
}

pub(super) fn review_turn_usage(
    request: &UsageReviewRequest,
) -> Result<UsageReviewResponse, ProviderError> {
    usage::review_turn_usage(request)
}

pub(super) fn resolve_binary() -> Option<PathBuf> {
    runner::resolve_binary()
}
