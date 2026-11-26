use super::super::agy::session_wrapup::{make_prompt, SCHEMA};
use super::super::{parse_wrapup_result, ProviderError, WrapupRequest, WrapupResult};
use super::runner::{for_feature, resolve_or_unavailable, run_json};
use std::time::Duration;

const WRAPUP_TIMEOUT: Duration = Duration::from_secs(90);

pub fn generate_session_wrapup(request: &WrapupRequest) -> Result<WrapupResult, ProviderError> {
    request.validate()?;
    let payload = resolve_or_unavailable()
        .and_then(|binary| run_json(&binary, &make_prompt(request), SCHEMA, WRAPUP_TIMEOUT))
        .map_err(|error| {
            for_feature(
                error,
                "Session wrap-up",
                "Keep practicing and try again later.",
            )
        })?;
    parse_wrapup_result(&payload.to_string(), request)
}
