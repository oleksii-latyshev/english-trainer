use super::SessionStore;
use crate::conversation::domain::PracticePhase;
use crate::conversation::error::ConversationError;
use crate::conversation::ports::AnswerPlanner;
use crate::providers::{AnswerPlan, ProviderError};

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
    pub fn answer_plan(
        &self,
        session_id: u64,
        sequence: usize,
        question: &str,
        retry: bool,
        planner: impl AnswerPlanner,
    ) -> Result<AnswerPlan, ConversationError> {
        let key = self.plan_key(session_id, sequence, question)?;
        let mut cache = self
            .answer_plan_cache
            .lock()
            .unwrap_or_else(|p| p.into_inner());
        self.plan_key(session_id, sequence, question)?;
        let result = match cache.as_ref().filter(|saved| saved.key == key) {
            Some(saved) if !retry || saved.result.is_ok() => saved.result.clone(),
            _ => {
                let result = planner.plan(question);
                *cache = Some(CachedPlan {
                    key,
                    result: result.clone(),
                });
                result
            }
        };
        self.plan_key(session_id, sequence, question)?;
        result.map_err(ConversationError::from)
    }

    fn plan_key(
        &self,
        session_id: u64,
        sequence: usize,
        question: &str,
    ) -> Result<PlanKey, ConversationError> {
        let state = self.lock();
        let active = state
            .active
            .as_ref()
            .filter(|active| active.id == session_id)
            .ok_or(ConversationError::InvalidSession)?;
        if active.in_flight
            || active.is_mistake_practice
            || !matches!(active.practice_phase, PracticePhase::Speaking)
            || sequence != active.turns.len() + 1
            || question != active.current_question()
        {
            return Err(ConversationError::PlanQuestionChanged);
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
