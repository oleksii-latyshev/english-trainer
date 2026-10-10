use super::{database_error, invalid_session_error, PracticePhase, SessionStore};
use crate::providers::{ProviderError, ProviderErrorCode, RescueRequest, RescueResponse};

impl SessionStore {
    /// Only the unanswered spoken prompt can receive help; no session lock crosses a provider call.
    pub fn rescue_question(
        &self,
        session_id: u64,
        sequence: usize,
        question: Option<&str>,
    ) -> Result<String, ProviderError> {
        let state = self.lock();
        let active = state
            .active
            .as_ref()
            .filter(|active| active.id == session_id)
            .ok_or_else(invalid_session_error)?;
        if active.in_flight
            || active.is_mistake_practice
            || active.practice_phase != PracticePhase::Speaking
            || sequence != active.turns.len() + 1
            || question.is_some_and(|value| value != active.current_question())
        {
            return Err(ProviderError::new(
                ProviderErrorCode::InvalidRequest,
                "The spoken question changed. Open Stuck during your current answer.",
            ));
        }
        Ok(active.current_question().to_string())
    }

    pub fn rescue_answer<F>(
        &self,
        session_id: u64,
        sequence: usize,
        request: &RescueRequest,
        generate: F,
    ) -> Result<RescueResponse, ProviderError>
    where
        F: FnOnce(&RescueRequest) -> Result<RescueResponse, ProviderError>,
    {
        request.validate()?;
        self.rescue_in_flight.compare_exchange(false, true,
            std::sync::atomic::Ordering::Acquire, std::sync::atomic::Ordering::Relaxed)
            .map_err(|_| ProviderError::new(ProviderErrorCode::Busy,
                "Rescue help is still being prepared. Keep speaking or wait briefly before retrying."))?;
        let _guard = RescueGuard(&self.rescue_in_flight);
        self.rescue_question(session_id, sequence, Some(&request.question))?;
        {
            let mut state = self.lock();
            let active = state.active.as_ref().ok_or_else(invalid_session_error)?;
            if active.id != session_id
                || active.in_flight
                || active.is_mistake_practice
                || active.practice_phase != PracticePhase::Speaking
                || active.turns.len() + 1 != sequence
                || active.current_question() != request.question
            {
                return Err(invalid_session_error());
            }
            // Save before generation so concurrent submission cannot evade the per-answer cue.
            state
                .database
                .record_answer_help_used(session_id, sequence)
                .map_err(database_error)?;
        }
        let response = generate(request)?;
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
