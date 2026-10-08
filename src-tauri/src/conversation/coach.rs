use crate::providers::{ProviderError, ProviderErrorCode, TurnFeedback};
use serde::{Deserialize, Serialize};

pub const COACH_TARGET_TURNS: usize = 4;

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SessionMode {
    #[default]
    Conversation,
    Coach,
}

impl SessionMode {
    pub fn parse(s: &str) -> Self {
        match s {
            "coach" => SessionMode::Coach,
            _ => SessionMode::Conversation,
        }
    }

    pub fn as_str(&self) -> &'static str {
        match self {
            SessionMode::Conversation => "conversation",
            SessionMode::Coach => "coach",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SavedCoachState {
    pub session_id: u64,
    pub sequence: usize,
    pub answered_question: String,
    pub original_transcript: String,
    pub feedback: Option<TurnFeedback>,
    pub is_pending: bool,
}

pub fn session_conflict_error(existing_mode: SessionMode) -> ProviderError {
    let mode_name = existing_mode.as_str();
    ProviderError::new(
        ProviderErrorCode::InvalidRequest,
        format!(
            "An active {mode_name} session is already in progress. Finish the existing session first."
        ),
    )
}

pub fn wrong_mode_error(expected_mode: SessionMode) -> ProviderError {
    let mode_name = expected_mode.as_str();
    ProviderError::new(
        ProviderErrorCode::InvalidRequest,
        format!("This operation requires an active {mode_name} session."),
    )
}

pub fn duplicate_coach_answer_error() -> ProviderError {
    ProviderError::new(
        ProviderErrorCode::InvalidRequest,
        "A first answer is already saved and awaiting review. Continue to the next question first.",
    )
}

pub fn no_pending_answer_error() -> ProviderError {
    ProviderError::new(
        ProviderErrorCode::InvalidRequest,
        "There is no pending coach answer to continue. Submit an answer first.",
    )
}

pub fn stale_sequence_error() -> ProviderError {
    ProviderError::new(
        ProviderErrorCode::InvalidRequest,
        "The turn sequence does not match the active pending answer.",
    )
}

impl super::SessionStore {
    #[cfg(test)]
    pub fn save_coach_answer(
        &self,
        session_id: u64,
        transcript: String,
    ) -> Result<SavedCoachState, ProviderError> {
        self.save_coach_answer_with_source(session_id, transcript, super::InputSource::Voice, None)
    }

    pub fn save_coach_answer_with_source(
        &self,
        session_id: u64,
        transcript: String,
        input_source: super::InputSource,
        answer_duration_ms: Option<u64>,
    ) -> Result<SavedCoachState, ProviderError> {
        super::rules::validate_transcript(&transcript)?;
        let mut state = self.lock();
        let session = super::active_session_mut(&mut state, session_id)?;
        if session.mode != SessionMode::Coach {
            return Err(wrong_mode_error(SessionMode::Coach));
        }
        if session.in_flight {
            return Err(super::busy_error());
        }
        if session.has_pending_coach_answer() {
            return Err(duplicate_coach_answer_error());
        }
        let sequence = session.turns.len() + 1;
        let answered_question = if sequence == 1 {
            session.opening_question.clone()
        } else {
            session.turns[sequence - 2].assistant_question.clone()
        };
        let normalized_transcript = transcript.trim().to_string();
        let stored = super::StoredTurn {
            learner: normalized_transcript.clone(),
            assistant_reply: String::new(),
            assistant_question: String::new(),
            answered_by: None,
        };
        state
            .database
            .save_turn_with_details(
                session_id,
                sequence,
                &stored,
                input_source.as_str(),
                None,
                answer_duration_ms.filter(|_| input_source != super::InputSource::Text),
            )
            .map_err(super::database_error)?;
        state
            .active
            .as_mut()
            .expect("active session remains locked")
            .turns
            .push(stored);
        Ok(SavedCoachState {
            session_id,
            sequence,
            answered_question,
            original_transcript: normalized_transcript,
            feedback: None,
            is_pending: true,
        })
    }

    pub fn continue_turn<F>(
        &self,
        session_id: u64,
        sequence: usize,
        generate: F,
    ) -> Result<crate::providers::ConversationTurn, ProviderError>
    where
        F: FnOnce(
            &crate::providers::ConversationContext,
        ) -> Result<crate::providers::ConversationTurn, ProviderError>,
    {
        let context = {
            let mut state = self.lock();
            let session = state
                .active
                .as_ref()
                .filter(|item| item.id == session_id)
                .ok_or_else(super::invalid_session_error)?;
            if session.mode != SessionMode::Coach {
                return Err(wrong_mode_error(SessionMode::Coach));
            }
            if session.in_flight {
                return Err(super::busy_error());
            }
            if !session.has_pending_coach_answer() {
                return Err(no_pending_answer_error());
            }
            if session.turns.len() != sequence {
                return Err(stale_sequence_error());
            }
            let latest_transcript = session
                .turns
                .last()
                .expect("pending turn exists")
                .learner
                .clone();
            let learning_targets = if sequence == 1 {
                state
                    .database
                    .due_learning_targets(session_id)
                    .map_err(super::database_error)?
            } else {
                Vec::new()
            };
            let session = super::active_session_mut(&mut state, session_id)?;
            session.in_flight = true;
            super::context_builder::build_context(
                &session.opening_question,
                &session.turns[..session.turns.len() - 1],
                &latest_transcript,
                learning_targets,
            )
        };
        let result = generate(&context);
        let mut state = self.lock();
        let turn = match result {
            Ok(turn) => turn,
            Err(error) => {
                if let Some(active) = state.active.as_mut().filter(|item| item.id == session_id) {
                    active.in_flight = false;
                }
                return Err(error);
            }
        };
        let question = turn.question.clone().unwrap_or_default();
        match state.database.update_turn(
            session_id,
            sequence,
            &turn.spoken_reply,
            &question,
            turn.answered_by.as_ref(),
            turn.reply_time_ms(),
        ) {
            Ok(true) => {}
            Ok(false) => {
                if let Some(active) = state.active.as_mut().filter(|item| item.id == session_id) {
                    active.in_flight = false;
                }
                return Err(super::database_error_message());
            }
            Err(error) => {
                if let Some(active) = state.active.as_mut().filter(|item| item.id == session_id) {
                    active.in_flight = false;
                }
                return Err(super::database_error(error));
            }
        }
        if let Some(active) = state.active.as_mut().filter(|item| item.id == session_id) {
            active.in_flight = false;
            if let Some(last) = active.turns.last_mut() {
                last.assistant_reply = turn.spoken_reply.clone();
                last.assistant_question = question;
                last.answered_by = turn.answered_by.clone();
            }
        }
        Ok(turn)
    }

    pub(super) fn build_practice_session(
        &self,
        state: &super::State,
        active: &super::ActiveSession,
    ) -> Result<super::PracticeSession, ProviderError> {
        use super::rules::DAILY_TARGET_TURNS;

        let target_turns = match active.mode {
            SessionMode::Conversation => DAILY_TARGET_TURNS,
            SessionMode::Coach => COACH_TARGET_TURNS,
        };
        let retry_evidence = state
            .database
            .comparisons(active.id)
            .map_err(super::database_error)?;
        let sequence = active.turns.len();
        let is_pending = active.has_pending_coach_answer();
        let opening_question = if is_pending {
            if sequence == 1 {
                active.opening_question.clone()
            } else {
                active.turns[sequence - 2].prompt().to_string()
            }
        } else {
            active
                .turns
                .last()
                .map(|turn| turn.prompt().to_string())
                .unwrap_or_else(|| active.opening_question.clone())
        };
        let coach_state = if sequence == 0 {
            None
        } else {
            let turn = &active.turns[sequence - 1];
            let answered_question = if sequence == 1 {
                active.opening_question.clone()
            } else {
                active.turns[sequence - 2].prompt().to_string()
            };
            Some(SavedCoachState {
                session_id: active.id,
                sequence,
                answered_question,
                original_transcript: turn.learner.clone(),
                feedback: state
                    .database
                    .turn_feedback(active.id, sequence)
                    .map_err(super::database_error)?,
                is_pending,
            })
        };

        Ok(super::PracticeSession {
            session_id: active.id,
            mode: active.mode,
            opening_question,
            turn_count: sequence,
            target_turns,
            retry_evidence,
            coach_state,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::super::{InputSource, SessionMode, SessionStore};

    #[test]
    fn coach_keeps_answer_duration_for_spoken_answers_only() {
        for (source, expected) in [
            (InputSource::Voice, Some(9_000)),
            (InputSource::Edited, Some(9_000)),
            (InputSource::Text, None),
        ] {
            let store = SessionStore::default();
            let session = store.start_session(Some(SessionMode::Coach)).unwrap();
            store
                .save_coach_answer_with_source(
                    session.session_id,
                    "My answer".into(),
                    source,
                    Some(9_000),
                )
                .unwrap();
            let dialogue = store.dialogue(session.session_id).unwrap();
            assert_eq!(dialogue.answer_durations_ms, vec![expected]);
        }
    }
}
