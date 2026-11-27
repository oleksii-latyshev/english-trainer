//! What a second try said of the whole better version: a learning decision, so it lives in Rust.
//! Practice only; the result never reaches Memory.

use crate::learning::{contains_phrase, normalize_phrase};
use crate::providers::{AttemptComparison, PhraseCheck, TurnFeedback};
use std::collections::HashSet;

pub fn compare_attempts(
    turn_sequence: usize,
    original: &str,
    retry: &str,
    feedback: &TurnFeedback,
) -> AttemptComparison {
    let words_to_take = feedback
        .words_to_take
        .iter()
        .map(|word| word.phrase.as_str());
    let corrections = feedback
        .focus_feedback
        .iter()
        .map(|focus| focus.improved.as_str())
        .chain(
            feedback
                .upgrades
                .iter()
                .map(|upgrade| upgrade.improved.as_str()),
        )
        .chain(feedback.gaps.iter().map(|gap| gap.word.as_str()));
    AttemptComparison {
        turn_sequence,
        original_transcript: original.to_string(),
        retry_transcript: retry.to_string(),
        target: feedback.b2_rewrite.clone(),
        words_to_take: check_phrases(words_to_take, retry),
        corrections: check_phrases(corrections, retry),
    }
}

fn check_phrases<'a>(phrases: impl Iterator<Item = &'a str>, retry: &str) -> Vec<PhraseCheck> {
    let mut seen = HashSet::new();
    phrases
        .filter(|phrase| {
            let key = normalize_phrase(phrase);
            !key.is_empty() && seen.insert(key)
        })
        .map(|phrase| PhraseCheck {
            phrase: phrase.to_string(),
            said: contains_phrase(retry, phrase),
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::providers::{FocusCategory, FocusFeedback, Gap, Upgrade, WordToTake};

    fn feedback() -> TurnFeedback {
        TurnFeedback {
            focus_feedback: vec![FocusFeedback {
                category: FocusCategory::Grammar,
                original: "I work in there".into(),
                improved: "I work there".into(),
                explanation: "Drop the extra preposition.".into(),
            }],
            b2_rewrite: "I work there and I get my point across.".into(),
            upgrades: vec![Upgrade {
                original: "I tell clearly".into(),
                improved: "get my point across".into(),
                explanation: "More natural.".into(),
            }],
            gaps: vec![Gap {
                original: "the thing for working".into(),
                word: "back up and running".into(),
                meaning: "working again".into(),
            }],
            words_to_take: vec![
                WordToTake {
                    phrase: "get my point across".into(),
                    meaning: "make someone understand".into(),
                    example: "I get my point across.".into(),
                },
                WordToTake {
                    phrase: "back up and running".into(),
                    meaning: "working again".into(),
                    example: "We are back up and running.".into(),
                },
            ],
        }
    }

    fn phrases(checks: &[PhraseCheck]) -> Vec<(&str, bool)> {
        checks
            .iter()
            .map(|check| (check.phrase.as_str(), check.said))
            .collect()
    }

    #[test]
    fn reports_each_word_to_take_and_each_correction_separately() {
        let comparison = compare_attempts(
            2,
            "I work in there",
            "Well, I work there, and I get my point across!",
            &feedback(),
        );
        assert_eq!(comparison.target, "I work there and I get my point across.");
        assert_eq!(
            phrases(&comparison.words_to_take),
            [
                ("get my point across", true),
                ("back up and running", false)
            ]
        );
        assert_eq!(
            phrases(&comparison.corrections),
            [
                ("I work there", true),
                ("get my point across", true),
                ("back up and running", false)
            ]
        );
    }

    #[test]
    fn matching_ignores_case_and_punctuation_but_needs_whole_words_in_order() {
        let comparison = compare_attempts(1, "", "GET MY POINT, across", &feedback());
        assert!(comparison.words_to_take[0].said);
        let scrambled = compare_attempts(1, "", "across my point get", &feedback());
        assert!(!scrambled.words_to_take[0].said);
        let partial = compare_attempts(1, "", "I work thereby", &feedback());
        assert!(!partial.corrections[0].said);
    }

    #[test]
    fn repeated_corrections_are_listed_once_and_empty_ones_are_dropped() {
        let mut repeated = feedback();
        repeated.upgrades[0].improved = "I WORK there".into();
        repeated.gaps[0].word = "  ".into();
        let comparison = compare_attempts(1, "", "I work there", &repeated);
        assert_eq!(phrases(&comparison.corrections), [("I work there", true)]);
    }
}
