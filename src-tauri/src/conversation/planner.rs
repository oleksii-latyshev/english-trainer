use super::{invalid_session_error, PracticePhase, SessionStore};
use crate::providers::{AnswerPlan, ProviderError, ProviderErrorCode};

#[derive(Clone, PartialEq, Eq)]
struct PlanKey {
    session_id: u64,
    sequence: usize,
    question: String,
    phase: PracticePhase,
}

pub(super) struct CachedPlan {
    key: PlanKey,
    result: Result<AnswerPlan, ProviderError>,
}

impl SessionStore {
    /// One cached question, including a failed preparation; opening help never calls the provider.
    /// The separate cache mutex coalesces concurrent prefetches without holding the session lock.
    pub fn answer_plan<F>(
        &self,
        session_id: u64,
        sequence: usize,
        question: &str,
        retry: bool,
        generate: F,
    ) -> Result<AnswerPlan, ProviderError>
    where
        F: FnOnce(&str) -> Result<AnswerPlan, ProviderError>,
    {
        let key = self.plan_key(session_id, sequence, question)?;
        let mut cache = self
            .answer_plan_cache
            .lock()
            .unwrap_or_else(|p| p.into_inner());
        // Waiting for another preparation must not generate obsolete help.
        self.plan_key(session_id, sequence, question)?;
        let result = match cache.as_ref().filter(|saved| saved.key == key) {
            Some(saved) if !retry || saved.result.is_ok() => saved.result.clone(),
            _ => {
                let result = generate(question);
                *cache = Some(CachedPlan {
                    key,
                    result: result.clone(),
                });
                result
            }
        };
        self.plan_key(session_id, sequence, question)?;
        result
    }

    fn plan_key(
        &self,
        session_id: u64,
        sequence: usize,
        question: &str,
    ) -> Result<PlanKey, ProviderError> {
        let state = self.lock();
        let active = state
            .active
            .as_ref()
            .filter(|active| active.id == session_id)
            .ok_or_else(invalid_session_error)?;
        if active.in_flight
            || active.is_mistake_practice
            || !matches!(active.practice_phase, PracticePhase::Speaking)
            || sequence != active.turns.len() + 1
            || question != active.current_question()
        {
            return Err(ProviderError::new(ProviderErrorCode::InvalidRequest,
                "The question changed before its plan was ready. Open help for the current spoken question."));
        }
        Ok(PlanKey {
            session_id,
            sequence,
            question: question.into(),
            phase: active.practice_phase,
        })
    }
}

#[cfg(test)]
#[path = "planner_tests.rs"]
mod tests;
