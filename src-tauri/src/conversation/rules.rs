use crate::providers::{ConversationContext, ProviderError, ProviderErrorCode};

pub(super) const OPENING_QUESTION: &str =
    "What is something interesting that happened to you recently?";
pub(super) const MAX_TURNS: usize = 8;
pub(super) const MAX_TRANSCRIPT_CHARS: usize = 4_000;
pub(super) const MAX_CONTEXT_CHARS: usize = 8_000;
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

pub(super) fn context_char_count(context: &ConversationContext) -> usize {
    context.opening_question.chars().count()
        + context.latest_transcript.chars().count()
        + context
            .learning_targets
            .iter()
            .map(|item| {
                item.kind.chars().count() + item.cue.chars().count() + item.target.chars().count()
            })
            .sum::<usize>()
        + context
            .recent_turns
            .iter()
            .map(|turn| {
                turn.learner.chars().count()
                    + turn.assistant_reply.chars().count()
                    + turn.assistant_question.chars().count()
            })
            .sum::<usize>()
}
