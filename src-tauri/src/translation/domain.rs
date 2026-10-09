use serde::{Deserialize, Serialize};
use std::fmt::{Display, Formatter};

pub const NATIVE_LANGUAGES: &[&str] = &[
    "ru", "uk", "de", "fr", "es", "it", "pt", "ja", "ko", "zh-Hans", "ar",
];

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct NativeLanguageSettings {
    pub native_language: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct TranslationRequest {
    pub word: String,
    pub context: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct TranslationResult {
    pub word: String,
    pub native_language: String,
    pub translation: String,
    pub english_explanation: Option<String>,
    pub explanation_error: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TranslationStatusKind {
    Installed,
    DownloadRequired,
    Unsupported,
    Unavailable,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct TranslationStatus {
    pub native_language: String,
    pub status: TranslationStatusKind,
    pub message: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TranslationErrorCode {
    InvalidRequest,
    Unavailable,
    UnsupportedLanguage,
    DownloadRequired,
    Busy,
    Timeout,
    ProcessFailed,
    InvalidOutput,
    DatabaseError,
    Cancelled,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct TranslationError {
    pub code: TranslationErrorCode,
    pub message: String,
}

impl TranslationError {
    pub fn new(code: TranslationErrorCode, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
        }
    }

    pub fn invalid_request() -> Self {
        Self::new(
            TranslationErrorCode::InvalidRequest,
            "Enter one English word (up to 64 letters) and try again.",
        )
    }

    pub fn database() -> Self {
        Self::new(
            TranslationErrorCode::DatabaseError,
            "Could not read or save translation settings locally. Please retry.",
        )
    }
}

impl Display for TranslationError {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> std::fmt::Result {
        formatter.write_str(&self.message)
    }
}

impl std::error::Error for TranslationError {}

pub fn validate_native_language(language: &str) -> Result<(), TranslationError> {
    if NATIVE_LANGUAGES.contains(&language) {
        Ok(())
    } else {
        Err(TranslationError::new(
            TranslationErrorCode::UnsupportedLanguage,
            "Choose a supported native language in Settings and try again.",
        ))
    }
}

pub fn validate_request(request: &mut TranslationRequest) -> Result<(), TranslationError> {
    if request.context.chars().count() > 500
        || request
            .context
            .chars()
            .any(|character| character.is_control() && !matches!(character, '\n' | '\r' | '\t'))
    {
        return Err(TranslationError::invalid_request());
    }

    if request.word.chars().any(char::is_control) {
        return Err(TranslationError::invalid_request());
    }
    let trimmed = request.word.trim().trim_matches(is_surrounding_punctuation);
    let normalized = trimmed.replace(['’', '‘'], "'");
    let word = normalized.as_str();
    if word.is_empty()
        || word.chars().count() > 64
        || !word
            .chars()
            .all(|character| character.is_ascii_alphabetic() || matches!(character, '\'' | '-'))
        || !word
            .chars()
            .next()
            .is_some_and(|character| character.is_ascii_alphabetic())
        || !word
            .chars()
            .last()
            .is_some_and(|character| character.is_ascii_alphabetic())
        || word.contains("--")
        || word.contains("''")
        || word.contains("'-")
        || word.contains("-'")
    {
        return Err(TranslationError::invalid_request());
    }
    request.word = word.to_string();
    Ok(())
}

fn is_surrounding_punctuation(character: char) -> bool {
    (character.is_ascii_punctuation() && !matches!(character, '\'' | '-'))
        || matches!(character, '“' | '”' | '‘' | '’')
}

pub fn validate_result(
    mut result: TranslationResult,
    request: &TranslationRequest,
    native_language: &str,
) -> Result<TranslationResult, TranslationError> {
    if result.word.replace(['’', '‘'], "'") != request.word
        || result.native_language != native_language
        || result.translation.trim().is_empty()
        || result.translation.chars().count() > 300
        || has_unsafe_control(&result.translation)
        || result.english_explanation.is_some() == result.explanation_error.is_some()
        || result.english_explanation.as_ref().is_some_and(|text| {
            text.trim().is_empty()
                || text.chars().count() > 500
                || has_unsafe_control(text)
                || !is_english_text(text)
        })
        || result.explanation_error.as_ref().is_some_and(|text| {
            text.trim().is_empty()
                || text.chars().count() > 500
                || has_unsafe_control(text)
                || !is_english_text(text)
        })
    {
        return Err(TranslationError::new(
            TranslationErrorCode::InvalidOutput,
            "The translation helper returned an invalid result. Please retry.",
        ));
    }
    result.word = request.word.clone();
    Ok(result)
}

fn has_unsafe_control(text: &str) -> bool {
    text.chars()
        .any(|character| character.is_control() && !matches!(character, '\n' | '\r' | '\t'))
}

fn is_english_text(text: &str) -> bool {
    text.chars()
        .any(|character| character.is_ascii_alphabetic())
        && !text
            .chars()
            .any(|character| character.is_alphabetic() && !character.is_ascii())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validates_one_bounded_english_word_and_trims_outer_punctuation() {
        let mut request = TranslationRequest {
            word: "  “don't,”  ".to_string(),
            context: "I don't know.".to_string(),
        };
        validate_request(&mut request).unwrap();
        assert_eq!(request.word, "don't");

        let mut request = TranslationRequest {
            word: "‘don’t’".to_string(),
            context: String::new(),
        };
        validate_request(&mut request).unwrap();
        assert_eq!(request.word, "don't");

        for word in ["two words", "café", "", "word\nnext", "-word", "word-"] {
            let mut request = TranslationRequest {
                word: word.to_string(),
                context: String::new(),
            };
            assert_eq!(
                validate_request(&mut request).unwrap_err().code,
                TranslationErrorCode::InvalidRequest
            );
        }
    }

    #[test]
    fn rejects_controls_and_invalid_helper_outputs() {
        let mut request = TranslationRequest {
            word: "word".to_string(),
            context: "safe\u{0000}context".to_string(),
        };
        assert!(validate_request(&mut request).is_err());

        let request = TranslationRequest {
            word: "word".to_string(),
            context: String::new(),
        };
        let result = TranslationResult {
            word: "other".to_string(),
            native_language: "ru".to_string(),
            translation: "перевод".to_string(),
            english_explanation: Some("Meaning".to_string()),
            explanation_error: None,
        };
        assert_eq!(
            validate_result(result, &request, "ru").unwrap_err().code,
            TranslationErrorCode::InvalidOutput
        );

        let non_english = TranslationResult {
            word: "word".to_string(),
            native_language: "ru".to_string(),
            translation: "перевод".to_string(),
            english_explanation: Some("слово".to_string()),
            explanation_error: None,
        };
        assert_eq!(
            validate_result(non_english, &request, "ru")
                .unwrap_err()
                .code,
            TranslationErrorCode::InvalidOutput
        );
    }
}
