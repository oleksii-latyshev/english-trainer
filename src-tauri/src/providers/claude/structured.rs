//! One background Claude call that must answer with JSON in a given schema. The caller owns the
//! prompt and the validation.

use super::super::ProviderError;
use super::runner::{resolve_or_unavailable, run_json};
use serde_json::Value;
use std::time::Duration;

pub(crate) const STRUCTURED_TIMEOUT: Duration = Duration::from_secs(170);

pub fn run_background_json(prompt: &str, schema: &str) -> Result<Value, ProviderError> {
    run_json(
        &resolve_or_unavailable()?,
        prompt,
        schema,
        STRUCTURED_TIMEOUT,
    )
}
