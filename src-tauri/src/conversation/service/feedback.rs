use super::SessionStore;
use crate::conversation::domain::rules::{
    validate_transcript, MAX_SAFE_SESSION_ID, MAX_TRANSCRIPT_CHARS,
};
use crate::conversation::error::ConversationError;
use crate::providers::{compare_attempts, max_rewrite_chars, AttemptComparison, TurnFeedback};

const MAX_FEEDBACK_CHARS: usize = 600;

fn bounded_text(value: &str, max_chars: usize) -> bool {
    !value.trim().is_empty() && value.chars().count() <= max_chars
}

fn is_storable(feedback: &TurnFeedback, transcript: &str) -> bool {
    feedback.focus_feedback.len() <= 1
        && bounded_text(&feedback.b2_rewrite, max_rewrite_chars(transcript))
        && feedback.focus_feedback.iter().all(|focus| {
            bounded_text(&focus.original, MAX_FEEDBACK_CHARS)
                && bounded_text(&focus.improved, MAX_FEEDBACK_CHARS)
                && bounded_text(&focus.explanation, MAX_FEEDBACK_CHARS)
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
        if session_id > MAX_SAFE_SESSION_ID || sequence == 0 || !is_storable(feedback, transcript) {
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
        match state
            .active
            .as_ref()
            .filter(|active| active.id == session_id)
        {
            Some(active) if active.in_flight => return Err(ConversationError::Busy),
            Some(_) => {}
            None if state.database.session_metadata(session_id)?.is_none() => {
                return Err(ConversationError::InvalidSession);
            }
            None => {}
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
