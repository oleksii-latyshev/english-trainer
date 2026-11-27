//! Which words the Debrief lets the learner take: a learning decision, so it lives in Rust.

use super::TurnCoaching;
use crate::learning::{contains_phrase, normalize_phrase};
use crate::providers::{FocusCategory, TurnFeedback};
use serde::Serialize;
use std::collections::HashSet;

/// Words offered for taking across one whole session.
pub const MAX_DEBRIEF_WORDS: usize = 5;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, ts_rs::TS)]
#[ts(export)]
pub struct DebriefWord {
    pub sequence: usize,
    pub phrase: String,
    pub meaning: String,
    pub example: String,
}

/// A taken word the learner used on their own in this session, as the usage review saw it.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, ts_rs::TS)]
#[ts(export)]
pub struct DebriefWin {
    pub sequence: usize,
    pub phrase: String,
}

/// Where a word came from, best first: the learner was looking for it, it makes a plain fragment
/// better, it fixes a word choice, or it only appears in the better version.
#[derive(Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
enum Source {
    Gap,
    Upgrade,
    VocabularyMistake,
    Other,
}

fn source_of(phrase: &str, feedback: &TurnFeedback) -> Source {
    let overlaps = |text: &str| contains_phrase(text, phrase) || contains_phrase(phrase, text);
    if feedback.gaps.iter().any(|gap| overlaps(&gap.word)) {
        Source::Gap
    } else if feedback
        .upgrades
        .iter()
        .any(|upgrade| contains_phrase(&upgrade.improved, phrase))
    {
        Source::Upgrade
    } else if feedback.focus_feedback.iter().any(|mistake| {
        mistake.category == FocusCategory::Vocabulary && contains_phrase(&mistake.improved, phrase)
    }) {
        Source::VocabularyMistake
    } else {
        Source::Other
    }
}

/// At most `MAX_DEBRIEF_WORDS` words from the ready answers (answer `n` is `coaching[n - 1]`):
/// missing words first, then better words, then vocabulary fixes, then the rest, each group in
/// answer order, without repeats.
pub fn pick_debrief_words(coaching: &[TurnCoaching]) -> Vec<DebriefWord> {
    let mut candidates: Vec<(Source, DebriefWord)> = coaching
        .iter()
        .enumerate()
        .filter_map(|(index, state)| match state {
            TurnCoaching::Ready { feedback } => Some((index + 1, feedback)),
            _ => None,
        })
        .flat_map(|(sequence, feedback)| {
            feedback.words_to_take.iter().map(move |word| {
                (
                    source_of(&word.phrase, feedback),
                    DebriefWord {
                        sequence,
                        phrase: word.phrase.clone(),
                        meaning: word.meaning.clone(),
                        example: word.example.clone(),
                    },
                )
            })
        })
        .collect();
    candidates.sort_by_key(|(source, _)| *source);
    let mut seen = HashSet::new();
    candidates
        .into_iter()
        .map(|(_, word)| word)
        .filter(|word| seen.insert(normalize_phrase(&word.phrase)))
        .take(MAX_DEBRIEF_WORDS)
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::providers::{FocusFeedback, Gap, Upgrade, WordToTake};

    fn word(phrase: &str) -> WordToTake {
        WordToTake {
            phrase: phrase.into(),
            meaning: "meaning".into(),
            example: format!("An example with {phrase}."),
        }
    }

    fn ready(feedback: TurnFeedback) -> TurnCoaching {
        TurnCoaching::Ready { feedback }
    }

    fn plain(words: &[&str]) -> TurnCoaching {
        ready(TurnFeedback {
            b2_rewrite: "A rewrite.".into(),
            words_to_take: words.iter().map(|phrase| word(phrase)).collect(),
            ..Default::default()
        })
    }

    fn phrases(words: &[DebriefWord]) -> Vec<&str> {
        words.iter().map(|word| word.phrase.as_str()).collect()
    }

    #[test]
    fn never_more_than_five_across_the_session() {
        let distinct: Vec<TurnCoaching> = (0..6)
            .map(|index| plain(&[&format!("a{index}"), &format!("b{index}")]))
            .collect();

        assert_eq!(pick_debrief_words(&distinct).len(), MAX_DEBRIEF_WORDS);
    }

    #[test]
    fn missing_words_come_first_then_better_words_then_vocabulary_fixes_in_answer_order() {
        let other = plain(&["plain extra"]);
        let vocabulary = ready(TurnFeedback {
            focus_feedback: vec![FocusFeedback {
                category: FocusCategory::Vocabulary,
                original: "do a decision".into(),
                improved: "make a decision".into(),
                explanation: "Collocation.".into(),
            }],
            b2_rewrite: "I make a decision.".into(),
            words_to_take: vec![word("make a decision")],
            ..Default::default()
        });
        let upgrade = ready(TurnFeedback {
            upgrades: vec![Upgrade {
                original: "very tired".into(),
                improved: "exhausted".into(),
                explanation: "Stronger.".into(),
            }],
            b2_rewrite: "I was exhausted.".into(),
            words_to_take: vec![word("exhausted")],
            ..Default::default()
        });
        let gap = ready(TurnFeedback {
            gaps: vec![Gap {
                original: "the thing for meeting".into(),
                word: "agenda".into(),
                meaning: "a list of topics".into(),
            }],
            b2_rewrite: "I wrote the agenda.".into(),
            words_to_take: vec![word("agenda")],
            ..Default::default()
        });

        let words = pick_debrief_words(&[other, vocabulary, upgrade, gap]);

        assert_eq!(
            phrases(&words),
            ["agenda", "exhausted", "make a decision", "plain extra"]
        );
        assert_eq!(words[0].sequence, 4);
    }

    #[test]
    fn a_repeated_word_is_offered_once_whatever_its_case() {
        let words = pick_debrief_words(&[plain(&["Look into"]), plain(&["look into", "fresh"])]);

        assert_eq!(phrases(&words), ["Look into", "fresh"]);
        assert_eq!(words[0].sequence, 1);
    }

    #[test]
    fn answers_without_feedback_offer_nothing() {
        let words = pick_debrief_words(&[
            TurnCoaching::Pending,
            TurnCoaching::Failed,
            TurnCoaching::Paused,
        ]);

        assert!(words.is_empty());
    }
}
