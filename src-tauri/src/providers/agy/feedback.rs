//! Checks shared by everything that turns model output into coaching text.

use serde_json::Value;

/// A model-written coaching string: one plain line, within the limit, no markdown or embedded JSON.
pub(super) fn validate_feedback_text(value: &str, max_chars: usize) -> Result<String, ()> {
    let value = value.trim();
    if value.is_empty()
        || value.chars().count() > max_chars
        || value.chars().any(|character| character.is_control())
        || value.contains(['\n', '\r', '`', '#', '*', '_', '{', '}', '[', ']', '<', '>'])
        || value.starts_with(['-', '>'])
        || serde_json::from_str::<Value>(value).is_ok()
    {
        return Err(());
    }
    Ok(value.to_string())
}

/// True when `original` is a quote from `transcript`, ignoring case and punctuation.
pub(super) fn is_transcript_excerpt(original: &str, transcript: &str) -> bool {
    let original_words = normalized_words(original);
    let transcript_words = normalized_words(transcript);
    !original_words.is_empty()
        && transcript_words
            .windows(original_words.len())
            .any(|window| window == original_words)
}

fn normalized_words(value: &str) -> Vec<String> {
    value
        .split(|character: char| !character.is_alphanumeric())
        .filter(|word| !word.is_empty())
        .map(str::to_lowercase)
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn coaching_text_must_be_one_plain_line_within_the_limit() {
        assert!(validate_feedback_text("Use the past form.", 50).is_ok());
        assert!(validate_feedback_text("**do this**", 50).is_err());
        assert!(validate_feedback_text("{\"rewrite\":\"x\"}", 50).is_err());
        assert!(validate_feedback_text("two\nlines", 50).is_err());
        assert!(validate_feedback_text(&"x".repeat(301), 300).is_err());
    }

    #[test]
    fn a_quote_must_occur_in_the_transcript() {
        assert!(is_transcript_excerpt(
            "I go, yesterday!",
            "Well, I go yesterday."
        ));
        assert!(!is_transcript_excerpt(
            "I went yesterday",
            "I go yesterday."
        ));
        assert!(!is_transcript_excerpt("", "I go yesterday."));
    }
}
