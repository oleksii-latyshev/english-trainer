use super::SessionStore;
use crate::conversation::domain::rules::{
    validate_transcript, DAILY_TARGET_TURNS, MAX_SAFE_SESSION_ID,
};
use crate::conversation::error::ConversationError;
use crate::learning::recall::{DailyRecallPlan, SpokenRecallResult};
use crate::learning::{daily_plan, record_daily_recall};

impl SessionStore {
    pub fn daily_recall_plan(&self, session_id: u64) -> Result<DailyRecallPlan, ConversationError> {
        let state = self.lock();
        let session = state
            .active
            .as_ref()
            .filter(|item| item.id == session_id)
            .ok_or(ConversationError::InvalidSession)?;
        if session.turns.len() < DAILY_TARGET_TURNS {
            return Err(ConversationError::RecallGoalNotReached);
        }
        Ok(daily_plan(state.database.connection(), session_id)?)
    }

    pub fn submit_daily_recall(
        &self,
        session_id: u64,
        phrase_id: u64,
        transcript: String,
    ) -> Result<SpokenRecallResult, ConversationError> {
        validate_transcript(&transcript)?;
        if phrase_id == 0 || phrase_id > MAX_SAFE_SESSION_ID {
            return Err(ConversationError::InvalidPhraseId);
        }
        let state = self.lock();
        let session = state
            .active
            .as_ref()
            .filter(|item| item.id == session_id)
            .ok_or(ConversationError::InvalidSession)?;
        if session.in_flight {
            return Err(ConversationError::Busy);
        }
        if session.turns.len() < DAILY_TARGET_TURNS {
            return Err(ConversationError::RecallGoalNotReached);
        }
        record_daily_recall(
            state.database.connection(),
            session_id,
            phrase_id,
            &transcript,
        )?
        .ok_or(ConversationError::PhraseNotDue)
    }
}
