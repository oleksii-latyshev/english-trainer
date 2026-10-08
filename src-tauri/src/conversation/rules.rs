use crate::providers::{ProviderError, ProviderErrorCode};

pub(super) const OPENING_QUESTION: &str =
    "What is something interesting that happened to you recently?";
/// Turns sent in full to the primary provider; older learner answers are condensed instead.
pub(super) const MAX_TURNS: usize = 20;
/// Longest condensed older answer.
pub(super) const MAX_EARLIER_ANSWER_CHARS: usize = 160;
/// Most recent questions Eva must not repeat, and the longest one kept.
pub(super) const MAX_ASKED_QUESTIONS: usize = 40;
pub(super) const MAX_ASKED_QUESTION_CHARS: usize = 200;
pub(super) const MAX_TRANSCRIPT_CHARS: usize = 4_000;
pub(super) const MAX_CONTEXT_CHARS: usize = 24_000;
pub(super) const MAX_SAFE_SESSION_ID: u64 = 9_007_199_254_740_991;
pub(super) const DAILY_TARGET_TURNS: usize = 8;

pub(super) fn validate_transcript(transcript: &str) -> Result<(), ProviderError> {
    let length = transcript.trim().chars().count();
    if length == 0 || length > MAX_TRANSCRIPT_CHARS {
        return Err(ProviderError::new(
            ProviderErrorCode::InvalidRequest,
            "Transcript must contain between 1 and 4,000 characters.",
        ));
    }
    Ok(())
}
