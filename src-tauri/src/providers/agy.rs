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
#[cfg(unix)]
mod model_pinning_tests;

use super::{ProviderError, UsageBatchAnswer, UsageBatchResult};
use std::path::PathBuf;

pub(super) struct AgyEngine {
    pub(super) binary: PathBuf,
}

pub(super) fn review_usage_batch(
    answers: &[UsageBatchAnswer],
) -> Result<Vec<UsageBatchResult>, ProviderError> {
    let mut results = Vec::new();
    let mut last_error = None;
    for answer in answers {
        match usage::review_turn_usage(&answer.request) {
            Ok(response) => results.push(UsageBatchResult {
                sequence: answer.sequence,
                response,
            }),
            Err(error) => last_error = Some(error),
        }
    }
    match (results.is_empty(), last_error) {
        (true, Some(error)) => Err(error),
        _ => Ok(results),
    }
}

pub(super) fn resolve_binary() -> Option<PathBuf> {
    runner::resolve_binary()
}
