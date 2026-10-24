use serde::{Deserialize, Serialize};
use std::fmt::{Display, Formatter};
use ts_rs::TS;

pub const NATIVE_LANGUAGES: &[&str] = &[
    "ru", "uk", "de", "fr", "es", "it", "pt", "ja", "ko", "zh-Hans", "ar",
];

pub const MAX_PHRASE_WORDS: usize = 8;
pub const MAX_PHRASE_CHARS: usize = 120;
const MAX_CONTEXT_CHARS: usize = 500;
const MAX_TRANSLATION_CHARS: usize = 600;
const MAX_EXPLANATION_CHARS: usize = 500;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(deny_unknown_fields)]
#[ts(export)]
pub struct NativeLanguageSettings {
    pub native_language: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(deny_unknown_fields)]
#[ts(export)]
pub struct TranslationRequest {
    pub text: String,
    pub context: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(deny_unknown_fields)]
#[ts(export)]
pub struct TextTranslation {
    pub text: String,
    pub native_language: String,
    pub translation: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(deny_unknown_fields)]
#[ts(export)]
pub struct TextExplanation {
    pub text: String,
    pub english_explanation: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "snake_case")]
#[ts(export)]
pub enum TranslationStatusKind {
    Installed,
    DownloadRequired,
    Unsupported,
    Unavailable,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(deny_unknown_fields)]
#[ts(export)]
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
            "Enter an English word or a short phrase (up to 8 words) and try again.",
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
    if request.context.chars().count() > MAX_CONTEXT_CHARS || has_unsafe_control(&request.context) {
        return Err(TranslationError::invalid_request());
    }
    request.text = normalize_phrase(&request.text).ok_or_else(TranslationError::invalid_request)?;
    Ok(())
}

fn normalize_phrase(raw: &str) -> Option<String> {
    if raw
        .chars()
        .any(|character| character.is_control() && !character.is_whitespace())
    {
        return None;
    }
    let unified = raw.replace(['’', '‘'], "'");
    let collapsed = unified.split_whitespace().collect::<Vec<_>>().join(" ");
    let phrase = collapsed.trim_matches(is_outer_punctuation);
    let tokens: Vec<&str> = phrase.split(' ').collect();
    let is_bounded = !phrase.is_empty()
        && phrase.chars().count() <= MAX_PHRASE_CHARS
        && tokens.len() <= MAX_PHRASE_WORDS;
    let has_letter = phrase
        .chars()
        .any(|character| character.is_ascii_alphabetic());
    (is_bounded && has_letter && tokens.iter().all(|token| is_phrase_token(token)))
        .then(|| phrase.to_string())
}

fn is_sentence_punctuation(character: char) -> bool {
    matches!(
        character,
        ',' | '.' | ';' | ':' | '!' | '?' | '"' | '(' | ')' | '“' | '”'
    )
}

fn is_outer_punctuation(character: char) -> bool {
    is_sentence_punctuation(character) || character == '\''
}

fn is_phrase_token(token: &str) -> bool {
    let core = token.trim_matches(is_sentence_punctuation);
    let has_alphanumeric_edges = core
        .chars()
        .next()
        .zip(core.chars().last())
        .is_some_and(|(first, last)| first.is_ascii_alphanumeric() && last.is_ascii_alphanumeric());
    has_alphanumeric_edges
        && token.chars().all(|character| {
            character.is_ascii_alphanumeric()
                || is_sentence_punctuation(character)
                || matches!(character, '\'' | '-')
        })
        && !["--", "''", "'-", "-'"]
            .iter()
            .any(|sequence| core.contains(sequence))
}

pub fn validate_translation(
    translation: TextTranslation,
    request: &TranslationRequest,
    native_language: &str,
) -> Result<TextTranslation, TranslationError> {
    let is_valid = translation.text.replace(['’', '‘'], "'") == request.text
        && translation.native_language == native_language
        && !translation.translation.trim().is_empty()
        && translation.translation.chars().count() <= MAX_TRANSLATION_CHARS
        && !has_unsafe_control(&translation.translation);
    if is_valid {
        Ok(TextTranslation {
            text: request.text.clone(),
            ..translation
        })
    } else {
        Err(invalid_helper_result())
    }
}

pub fn validate_explanation(
    explanation: TextExplanation,
    request: &TranslationRequest,
) -> Result<TextExplanation, TranslationError> {
    let text = &explanation.english_explanation;
    let is_valid = explanation.text.replace(['’', '‘'], "'") == request.text
        && !text.trim().is_empty()
        && text.chars().count() <= MAX_EXPLANATION_CHARS
        && !has_unsafe_control(text)
        && is_english_text(text);
    if is_valid {
        Ok(TextExplanation {
            text: request.text.clone(),
            ..explanation
        })
    } else {
        Err(invalid_helper_result())
    }
}

fn invalid_helper_result() -> TranslationError {
    TranslationError::new(
        TranslationErrorCode::InvalidOutput,
        "The translation helper returned an invalid result. Please retry.",
    )
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

    fn normalized(text: &str) -> Option<String> {
        let mut request = TranslationRequest {
            text: text.to_string(),
            context: String::new(),
        };
        validate_request(&mut request).ok().map(|_| request.text)
    }

    #[test]
    fn trims_outer_punctuation_and_normalises_a_single_word() {
        assert_eq!(normalized("  “don't,”  ").as_deref(), Some("don't"));
        assert_eq!(normalized("‘don’t’").as_deref(), Some("don't"));
    }

    #[test]
    fn accepts_a_phrase_up_to_eight_words_and_collapses_whitespace() {
        assert_eq!(
            normalized("I have  been working\nhere, really.").as_deref(),
            Some("I have been working here, really")
        );
        assert!(normalized("one two three four five six seven eight").is_some());
        assert!(normalized("one two three four five six seven eight nine").is_none());
    }

    #[test]
    fn rejects_phrases_over_the_character_limit() {
        assert!(normalized(&"a".repeat(MAX_PHRASE_CHARS + 1)).is_none());
        assert!(normalized(&"a".repeat(MAX_PHRASE_CHARS)).is_some());
    }

    #[test]
    fn rejects_non_english_empty_and_malformed_text() {
        for text in [
            "café",
            "привет",
            "",
            "  ",
            "...",
            "2020",
            "-word",
            "word-",
            "a--b",
            "bad\u{0000}",
        ] {
            assert!(normalized(text).is_none(), "{text:?} should be rejected");
        }
    }

    #[test]
    fn rejects_unsafe_context() {
        let mut request = TranslationRequest {
            text: "word".to_string(),
            context: "safe\u{0000}context".to_string(),
        };
        assert!(validate_request(&mut request).is_err());
        request.context = "x".repeat(501);
        assert!(validate_request(&mut request).is_err());
    }

    fn request() -> TranslationRequest {
        TranslationRequest {
            text: "take it for granted".to_string(),
            context: String::new(),
        }
    }

    #[test]
    fn rejects_a_translation_for_another_text_or_language() {
        let translation = |text: &str, language: &str| TextTranslation {
            text: text.to_string(),
            native_language: language.to_string(),
            translation: "принимать как должное".to_string(),
        };
        assert!(
            validate_translation(translation("take it for granted", "ru"), &request(), "ru")
                .is_ok()
        );
        for wrong in [
            translation("other", "ru"),
            translation("take it for granted", "de"),
        ] {
            assert_eq!(
                validate_translation(wrong, &request(), "ru")
                    .unwrap_err()
                    .code,
                TranslationErrorCode::InvalidOutput
            );
        }
    }

    #[test]
    fn rejects_explanations_that_are_not_english() {
        let explanation = |text: &str| TextExplanation {
            text: "take it for granted".to_string(),
            english_explanation: text.to_string(),
        };
        assert!(validate_explanation(
            explanation("To assume something will always be there."),
            &request()
        )
        .is_ok());
        assert_eq!(
            validate_explanation(explanation("слово"), &request())
                .unwrap_err()
                .code,
            TranslationErrorCode::InvalidOutput
        );
    }
}
