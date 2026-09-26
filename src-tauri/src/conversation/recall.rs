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

pub(crate) fn wording_observed(target: &str, transcript: &str) -> bool {
    let target = normalize_phrase(target);
    let spoken = normalize_phrase(transcript);
    if target.is_empty() || spoken.is_empty() {
        return false;
    }
    let target_words: Vec<_> = target.split_whitespace().collect();
    let spoken_words: Vec<_> = spoken.split_whitespace().collect();
    spoken_words
        .windows(target_words.len())
        .any(|window| window == target_words)
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
}
