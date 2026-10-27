use super::normalization::normalize_phrase;
use super::usage::contains_normalized_words;
use serde::{Deserialize, Serialize};
use ts_rs::TS;

const PLACEHOLDERS: [&str; 8] = [
    "sb",
    "sth",
    "someone",
    "somebody",
    "something",
    "one's",
    "oneself",
    "x",
];
const PLACEHOLDER_MARKS: [&str; 3] = ["…", "...", "___"];
const PARTICLES: [&str; 11] = [
    "up", "out", "off", "on", "in", "down", "over", "back", "away", "through", "around",
];
const OBJECT_PRONOUNS: [&str; 6] = ["it", "them", "me", "him", "her", "us"];
const NOT_A_VERB: [&str; 29] = [
    "a", "an", "the", "in", "on", "at", "for", "to", "of", "by", "with", "from", "about", "my",
    "your", "his", "her", "our", "their", "this", "that", "these", "those", "it", "its", "very",
    "so", "as", "not",
];
const CONNECTORS: [&str; 28] = [
    "it turned out that",
    "on the other hand",
    "as a result",
    "that said",
    "having said that",
    "in addition",
    "for example",
    "for instance",
    "in contrast",
    "in other words",
    "on the contrary",
    "by the way",
    "first of all",
    "in conclusion",
    "to be honest",
    "in fact",
    "in the end",
    "after all",
    "even so",
    "all in all",
    "to sum up",
    "what is more",
    "on top of that",
    "apart from that",
    "at the same time",
    "as a consequence",
    "as long as",
    "even though",
];

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "snake_case")]
#[ts(export)]
pub enum PhraseKind {
    Phrase,
    PhrasalVerb,
    LinkingPhrase,
    Pattern,
}

fn has_placeholder(phrase: &str, words: &[&str]) -> bool {
    PLACEHOLDER_MARKS.iter().any(|mark| phrase.contains(mark))
        || words.iter().any(|word| PLACEHOLDERS.contains(word))
}

fn is_linking_phrase(phrase: &str) -> bool {
    CONNECTORS
        .iter()
        .any(|connector| contains_normalized_words(phrase, connector))
}

fn is_phrasal_verb(words: &[&str]) -> bool {
    let Some((first, rest)) = words.split_first() else {
        return false;
    };
    let Some(particle) = rest.last() else {
        return false;
    };
    let has_object = match rest.len() {
        1 => true,
        2 => OBJECT_PRONOUNS.contains(&rest[0]),
        _ => false,
    };
    has_object && PARTICLES.contains(particle) && !NOT_A_VERB.contains(first)
}

pub fn phrase_kind(phrase: &str) -> PhraseKind {
    let normalized = normalize_phrase(phrase);
    let words: Vec<&str> = normalized.split_whitespace().collect();
    if has_placeholder(&phrase.to_lowercase(), &words) {
        PhraseKind::Pattern
    } else if is_linking_phrase(phrase) {
        PhraseKind::LinkingPhrase
    } else if is_phrasal_verb(&words) {
        PhraseKind::PhrasalVerb
    } else {
        PhraseKind::Phrase
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_verb_with_a_particle_is_a_phrasal_verb() {
        for phrase in [
            "figure out",
            "Come back",
            "turn it down",
            "give up",
            "run through",
        ] {
            assert_eq!(phrase_kind(phrase), PhraseKind::PhrasalVerb, "{phrase}");
        }
    }

    #[test]
    fn a_particle_ending_that_does_not_start_with_a_verb_is_a_phrase() {
        for phrase in ["the end of it", "for two weeks", "at home", "on in"] {
            assert_eq!(phrase_kind(phrase), PhraseKind::Phrase, "{phrase}");
        }
    }

    #[test]
    fn a_connector_is_a_linking_phrase() {
        for phrase in [
            "it turned out that",
            "On the other hand,",
            "as a result",
            "That said, I agree",
        ] {
            assert_eq!(phrase_kind(phrase), PhraseKind::LinkingPhrase, "{phrase}");
        }
    }

    #[test]
    fn a_placeholder_makes_a_pattern() {
        for phrase in [
            "look forward to sth",
            "be good at doing something",
            "It takes X to Y",
            "give sb a hand",
            "make … of it",
        ] {
            assert_eq!(phrase_kind(phrase), PhraseKind::Pattern, "{phrase}");
        }
    }

    #[test]
    fn a_placeholder_wins_over_a_particle() {
        assert_eq!(phrase_kind("pick sth up"), PhraseKind::Pattern);
    }

    #[test]
    fn anything_else_is_a_phrase() {
        for phrase in ["for two weeks", "a piece of cake", "figure"] {
            assert_eq!(phrase_kind(phrase), PhraseKind::Phrase, "{phrase}");
        }
    }
}
