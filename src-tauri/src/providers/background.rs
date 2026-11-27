//! Background analysis runs on the Claude Code CLI. `agy` is the legacy adapter and answers only
//! when Claude is not installed but `agy` is.

use super::{
    agy, claude, CoachedAnswer, CoachingAnswer, ProviderError, RescueRequest, RescueResponse,
    ReviewMaterialRequest, ReviewMaterialResult, UsageReviewRequest, UsageReviewResponse,
};
use crate::learning::mistake_practice::{GeneratedMistakeQuestion, MistakePracticeCandidate};
use serde_json::Value;

fn legacy_only() -> bool {
    claude::runner::resolve_binary().is_none() && agy::resolve_binary().is_some()
}

pub fn generate_review_material(
    request: &ReviewMaterialRequest,
) -> Result<ReviewMaterialResult, ProviderError> {
    if legacy_only() {
        return agy::spoken_review::generate_review_material(request);
    }
    claude::spoken_review::generate_review_material(request)
}

pub fn run_background_json(prompt: &str, schema: &str) -> Result<Value, ProviderError> {
    if legacy_only() {
        return agy::structured::run_background_json(prompt, schema);
    }
    claude::structured::run_background_json(prompt, schema)
}

/// Checks up to five answers with one background call; see `claude::coaching`.
pub fn coach_answers(answers: &[CoachingAnswer]) -> Result<Vec<CoachedAnswer>, ProviderError> {
    if legacy_only() {
        return agy::coaching::coach_answers(answers);
    }
    claude::coaching::coach_answers(answers)
}

pub fn review_turn_usage(
    request: &UsageReviewRequest,
) -> Result<UsageReviewResponse, ProviderError> {
    if legacy_only() {
        return agy::review_turn_usage(request);
    }
    claude::usage::review_turn_usage(request)
}

pub fn generate_rescue(request: &RescueRequest) -> Result<RescueResponse, ProviderError> {
    if legacy_only() {
        return agy::rescue::generate_rescue(request);
    }
    claude::rescue::generate_rescue(request)
}

pub fn generate_mistake_questions(
    candidates: &[MistakePracticeCandidate],
) -> Result<Vec<GeneratedMistakeQuestion>, ProviderError> {
    if legacy_only() {
        return agy::mistake_practice::generate(candidates);
    }
    claude::mistake_practice::generate(candidates)
}
