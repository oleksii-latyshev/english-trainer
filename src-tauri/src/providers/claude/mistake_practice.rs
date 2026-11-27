use super::super::agy::mistake_practice::{make_prompt, validate_plan, Plan, SCHEMA};
use super::super::ProviderError;
use super::runner::{invalid_output, resolve_or_unavailable, run_json};
use crate::learning::mistake_practice::{GeneratedMistakeQuestion, MistakePracticeCandidate};
use std::time::Duration;

const TIMEOUT: Duration = Duration::from_secs(170);

pub(crate) fn generate(
    candidates: &[MistakePracticeCandidate],
) -> Result<Vec<GeneratedMistakeQuestion>, ProviderError> {
    let payload = run_json(
        &resolve_or_unavailable()?,
        &make_prompt(candidates),
        SCHEMA,
        TIMEOUT,
    )?;
    let plan: Plan = serde_json::from_value(payload).map_err(|_| invalid_output())?;
    validate_plan(plan, candidates)
}
