use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, TS)]
#[serde(rename_all = "snake_case")]
#[ts(export)]
pub enum RuleKey {
    PastSimpleVsPresentPerfect,
    PastPerfect,
    PresentSimpleVsContinuous,
    FutureForms,
    Conditionals,
    SubjectVerbAgreement,
    Articles,
    Prepositions,
    QuestionWordOrder,
    EmbeddedQuestionOrder,
    WordOrder,
    PluralAndCountable,
    Comparatives,
    GerundVsInfinitive,
    ModalVerbs,
    WordChoice,
    Collocation,
    Other,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct RuleInfo {
    pub key: RuleKey,
    pub title: &'static str,
    pub summary: &'static str,
}

const fn rule(key: RuleKey, title: &'static str, summary: &'static str) -> RuleInfo {
    RuleInfo {
        key,
        title,
        summary,
    }
}

pub const RULES: [RuleInfo; 18] = [
    rule(
        RuleKey::PastSimpleVsPresentPerfect,
        "Past Simple vs Present Perfect",
        "Past Simple is for a finished time; Present Perfect links the past to now.",
    ),
    rule(
        RuleKey::PastPerfect,
        "Past Perfect",
        "Past Perfect shows what happened before another moment in the past.",
    ),
    rule(
        RuleKey::PresentSimpleVsContinuous,
        "Present Simple vs Continuous",
        "Present Simple is for habits and facts; Continuous is for what is happening now.",
    ),
    rule(
        RuleKey::FutureForms,
        "Future forms",
        "Will, going to and Present Continuous each say something different about the future.",
    ),
    rule(
        RuleKey::Conditionals,
        "Conditionals",
        "The tense after if depends on how real or likely the situation is.",
    ),
    rule(
        RuleKey::SubjectVerbAgreement,
        "Subject-verb agreement",
        "The verb agrees with its subject in number and person.",
    ),
    rule(
        RuleKey::Articles,
        "Articles",
        "A, an and the depend on whether the noun is new, known or unique.",
    ),
    rule(
        RuleKey::Prepositions,
        "Prepositions",
        "Prepositions of time, place and direction are fixed with many words.",
    ),
    rule(
        RuleKey::QuestionWordOrder,
        "Word order in questions",
        "Questions put the auxiliary verb before the subject.",
    ),
    rule(
        RuleKey::EmbeddedQuestionOrder,
        "Word order in embedded questions",
        "After I wonder or Do you know, the order goes back to subject then verb.",
    ),
    rule(
        RuleKey::WordOrder,
        "Word order",
        "English sentences follow a fixed order of subject, verb, object and place or time.",
    ),
    rule(
        RuleKey::PluralAndCountable,
        "Plurals and countable nouns",
        "Countable nouns take plurals and a or many; uncountable nouns take much.",
    ),
    rule(
        RuleKey::Comparatives,
        "Comparatives and superlatives",
        "Short adjectives take -er and -est; long ones take more and most.",
    ),
    rule(
        RuleKey::GerundVsInfinitive,
        "Gerund vs infinitive",
        "Some verbs take -ing, some take to plus a verb, and some change meaning.",
    ),
    rule(
        RuleKey::ModalVerbs,
        "Modal verbs",
        "Can, must, should and might are followed by the base verb and express attitude.",
    ),
    rule(
        RuleKey::WordChoice,
        "Word choice",
        "A near synonym or false friend says something different from what you mean.",
    ),
    rule(
        RuleKey::Collocation,
        "Collocations",
        "Some words go together naturally and others sound wrong.",
    ),
    rule(
        RuleKey::Other,
        "Something else",
        "A mistake that fits none of the rules above.",
    ),
];

impl RuleKey {
    pub fn info(self) -> &'static RuleInfo {
        RULES
            .iter()
            .find(|info| info.key == self)
            .unwrap_or(&RULES[RULES.len() - 1])
    }

    pub fn as_str(self) -> &'static str {
        match self {
            Self::PastSimpleVsPresentPerfect => "past_simple_vs_present_perfect",
            Self::PastPerfect => "past_perfect",
            Self::PresentSimpleVsContinuous => "present_simple_vs_continuous",
            Self::FutureForms => "future_forms",
            Self::Conditionals => "conditionals",
            Self::SubjectVerbAgreement => "subject_verb_agreement",
            Self::Articles => "articles",
            Self::Prepositions => "prepositions",
            Self::QuestionWordOrder => "question_word_order",
            Self::EmbeddedQuestionOrder => "embedded_question_order",
            Self::WordOrder => "word_order",
            Self::PluralAndCountable => "plural_and_countable",
            Self::Comparatives => "comparatives",
            Self::GerundVsInfinitive => "gerund_vs_infinitive",
            Self::ModalVerbs => "modal_verbs",
            Self::WordChoice => "word_choice",
            Self::Collocation => "collocation",
            Self::Other => "other",
        }
    }

    pub fn parse(text: &str) -> Option<Self> {
        RULES
            .iter()
            .map(|info| info.key)
            .find(|key| key.as_str() == text.trim())
    }

    pub fn counts_as_back_again(self) -> bool {
        self != Self::Other
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashSet;

    #[test]
    fn every_key_round_trips_through_its_text_and_serde_name() {
        for info in RULES {
            assert_eq!(RuleKey::parse(info.key.as_str()), Some(info.key));
            let json = serde_json::to_string(&info.key).unwrap();
            assert_eq!(json, format!("\"{}\"", info.key.as_str()));
            assert_eq!(info.key.info().key, info.key);
        }
    }

    #[test]
    fn keys_titles_and_summaries_are_unique_and_filled() {
        let keys: HashSet<_> = RULES.iter().map(|info| info.key.as_str()).collect();
        let titles: HashSet<_> = RULES.iter().map(|info| info.title).collect();
        assert_eq!(keys.len(), RULES.len());
        assert_eq!(titles.len(), RULES.len());
        assert!(RULES
            .iter()
            .all(|info| !info.title.is_empty() && info.summary.ends_with('.')));
    }

    #[test]
    fn unknown_keys_do_not_parse() {
        assert_eq!(RuleKey::parse("tenses"), None);
        assert_eq!(RuleKey::parse(""), None);
    }

    #[test]
    fn only_other_never_counts_as_back_again() {
        let excluded: Vec<_> = RULES
            .iter()
            .filter(|info| !info.key.counts_as_back_again())
            .map(|info| info.key)
            .collect();
        assert_eq!(excluded, [RuleKey::Other]);
    }
}
