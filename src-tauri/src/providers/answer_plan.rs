//! Validated answer help returned by a provider.

use super::{ProviderError, ProviderErrorCode};
use serde::{Deserialize, Serialize};

const MAX_RAW_CHARS: usize = 8_000;
const MAX_ITEM_CHARS: usize = 120;
const MAX_LONG_FIELD_CHARS: usize = 500;
const MAX_WORDS: usize = 60;

#[derive(Debug, Clone, Eq, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct AnswerPlan {
    pub frame: Vec<String>,
    pub phrases: Vec<String>,
    pub model_answer: String,
    pub adaptation: String,
}

/// Parses provider JSON and accepts it only when every field fits the help contract.
pub fn parse_answer_plan(raw: &str) -> Result<AnswerPlan, ProviderError> {
    if raw.chars().count() > MAX_RAW_CHARS {
        return Err(invalid_plan());
    }
    let plan: AnswerPlan = serde_json::from_str(raw).map_err(|_| invalid_plan())?;
    validate(&plan)?;
    Ok(plan)
}

fn validate(plan: &AnswerPlan) -> Result<(), ProviderError> {
    if plan.frame.len() != 3
        || plan
            .frame
            .iter()
            .any(|item| !valid_text(item, MAX_ITEM_CHARS, MAX_WORDS))
        || !(3..=5).contains(&plan.phrases.len())
        || plan
            .phrases
            .iter()
            .any(|item| !valid_text(item, MAX_ITEM_CHARS, MAX_WORDS))
        || !valid_text(&plan.model_answer, MAX_LONG_FIELD_CHARS, MAX_WORDS)
        || !valid_text(&plan.adaptation, MAX_LONG_FIELD_CHARS, MAX_WORDS)
        || plan.model_answer.contains(['[', ']'])
        || !has_bracketed_slot(&plan.adaptation)
        || !plan.model_answer.trim_end().ends_with(['.', '!', '?', '…'])
    {
        return Err(invalid_plan());
    }
    Ok(())
}

fn valid_text(value: &str, max_chars: usize, max_words: usize) -> bool {
    let trimmed = value.trim();
    !trimmed.is_empty()
        && value.chars().count() <= max_chars
        && trimmed.split_whitespace().count() <= max_words
        && !value.chars().any(|character| {
            character.is_control() || (character.is_alphabetic() && !character.is_ascii())
        })
        && !contains_markdown_or_code(trimmed)
}

fn contains_markdown_or_code(value: &str) -> bool {
    let starts_as_list = value.starts_with("- ")
        || value.starts_with("* ")
        || value.starts_with("+ ")
        || value.starts_with("> ")
        || [". ", ") "].iter().any(|separator| {
            value.split_once(separator).is_some_and(|(prefix, _)| {
                !prefix.is_empty() && prefix.chars().all(|character| character.is_ascii_digit())
            })
        });
    starts_as_list
        || value
            .chars()
            .any(|character| matches!(character, '`' | '*' | '_' | '#' | '{' | '}' | '<' | '>'))
        || value.contains("](")
}

fn has_bracketed_slot(value: &str) -> bool {
    match (value.find('['), value.find(']')) {
        (Some(open), Some(close)) => open < close && close > open + 1,
        _ => false,
    }
}

fn invalid_plan() -> ProviderError {
    ProviderError::new(
        ProviderErrorCode::InvalidOutput,
        "Gemini returned answer help the app could not use. Please retry.",
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    const VALID: &str = r#"{
      "frame":["State your view","Give a reason","Share an example"],
      "phrases":["From my perspective","One reason is","For example"],
      "model_answer":"I prefer remote work because it gives me more quiet time. For example, I can focus on a difficult task without a long commute.",
      "adaptation":"I prefer [work style] because [reason]. For example, [personal example]."
    }"#;

    #[test]
    fn parses_three_steps_phrases_and_a_bounded_example() {
        let plan = parse_answer_plan(VALID).expect("valid plan");
        assert_eq!(plan.frame.len(), 3);
        assert!((3..=5).contains(&plan.phrases.len()));
        assert!(plan.model_answer.split_whitespace().count() <= 60);
    }

    #[test]
    fn rejects_wrong_counts_unknown_fields_and_oversized_json() {
        let wrong_frame = VALID.replace(
            "\"Share an example\"",
            "\"Give an example\",\"Add a detail\"",
        );
        assert_eq!(
            parse_answer_plan(&wrong_frame).unwrap_err().code,
            ProviderErrorCode::InvalidOutput
        );
        let too_many_phrases = VALID.replace(
            "\"For example\"]",
            "\"For example\",\"Another phrase\",\"One more phrase\",\"Last phrase\"]",
        );
        assert_eq!(
            parse_answer_plan(&too_many_phrases).unwrap_err().code,
            ProviderErrorCode::InvalidOutput
        );
        assert_eq!(
            parse_answer_plan(&VALID.replace("\"frame\":", "\"extra\":true,\"frame\":"))
                .unwrap_err()
                .code,
            ProviderErrorCode::InvalidOutput
        );
        assert_eq!(
            parse_answer_plan(&" ".repeat(MAX_RAW_CHARS + 1))
                .unwrap_err()
                .code,
            ProviderErrorCode::InvalidOutput
        );
    }

    #[test]
    fn rejects_control_non_english_markdown_and_unbracketed_slots() {
        for malformed in [
            VALID.replace("State your view", "State\nyour view"),
            VALID.replace("State your view", "State your café view"),
            VALID.replace("State your view", "**State your view**"),
            VALID.replace("State your view", "+ State your view"),
            VALID.replace("State your view", "1) State your view"),
            VALID.replace("State your view", "[Visit](https://example.test)"),
            VALID.replace(
                "I prefer [work style] because [reason]. For example, [personal example].",
                "I prefer work because of a reason. For example, a personal example.",
            ),
        ] {
            assert_eq!(
                parse_answer_plan(&malformed).unwrap_err().code,
                ProviderErrorCode::InvalidOutput
            );
        }
    }

    #[test]
    fn never_echoes_bad_provider_content_in_errors() {
        let secret_text = "private learner detail";
        let malformed = VALID
            .replace("State your view", secret_text)
            .replace("Share an example", "```bad```");
        let error = parse_answer_plan(&malformed).unwrap_err();
        assert!(!error.message.contains(secret_text));
    }
}
