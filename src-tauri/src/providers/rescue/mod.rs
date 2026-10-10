mod domain;

pub use domain::{parse_rescue_response, RescueKind, RescueRequest, RescueResponse};

pub fn generate_rescue(request: &RescueRequest) -> Result<RescueResponse, super::ProviderError> {
    super::agy::rescue::generate_rescue(request)
}
