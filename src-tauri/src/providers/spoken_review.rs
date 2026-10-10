use crate::{
    conversation::recall::wording_observed,
    learning::{is_safe_phrase_cue, normalize_phrase},
    providers::{ProviderError, ProviderErrorCode},
};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;

const MAX_RAW_CHARS: usize = 24_000;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ReviewTarget {
    pub position: usize,
    pub target: String,
    pub note: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ReviewMaterialRequest {
    pub items: Vec<ReviewTarget>,
}

impl ReviewMaterialRequest {
    pub fn validate(&self) -> Result<(), ProviderError> {
        if !(1..=6).contains(&self.items.len()) {
            return Err(invalid_request());
        }
        let mut positions = HashSet::new();
        for item in &self.items {
            if !(1..=6).contains(&item.position)
                || !positions.insert(item.position)
                || item.target.trim().is_empty()
                || item.target.chars().count() > 300
                || item.note.chars().count() > 500
                || has_forbidden_input_control(&item.target)
                || has_forbidden_input_control(&item.note)
            {
                return Err(invalid_request());
            }
        }
        Ok(())
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct GeneratedReviewMaterial {
    pub position: usize,
    pub situation: String,
    pub model_answer: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ReviewMaterialResult {
    pub items: Vec<GeneratedReviewMaterial>,
}

pub fn parse_review_material_result(
    raw: &str,
    request: &ReviewMaterialRequest,
) -> Result<ReviewMaterialResult, ProviderError> {
    request.validate()?;
    if raw.chars().count() > MAX_RAW_CHARS {
        return Err(invalid_output());
    }
    let result: ReviewMaterialResult = serde_json::from_str(raw).map_err(|_| invalid_output())?;
    if result.items.len() != request.items.len() {
        return Err(invalid_output());
    }
    let mut generated = std::collections::HashMap::new();
    for mut item in result.items {
        item.situation = item.situation.trim().to_owned();
        item.model_answer = item.model_answer.trim().to_owned();
        if generated.insert(item.position, item).is_some() {
            return Err(invalid_output());
        }
    }
    let mut ordered = Vec::with_capacity(request.items.len());
    for target in &request.items {
        let Some(material) = generated.remove(&target.position) else {
            return Err(invalid_output());
        };
        if !valid_material(&material, target) {
            return Err(invalid_output());
        }
        ordered.push(material);
    }
    if !generated.is_empty() {
        return Err(invalid_output());
    }
    Ok(ReviewMaterialResult { items: ordered })
}

fn valid_material(material: &GeneratedReviewMaterial, target: &ReviewTarget) -> bool {
    let situation_words = word_count(&material.situation);
    let answer_words = word_count(&material.model_answer);
    if !(1..=500).contains(&material.situation.chars().count())
        || situation_words > 60
        || !(1..=600).contains(&material.model_answer.chars().count())
        || answer_words > 80
        || !plain_english(&material.situation)
        || !plain_english(&material.model_answer)
        || !is_safe_phrase_cue(&target.target, &material.situation)
        || !wording_observed(&target.target, &material.model_answer)
        || !ends_sentence(&material.model_answer)
    {
        return false;
    }
    let target_words = word_count(&normalize_phrase(&target.target));
    let answer_is_target_sentence = normalize_phrase(&material.model_answer)
        == normalize_phrase(&target.target)
        && is_complete_target_sentence(&target.target);
    answer_is_target_sentence || answer_words >= target_words.saturating_add(2)
}

fn is_complete_target_sentence(target: &str) -> bool {
    let trimmed = target.trim();
    let starts_capitalized = trimmed
        .chars()
        .find(|character| character.is_ascii_alphabetic())
        .is_some_and(|character| character.is_ascii_uppercase());
    starts_capitalized && ends_sentence(trimmed)
}

fn ends_sentence(text: &str) -> bool {
    text.trim_end()
        .chars()
        .last()
        .is_some_and(|character| matches!(character, '.' | '!' | '?'))
}

fn plain_english(text: &str) -> bool {
    !text.trim().is_empty()
        && text
            .chars()
            .any(|character| character.is_ascii_alphabetic())
        && !text.chars().any(|character| {
            character.is_control()
                || (character.is_alphabetic() && !character.is_ascii())
                || matches!(
                    character,
                    '`' | '*' | '_' | '#' | '[' | ']' | '{' | '}' | '|' | '<' | '>'
                )
        })
}

fn word_count(text: &str) -> usize {
    text.split_whitespace().count()
}

fn has_forbidden_input_control(text: &str) -> bool {
    text.chars().any(|character| {
        character == '\0' || (character.is_control() && !character.is_whitespace())
    })
}

fn invalid_request() -> ProviderError {
    ProviderError::new(
        ProviderErrorCode::InvalidRequest,
        "Spoken review could not use these saved targets. Please try again.",
    )
}

pub(super) fn invalid_output() -> ProviderError {
    ProviderError::new(
        ProviderErrorCode::InvalidOutput,
        "Spoken review could not use the generated material. Please try again.",
    )
}

#[cfg(test)]
#[path = "spoken_review_tests.rs"]
mod tests;
