use super::super::agy::spoken_review::{make_prompt, SCHEMA};
use super::super::{
    parse_review_material_result, ProviderError, ReviewMaterialRequest, ReviewMaterialResult,
};
use super::runner::{for_feature, resolve_or_unavailable, run_json};
use std::time::Duration;

const REVIEW_TIMEOUT: Duration = Duration::from_secs(90);

pub fn generate_review_material(
    request: &ReviewMaterialRequest,
) -> Result<ReviewMaterialResult, ProviderError> {
    request.validate()?;
    let payload = resolve_or_unavailable()
        .and_then(|binary| run_json(&binary, &make_prompt(request), SCHEMA, REVIEW_TIMEOUT))
        .map_err(|error| for_feature(error, "Spoken review", "Please try again later."))?;
    parse_review_material_result(&payload.to_string(), request)
}
