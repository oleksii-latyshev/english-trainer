use crate::{
    learning::normalize_phrase,
    providers::{ProviderError, ProviderErrorCode},
};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;

const MAX_RAW_CHARS: usize = 16_000;
const MAX_PHRASES: usize = 3;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct WrapupAnswer {
    pub sequence: usize,
    pub question: String,
    pub transcript: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct WrapupRequest {
    pub answers: Vec<WrapupAnswer>,
}

impl WrapupRequest {
    pub fn validate(&self) -> Result<(), ProviderError> {
        if !(1..=24).contains(&self.answers.len()) {
            return Err(invalid_request());
        }
        let mut sequences = HashSet::new();
        let mut transcript_chars = 0;
        for answer in &self.answers {
            if answer.sequence == 0
                || !sequences.insert(answer.sequence)
                || answer.question.trim().is_empty()
                || answer.question.chars().count() > 500
                || answer.transcript.trim().is_empty()
                || answer.transcript.chars().count() > 1_500
                || has_forbidden_input_control(&answer.question)
                || has_forbidden_input_control(&answer.transcript)
            {
                return Err(invalid_request());
            }
            transcript_chars += answer.transcript.chars().count();
        }
        if transcript_chars > 12_000 {
            return Err(invalid_request());
        }
        Ok(())
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct GeneratedWrapupPhrase {
    pub sequence: usize,
    pub phrase: String,
    pub note: String,
    pub you_said: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct WrapupResult {
    pub phrases: Vec<GeneratedWrapupPhrase>,
}

pub fn parse_wrapup_result(
    raw: &str,
    request: &WrapupRequest,
) -> Result<WrapupResult, ProviderError> {
    request.validate()?;
    if raw.chars().count() > MAX_RAW_CHARS {
        return Err(invalid_output());
    }
    let mut result: WrapupResult = serde_json::from_str(raw).map_err(|_| invalid_output())?;
    if result.phrases.len() > MAX_PHRASES {
        return Err(invalid_output());
    }
    let answers: std::collections::HashMap<_, _> = request
        .answers
        .iter()
        .map(|answer| (answer.sequence, answer.transcript.as_str()))
        .collect();
    let mut normalized_phrases = HashSet::new();
    for phrase in &mut result.phrases {
        phrase.phrase = phrase.phrase.trim().to_owned();
        phrase.note = phrase.note.trim().to_owned();
        phrase.you_said = phrase.you_said.trim().to_owned();
        let Some(transcript) = answers.get(&phrase.sequence) else {
            return Err(invalid_output());
        };
        if phrase.sequence == 0
            || phrase.phrase.chars().count() > 300
            || phrase.note.chars().count() > 160
            || phrase.you_said.chars().count() > 160
            || word_count(&phrase.phrase) > 40
            || word_count(&phrase.note) > 24
            || !transcript.contains(&phrase.you_said)
            || !plain_english(&phrase.phrase)
            || !plain_english(&phrase.note)
            || !plain_english(&phrase.you_said)
        {
            return Err(invalid_output());
        }
        let normalized = normalize_phrase(&phrase.phrase);
        if normalized.is_empty() || !normalized_phrases.insert(normalized) {
            return Err(invalid_output());
        }
        if normalize_phrase(&phrase.note) == normalize_phrase(&phrase.you_said) {
            return Err(invalid_output());
        }
    }
    Ok(result)
}

fn has_forbidden_input_control(text: &str) -> bool {
    text.chars().any(|character| {
        character == '\0' || (character.is_control() && !character.is_whitespace())
    })
}

fn plain_english(text: &str) -> bool {
    !text.trim().is_empty()
        && !text.chars().any(|character| {
            character.is_control()
                || (character.is_alphabetic() && !character.is_ascii())
                || matches!(
                    character,
                    '`' | '*' | '_' | '#' | '[' | ']' | '{' | '}' | '|' | '<' | '>'
                )
        })
        && text
            .chars()
            .any(|character| character.is_ascii_alphabetic())
}

fn word_count(text: &str) -> usize {
    text.split_whitespace().count()
}

fn invalid_request() -> ProviderError {
    ProviderError::new(
        ProviderErrorCode::InvalidRequest,
        "Session wrap-up could not use these answers. Keep practicing and try again.",
    )
}

pub(super) fn invalid_output() -> ProviderError {
    ProviderError::new(
        ProviderErrorCode::InvalidOutput,
        "Session wrap-up could not use the generated phrases. Keep practicing and try again.",
    )
}

#[cfg(test)]
#[path = "session_wrapup_tests.rs"]
mod tests;
