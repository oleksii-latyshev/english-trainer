pub(crate) mod coaching;
pub(crate) mod conversation;
mod feedback;
pub(crate) mod guided;
pub(crate) mod mistake_practice;
pub(crate) mod rescue;
pub(crate) mod runner;
#[cfg(test)]
mod test_support;
mod usage;

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
