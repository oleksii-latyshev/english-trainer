//! One background Antigravity call that must answer with JSON in a given schema. The caller owns
//! the prompt and the validation; this only runs the pinned Gemini model and reads the envelope.

use super::super::{ProviderError, ProviderErrorCode};
use super::runner::{
    self, mentions_quota, quota_error, run_cli, CliOptions, ScratchDirectory, AGY_DEFAULT_MODEL,
};
use serde::Deserialize;
use serde_json::Value;
use std::{fs, path::Path, time::Duration};

pub(crate) const STRUCTURED_MODEL: &str = AGY_DEFAULT_MODEL;
pub(crate) const STRUCTURED_TIMEOUT: Duration = Duration::from_secs(170);

#[derive(Deserialize)]
struct Envelope {
    status: String,
    #[serde(default)]
    structured_output: Option<Value>,
    #[serde(default)]
    response: Option<String>,
}

pub fn run_background_json(prompt: &str, schema: &str) -> Result<Value, ProviderError> {
    let binary = runner::resolve_binary().ok_or_else(|| {
        ProviderError::new(
            ProviderErrorCode::Unavailable,
            "Antigravity CLI was not found. Install agy or set ENG_TRAINER_AGY_BIN to its executable.",
        )
    })?;
    run_background_json_with(&binary, prompt, schema)
}

pub(crate) fn run_background_json_with(
    binary: &Path,
    prompt: &str,
    schema: &str,
) -> Result<Value, ProviderError> {
    let workspace = ScratchDirectory::new().map_err(|_| {
        ProviderError::new(
            ProviderErrorCode::ProcessFailed,
            "Could not create a temporary workspace.",
        )
    })?;
    let schema_path = workspace.path().join("response-schema.json");
    fs::write(&schema_path, schema).map_err(|_| {
        ProviderError::new(
            ProviderErrorCode::ProcessFailed,
            "Could not prepare the response format.",
        )
    })?;
    let output = run_cli(
        binary,
        workspace.path(),
        &schema_path,
        &workspace.path().join("agy.log"),
        prompt,
        CliOptions {
            timeout: STRUCTURED_TIMEOUT,
            model: STRUCTURED_MODEL,
        },
    )?;
    parse_payload(&output)
}

fn invalid_output() -> ProviderError {
    ProviderError::new(
        ProviderErrorCode::InvalidOutput,
        "The background provider returned output that could not be read.",
    )
}

fn quota_or_invalid_output(output: &str) -> ProviderError {
    if !mentions_quota(output) {
        return invalid_output();
    }
    runner::record_quota_limit(STRUCTURED_MODEL, output);
    quota_error()
}

fn parse_payload(output: &str) -> Result<Value, ProviderError> {
    let envelope: Envelope =
        serde_json::from_str(output).map_err(|_| quota_or_invalid_output(output))?;
    if envelope.status != "SUCCESS" {
        return Err(quota_or_invalid_output(output));
    }
    match envelope.structured_output {
        Some(Value::String(text)) => serde_json::from_str(&text).map_err(|_| invalid_output()),
        Some(Value::Null) | None => json_in_text(envelope.response.as_deref()),
        Some(value) => Ok(value),
    }
}

fn json_in_text(text: Option<&str>) -> Result<Value, ProviderError> {
    let text = text.ok_or_else(invalid_output)?;
    let start = text.find('{').ok_or_else(invalid_output)?;
    let end = text.rfind('}').ok_or_else(invalid_output)?;
    if end < start {
        return Err(invalid_output());
    }
    serde_json::from_str(&text[start..=end]).map_err(|_| invalid_output())
}

#[cfg(test)]
#[path = "structured_tests.rs"]
mod tests;
