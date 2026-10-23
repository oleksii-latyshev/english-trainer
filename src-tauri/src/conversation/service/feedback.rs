use super::{active_session_mut, SessionStore};
use crate::conversation::domain::rules::{
    validate_transcript, MAX_SAFE_SESSION_ID, MAX_TRANSCRIPT_CHARS,
};
use crate::conversation::error::ConversationError;
use crate::providers::{compare_attempts, AttemptComparison, TurnFeedback};

const MAX_FEEDBACK_CHARS: usize = 600;

fn bounded_feedback_text(value: &str) -> bool {
    !value.trim().is_empty() && value.chars().count() <= MAX_FEEDBACK_CHARS
}

fn is_storable(feedback: &TurnFeedback) -> bool {
    feedback.focus_feedback.len() <= 1
        && bounded_feedback_text(&feedback.b2_rewrite)
        && feedback.focus_feedback.iter().all(|focus| {
            bounded_feedback_text(&focus.original)
                && bounded_feedback_text(&focus.improved)
                && bounded_feedback_text(&focus.explanation)
                && !crate::learning::normalize_phrase(&focus.improved).is_empty()
        })
}

impl SessionStore {
    pub fn save_feedback(
        &self,
        session_id: u64,
        sequence: usize,
        transcript: &str,
        feedback: &TurnFeedback,
    ) -> Result<(), ConversationError> {
        validate_transcript(transcript)?;
        if session_id > MAX_SAFE_SESSION_ID || sequence == 0 || !is_storable(feedback) {
            return Err(ConversationError::InvalidRetry);
        }
        let mut state = self.lock();
        let original = state
            .database
            .turn(session_id, sequence)?
            .ok_or(ConversationError::InvalidRetry)?;
        if original.learner.trim() != transcript.trim() {
            return Err(ConversationError::InvalidRetry);
        }
        Ok(state
            .database
            .save_turn_feedback(session_id, sequence, feedback)?)
    }

    pub fn retry_turn(
        &self,
        session_id: u64,
        sequence: usize,
        transcript: String,
    ) -> Result<AttemptComparison, ConversationError> {
        validate_transcript(&transcript)?;
        if session_id > MAX_SAFE_SESSION_ID || sequence == 0 {
            return Err(ConversationError::InvalidRetry);
        }
        let mut state = self.lock();
        if active_session_mut(&mut state, session_id)?.in_flight {
            return Err(ConversationError::Busy);
        }
        let original = state
            .database
            .turn(session_id, sequence)?
            .ok_or(ConversationError::InvalidRetry)?;
        let feedback = state
            .database
            .turn_feedback(session_id, sequence)?
            .ok_or(ConversationError::InvalidRetry)?;
        let target = feedback
            .focus_feedback
            .first()
            .map(|focus| focus.improved.as_str())
            .unwrap_or("");
        if target.len() > 300 || transcript.len() > MAX_TRANSCRIPT_CHARS {
            return Err(ConversationError::InvalidRetry);
        }
        let comparison = compare_attempts(sequence, &original.learner, &transcript, target);
        state.database.save_comparison(session_id, &comparison)?;
        Ok(comparison)
    }
}
