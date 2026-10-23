use crate::conversation::error::ConversationError;

pub(crate) const OPENING_QUESTION: &str =
    "What is something interesting that happened to you recently?";
pub(crate) const MAX_TURNS: usize = 20;
pub(crate) const MAX_EARLIER_ANSWER_CHARS: usize = 160;
pub(crate) const MAX_ASKED_QUESTIONS: usize = 40;
pub(crate) const MAX_ASKED_QUESTION_CHARS: usize = 200;
pub(crate) const MAX_TRANSCRIPT_CHARS: usize = 4_000;
pub(crate) const MAX_CONTEXT_CHARS: usize = 24_000;
pub(crate) const MAX_SAFE_SESSION_ID: u64 = 9_007_199_254_740_991;
pub(crate) const DAILY_TARGET_TURNS: usize = 8;

pub(crate) fn validate_transcript(transcript: &str) -> Result<(), ConversationError> {
    let length = transcript.trim().chars().count();
    if length == 0 || length > MAX_TRANSCRIPT_CHARS {
        return Err(ConversationError::InvalidTranscript);
    }
    Ok(())
}
