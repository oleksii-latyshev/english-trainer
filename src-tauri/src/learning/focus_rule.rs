//! The grammar rule worth practising right after a conversation. Pure selection: no storage.

use crate::mistakes::RuleKey;
use serde::Serialize;

/// What the stored mistakes say about one rule, as seen from one session.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct RuleCount {
    pub rule: RuleKey,
    pub in_session: u32,
    pub open: u32,
    pub came_back: bool,
}

/// The rule the Debrief offers to practise, with its card text and the numbers behind it.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, ts_rs::TS)]
#[ts(export)]
pub struct FocusRule {
    pub rule_key: RuleKey,
    pub title: String,
    pub summary: String,
    /// Mistakes of this rule recorded in the session.
    pub in_session: u32,
    /// Mistakes of this rule that are not fixed yet.
    pub open: u32,
    /// The rule was broken in an earlier session too.
    pub came_back: bool,
}

fn is_vocabulary(rule: RuleKey) -> bool {
    matches!(rule, RuleKey::WordChoice | RuleKey::Collocation)
}

fn is_better(candidate: &RuleCount, best: &RuleCount) -> bool {
    (candidate.in_session, candidate.open) > (best.in_session, best.open)
}

fn best_of<'a>(counts: impl Iterator<Item = &'a RuleCount>) -> Option<&'a RuleCount> {
    counts.fold(None, |best, candidate| match best {
        Some(current) if !is_better(candidate, current) => Some(current),
        _ => Some(candidate),
    })
}

/// The rule with the most mistakes in the session, ties broken by open mistakes of the rule.
/// Grammar rules come first; word choice and collocations only when nothing else was broken, and
/// "something else" never.
pub fn pick_focus_rule(counts: &[RuleCount]) -> Option<FocusRule> {
    let usable = || {
        counts
            .iter()
            .filter(|count| count.in_session > 0 && count.rule.counts_as_back_again())
    };
    let chosen = best_of(usable().filter(|count| !is_vocabulary(count.rule)))
        .or_else(|| best_of(usable()))?;
    let info = chosen.rule.info();
    Some(FocusRule {
        rule_key: chosen.rule,
        title: info.title.to_owned(),
        summary: info.summary.to_owned(),
        in_session: chosen.in_session,
        open: chosen.open,
        came_back: chosen.came_back,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn count(rule: RuleKey, in_session: u32, open: u32) -> RuleCount {
        RuleCount {
            rule,
            in_session,
            open,
            came_back: false,
        }
    }

    #[test]
    fn nothing_recorded_gives_no_rule() {
        assert_eq!(pick_focus_rule(&[]), None);
    }

    #[test]
    fn the_rule_with_most_mistakes_in_the_session_wins() {
        let picked = pick_focus_rule(&[
            count(RuleKey::Articles, 1, 9),
            count(RuleKey::QuestionWordOrder, 3, 3),
        ])
        .unwrap();
        assert_eq!(picked.rule_key, RuleKey::QuestionWordOrder);
        assert_eq!(picked.in_session, 3);
        assert_eq!(picked.open, 3);
    }

    #[test]
    fn a_tie_goes_to_the_rule_with_more_open_mistakes() {
        let picked = pick_focus_rule(&[
            count(RuleKey::Articles, 2, 3),
            count(RuleKey::Prepositions, 2, 5),
        ])
        .unwrap();
        assert_eq!(picked.rule_key, RuleKey::Prepositions);
    }

    #[test]
    fn a_full_tie_keeps_the_first_rule() {
        let picked = pick_focus_rule(&[
            count(RuleKey::Articles, 2, 3),
            count(RuleKey::Prepositions, 2, 3),
        ])
        .unwrap();
        assert_eq!(picked.rule_key, RuleKey::Articles);
    }

    #[test]
    fn something_else_is_never_offered() {
        assert_eq!(pick_focus_rule(&[count(RuleKey::Other, 4, 4)]), None);
    }

    #[test]
    fn word_choice_and_collocations_give_way_to_grammar() {
        let picked = pick_focus_rule(&[
            count(RuleKey::WordChoice, 5, 5),
            count(RuleKey::Collocation, 4, 4),
            count(RuleKey::Articles, 1, 1),
        ])
        .unwrap();
        assert_eq!(picked.rule_key, RuleKey::Articles);
    }

    #[test]
    fn word_choice_is_offered_when_nothing_else_was_broken() {
        let picked = pick_focus_rule(&[
            count(RuleKey::Other, 6, 6),
            count(RuleKey::Collocation, 1, 1),
            count(RuleKey::WordChoice, 2, 2),
        ])
        .unwrap();
        assert_eq!(picked.rule_key, RuleKey::WordChoice);
    }

    #[test]
    fn the_card_text_and_the_relapse_flag_come_along() {
        let picked = pick_focus_rule(&[RuleCount {
            rule: RuleKey::PastPerfect,
            in_session: 2,
            open: 4,
            came_back: true,
        }])
        .unwrap();
        assert_eq!(picked.title, RuleKey::PastPerfect.info().title);
        assert_eq!(picked.summary, RuleKey::PastPerfect.info().summary);
        assert!(picked.came_back);
    }
}
