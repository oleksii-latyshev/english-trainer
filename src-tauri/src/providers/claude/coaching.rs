//! Background coaching on Claude: the batch, prompt and validation are the ones in `agy::coaching`.

use super::super::agy::coaching::{
    make_prompt, require_batch_size, validate_batch, RawBatch, BATCH_TIMEOUT, SCHEMA,
};
use super::super::{CoachedAnswer, CoachingAnswer, ProviderError};
use super::runner::{invalid_output, resolve_or_unavailable, run_json};
use std::path::Path;

pub fn coach_answers(answers: &[CoachingAnswer]) -> Result<Vec<CoachedAnswer>, ProviderError> {
    require_batch_size(answers)?;
    coach_answers_with(&resolve_or_unavailable()?, answers)
}

pub(crate) fn coach_answers_with(
    binary: &Path,
    answers: &[CoachingAnswer],
) -> Result<Vec<CoachedAnswer>, ProviderError> {
    require_batch_size(answers)?;
    let payload = run_json(binary, &make_prompt(answers), SCHEMA, BATCH_TIMEOUT)?;
    let raw: RawBatch = serde_json::from_value(payload).map_err(|_| invalid_output())?;
    Ok(validate_batch(raw, answers))
}
