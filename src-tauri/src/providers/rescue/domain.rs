use super::super::{ProviderError, ProviderErrorCode};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;

const MAX_RAW_CHARS: usize = 4_096;
const MAX_SUGGESTION_CHARS: usize = 160;
const MAX_CANDIDATE_CHARS: usize = 64;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RescueKind {
    NextStep,
    Simpler,
    MissingWord,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct RescueRequest {
    pub kind: RescueKind,
    pub question: String,
    pub partial_transcript: String,
    pub description: String,
}

impl RescueRequest {
    pub fn validate(&self) -> Result<(), ProviderError> {
        if !valid_request_text(&self.question, 500, true)
            || !valid_request_text(&self.partial_transcript, 1_500, false)
            || !valid_request_text(&self.description, 300, false)
        {
            return Err(ProviderError::new(
                ProviderErrorCode::InvalidRequest,
                "Could not prepare rescue help from this text. Shorten it and try again.",
            ));
        }
        let valid_kind = match self.kind {
            RescueKind::NextStep | RescueKind::Simpler => {
                !self.partial_transcript.trim().is_empty() && self.description.trim().is_empty()
            }
            RescueKind::MissingWord => !self.description.trim().is_empty(),
        };
        if !valid_kind {
            return Err(ProviderError::new(
                ProviderErrorCode::InvalidRequest,
                "Could not prepare this kind of rescue help. Add the requested English context and try again.",
            ));
        }
        Ok(())
    }
}

#[derive(Debug, Clone, Eq, PartialEq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case", deny_unknown_fields)]
pub enum RescueResponse {
    NextStep { suggestion: String },
    Simpler { suggestion: String },
    MissingWord { candidates: Vec<String> },
}

pub fn parse_rescue_response(
    raw: &str,
    expected_kind: RescueKind,
) -> Result<RescueResponse, ProviderError> {
    if raw.chars().count() > MAX_RAW_CHARS {
        return Err(invalid_output());
    }
    let response: RescueResponse = serde_json::from_str(raw).map_err(|_| invalid_output())?;
    let matches_kind = matches!(
        (&response, expected_kind),
        (RescueResponse::NextStep { .. }, RescueKind::NextStep)
            | (RescueResponse::Simpler { .. }, RescueKind::Simpler)
            | (RescueResponse::MissingWord { .. }, RescueKind::MissingWord)
    );
    if !matches_kind {
        return Err(invalid_output());
    }
    match &response {
        RescueResponse::NextStep { suggestion } | RescueResponse::Simpler { suggestion } => {
            if !valid_suggestion(suggestion) {
                return Err(invalid_output());
            }
        }
        RescueResponse::MissingWord { candidates } => validate_candidates(candidates)?,
    }
    Ok(response)
}

fn valid_request_text(value: &str, limit: usize, required: bool) -> bool {
    let trimmed = value.trim();
    (!required || !trimmed.is_empty())
        && value.chars().count() <= limit
        && !value.chars().any(|character| {
            character.is_control() || (character.is_alphabetic() && !character.is_ascii())
        })
}

fn valid_suggestion(value: &str) -> bool {
    let trimmed = value.trim();
    !trimmed.is_empty()
        && trimmed.chars().count() <= MAX_SUGGESTION_CHARS
        && trimmed.split_whitespace().count() <= 30
        && trimmed
            .chars()
            .any(|character| character.is_ascii_alphabetic())
        && !value.chars().any(|character| {
            character.is_control()
                || (character.is_alphabetic() && !character.is_ascii())
                || "`*_#{}<>".contains(character)
        })
        && !is_markdown_prefix(trimmed)
        && !trimmed.contains("](")
}

fn is_markdown_prefix(value: &str) -> bool {
    ["- ", "* ", "+ ", "> "]
        .iter()
        .any(|prefix| value.starts_with(prefix))
        || [". ", ") "].iter().any(|separator| {
            value.split_once(separator).is_some_and(|(prefix, _)| {
                !prefix.is_empty() && prefix.chars().all(|ch| ch.is_ascii_digit())
            })
        })
}

fn validate_candidates(candidates: &[String]) -> Result<(), ProviderError> {
    if !(3..=5).contains(&candidates.len()) {
        return Err(invalid_output());
    }
    let mut unique = HashSet::new();
    for candidate in candidates {
        let value = candidate.trim();
        if value.is_empty()
            || candidate.chars().any(char::is_control)
            || value.chars().count() > MAX_CANDIDATE_CHARS
            || !(1..=3).contains(&value.split_whitespace().count())
            || !value.split_whitespace().all(valid_candidate_word)
            || !unique.insert(value.to_ascii_lowercase())
        {
            return Err(invalid_output());
        }
    }
    Ok(())
}

fn valid_candidate_word(word: &str) -> bool {
    let bytes = word.as_bytes();
    !bytes.is_empty()
        && bytes[0].is_ascii_alphabetic()
        && bytes[bytes.len() - 1].is_ascii_alphabetic()
        && bytes.iter().enumerate().all(|(index, byte)| {
            byte.is_ascii_alphabetic()
                || ((*byte == b'\'' || *byte == b'-')
                    && index > 0
                    && index + 1 < bytes.len()
                    && bytes[index - 1].is_ascii_alphabetic()
                    && bytes[index + 1].is_ascii_alphabetic())
        })
}

fn invalid_output() -> ProviderError {
    ProviderError::new(
        ProviderErrorCode::InvalidOutput,
        "Rescue help could not be used. Keep speaking or try again.",
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    fn request(kind: RescueKind) -> RescueRequest {
        RescueRequest {
            kind,
            question: "What do you think about remote work?".into(),
            partial_transcript: "I think remote work".into(),
            description: String::new(),
        }
    }

    #[test]
    fn validates_kind_specific_request_context_and_bounds() {
        assert!(request(RescueKind::NextStep).validate().is_ok());
        let mut missing = request(RescueKind::MissingWord);
        missing.partial_transcript.clear();
        missing.description = "A place where people borrow books".into();
        assert!(missing.validate().is_ok());

        let mut wrong_context = request(RescueKind::Simpler);
        wrong_context.description = "extra".into();
        assert_eq!(
            wrong_context.validate().unwrap_err().code,
            ProviderErrorCode::InvalidRequest
        );
        let mut unicode = request(RescueKind::NextStep);
        unicode.question.push('é');
        assert_eq!(
            unicode.validate().unwrap_err().code,
            ProviderErrorCode::InvalidRequest
        );
        let mut oversized = request(RescueKind::NextStep);
        oversized.question = "a".repeat(501);
        assert_eq!(
            oversized.validate().unwrap_err().code,
            ProviderErrorCode::InvalidRequest
        );
    }

    #[test]
    fn parses_valid_suggestions_and_word_candidates() {
        assert_eq!(
            parse_rescue_response(
                r#"{"kind":"next_step","suggestion":"One reason is the shorter commute."}"#,
                RescueKind::NextStep
            )
            .unwrap(),
            RescueResponse::NextStep {
                suggestion: "One reason is the shorter commute.".into()
            }
        );
        assert!(matches!(
            parse_rescue_response(
                r#"{"kind":"missing_word","candidates":["library","book shop","reading room"]}"#,
                RescueKind::MissingWord
            ),
            Ok(RescueResponse::MissingWord { .. })
        ));
    }

    #[test]
    fn rejects_wrong_kind_translation_markdown_and_candidate_explanations() {
        for (raw, kind) in [
            (
                r#"{"kind":"simpler","suggestion":"Say it in an easy way."}"#,
                RescueKind::NextStep,
            ),
            (
                r#"{"kind":"next_step","suggestion":"Поэтому я думаю так."}"#,
                RescueKind::NextStep,
            ),
            (
                r#"{"kind":"next_step","suggestion":"**One reason is this.**"}"#,
                RescueKind::NextStep,
            ),
            (
                r#"{"kind":"missing_word","candidates":["library","library","reading room"]}"#,
                RescueKind::MissingWord,
            ),
            (
                r#"{"kind":"missing_word","candidates":["library","a place for books","reading room"]}"#,
                RescueKind::MissingWord,
            ),
            (
                r#"{"kind":"missing_word","candidates":["one","two"]}"#,
                RescueKind::MissingWord,
            ),
            (
                r#"{"kind":"missing_word","candidates":["book\nshop","library","reading room"]}"#,
                RescueKind::MissingWord,
            ),
            (
                r#"{"kind":"next_step","suggestion":"\nOne reason is the flexibility."}"#,
                RescueKind::NextStep,
            ),
        ] {
            assert_eq!(
                parse_rescue_response(raw, kind).unwrap_err().code,
                ProviderErrorCode::InvalidOutput
            );
        }
        let oversized = format!(
            r#"{{"kind":"next_step","suggestion":"{}"}}"#,
            "a".repeat(MAX_RAW_CHARS)
        );
        assert_eq!(
            parse_rescue_response(&oversized, RescueKind::NextStep)
                .unwrap_err()
                .code,
            ProviderErrorCode::InvalidOutput
        );
    }
}
