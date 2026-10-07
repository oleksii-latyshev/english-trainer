use crate::learning::normalize_phrase;
use serde::Serialize;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct DailyRecallItem {
    pub phrase_id: u64,
    pub cue: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct DailyRecallPlan {
    pub items: Vec<DailyRecallItem>,
    pub completed_count: usize,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct SpokenRecallResult {
    pub phrase_id: u64,
    pub transcript: String,
    pub target: String,
    pub wording_observed: bool,
}

/// Longest stretch of the learner's own words a "…" gap in a saved phrase may cover. Long enough
/// for "I've been working on the new refunds flow for", short enough that two unrelated mentions
/// of "rather" and "than" minutes apart do not count as using "I'd rather … than …".
const MAX_GAP_WORDS: usize = 8;

/// The saved phrase as whole-word pieces between its "…" gaps ("..." counts as one too).
fn phrase_parts(target: &str) -> Vec<Vec<String>> {
    target
        .replace("...", "\u{2026}")
        .split('\u{2026}')
        .map(normalize_phrase)
        .filter(|part| !part.is_empty())
        .map(|part| part.split_whitespace().map(str::to_owned).collect())
        .collect()
}

fn starts_with_at(spoken: &[&str], at: usize, part: &[String]) -> bool {
    at + part.len() <= spoken.len() && part.iter().zip(&spoken[at..]).all(|(a, b)| a == b)
}

/// Whether `parts[index..]` can be found in order from `from`, each later part starting at most
/// `MAX_GAP_WORDS` words after the previous one ended.
fn parts_follow(spoken: &[&str], parts: &[Vec<String>], index: usize, from: usize) -> bool {
    let Some(part) = parts.get(index) else {
        return true;
    };
    let last_start = if index == 0 {
        spoken.len()
    } else {
        (from + MAX_GAP_WORDS).min(spoken.len())
    };
    (from..=last_start).any(|at| {
        starts_with_at(spoken, at, part) && parts_follow(spoken, parts, index + 1, at + part.len())
    })
}

/// The saved wording appears in the transcript as whole words. A phrase with "…" gaps matches
/// when its pieces are said in order with a short stretch of the learner's own words between them.
pub(crate) fn wording_observed(target: &str, transcript: &str) -> bool {
    let parts = phrase_parts(target);
    let spoken = normalize_phrase(transcript);
    if parts.is_empty() || spoken.is_empty() {
        return false;
    }
    let spoken_words: Vec<_> = spoken.split_whitespace().collect();
    parts_follow(&spoken_words, &parts, 0, 0)
}

#[cfg(test)]
mod tests {
    use super::wording_observed;

    #[test]
    fn requires_complete_word_sequence_in_spoken_transcript() {
        assert!(wording_observed("trade-off", "The trade off matters here."));
        assert!(!wording_observed("trade-off", "I noticed a trade today."));
        assert!(!wording_observed("work", "The workshop helped."));
    }

    #[test]
    fn phrase_with_gaps_matches_its_pieces_in_order_with_short_fillers() {
        let target = "I'd rather … than …";
        assert!(wording_observed(
            target,
            "I'd rather do it properly than patch it twice."
        ));
        assert!(wording_observed(target, "Honestly I'd rather than not."));
        assert!(!wording_observed(target, "Than that, I'd rather wait."));
        assert!(!wording_observed(
            target,
            "I'd rather wait for the next sprint and the review of the whole design than rush."
        ));
        assert!(wording_observed(
            "I've been working on ... for two weeks",
            "I've been working on the refunds flow for two weeks now."
        ));
        assert!(!wording_observed(
            "I've been working on … for",
            "I've been working on it."
        ));
    }

    #[test]
    fn gaps_alone_never_match() {
        assert!(!wording_observed("…", "anything at all"));
        assert!(!wording_observed("I'd rather … than", ""));
    }
}
