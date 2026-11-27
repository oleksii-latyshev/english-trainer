use super::super::agy::rescue::{make_prompt, response_schema};
use super::super::rescue::{parse_rescue_response, RescueRequest};
use super::super::{ProviderError, RescueResponse};
use super::runner::{for_feature, resolve_or_unavailable, run_json};
use std::time::Duration;

const RESCUE_TIMEOUT: Duration = Duration::from_secs(20);

pub(crate) fn generate_rescue(request: &RescueRequest) -> Result<RescueResponse, ProviderError> {
    request.validate()?;
    let payload = resolve_or_unavailable()
        .and_then(|binary| {
            run_json(
                &binary,
                &make_prompt(request),
                &response_schema(request.kind),
                RESCUE_TIMEOUT,
            )
        })
        .map_err(|error| for_feature(error, "Rescue help", "Keep speaking and try again later."))?;
    parse_rescue_response(&payload.to_string(), request.kind)
}
