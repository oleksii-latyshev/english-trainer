use super::SessionStore;
use crate::conversation::domain::PracticePhase;
use crate::conversation::error::ConversationError;
use crate::conversation::ports::RescueProvider;
use crate::providers::{RescueRequest, RescueResponse};

impl SessionStore {
    pub fn rescue_question(
        &self,
        session_id: u64,
        sequence: usize,
        question: Option<&str>,
    ) -> Result<String, ConversationError> {
        let state = self.lock();
        let active = state
            .active
            .as_ref()
            .filter(|active| active.id == session_id)
            .ok_or(ConversationError::InvalidSession)?;
        if active.in_flight
            || active.is_mistake_practice
            || active.practice_phase != PracticePhase::Speaking
            || sequence != active.turns.len() + 1
            || question.is_some_and(|value| value != active.current_question())
        {
            return Err(ConversationError::RescueQuestionChanged);
        }
        Ok(active.current_question().to_string())
    }

    pub fn rescue_answer(
        &self,
        session_id: u64,
        sequence: usize,
        request: &RescueRequest,
        provider: impl RescueProvider,
    ) -> Result<RescueResponse, ConversationError> {
        request.validate()?;
        self.rescue_in_flight
            .compare_exchange(
                false,
                true,
                std::sync::atomic::Ordering::Acquire,
                std::sync::atomic::Ordering::Relaxed,
            )
            .map_err(|_| ConversationError::RescueBusy)?;
        let _guard = RescueGuard(&self.rescue_in_flight);
        self.rescue_question(session_id, sequence, Some(&request.question))?;
        {
            let mut state = self.lock();
            let active = state
                .active
                .as_ref()
                .ok_or(ConversationError::InvalidSession)?;
            if active.id != session_id
                || active.in_flight
                || active.is_mistake_practice
                || active.practice_phase != PracticePhase::Speaking
                || active.turns.len() + 1 != sequence
                || active.current_question() != request.question
            {
                return Err(ConversationError::InvalidSession);
            }
            state
                .database
                .record_answer_help_used(session_id, sequence)?;
        }
        let response = provider.rescue(request)?;
        self.rescue_question(session_id, sequence, Some(&request.question))?;
        Ok(response)
    }
}

#[cfg(test)]
#[path = "rescue_tests.rs"]
mod tests;

struct RescueGuard<'a>(&'a std::sync::atomic::AtomicBool);
impl Drop for RescueGuard<'_> {
    fn drop(&mut self) {
        self.0.store(false, std::sync::atomic::Ordering::Release);
    }
}
