use super::super::agy::usage::{
    make_usage_prompt, usage_response_schema, validate_usage_request, validate_usage_response,
    RawUsageResponse,
};
use super::super::{ProviderError, ProviderErrorCode, UsageReviewRequest, UsageReviewResponse};
use super::runner::{resolve_or_unavailable, run_json};
use std::{path::Path, time::Duration};

const TIMEOUT: Duration = Duration::from_secs(45);

pub(crate) fn review_turn_usage(
    request: &UsageReviewRequest,
) -> Result<UsageReviewResponse, ProviderError> {
    review_usage_with(&resolve_or_unavailable()?, request)
}

pub(crate) fn review_usage_with(
    binary: &Path,
    request: &UsageReviewRequest,
) -> Result<UsageReviewResponse, ProviderError> {
    validate_usage_request(request)?;
    for attempt in 0..2 {
        let payload = run_json(
            binary,
            &make_usage_prompt(request, attempt == 1),
            usage_response_schema(),
            TIMEOUT,
        )?;
        let validated = serde_json::from_value::<RawUsageResponse>(payload)
            .map_err(|_| ())
            .and_then(|raw| validate_usage_response(raw, request));
        if let Ok(response) = validated {
            return Ok(response);
        }
    }
    Err(ProviderError::new(
        ProviderErrorCode::InvalidOutput,
        "The AI review returned invalid findings twice. Please retry.",
    ))
}
