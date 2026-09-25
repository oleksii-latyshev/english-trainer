use crate::persistence::SessionDatabase;
use crate::providers::{
    compare_attempts, AttemptComparison, ContextTurn, ConversationContext, ConversationTurn,
    ProviderError, ProviderErrorCode, TurnFeedback,
};
use serde::Serialize;
use std::path::Path;
use std::sync::{Arc, Mutex};
mod rules;
mod scaffold;
use rules::{
    context_char_count, validate_transcript, DAILY_TARGET_TURNS, MAX_CONTEXT_CHARS,
    MAX_SAFE_SESSION_ID, MAX_TRANSCRIPT_CHARS, MAX_TURNS, OPENING_QUESTION,
};
pub use scaffold::{question_scaffold, QuestionScaffold};

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct PracticeSession {
    pub session_id: u64,
    pub opening_question: String,
    pub turn_count: usize,
    pub target_turns: usize,
    pub retry_evidence: Vec<AttemptComparison>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct FinishedPracticeSession {
    pub session_id: u64,
    pub finished: bool,
}

#[derive(Clone)]
pub struct SessionStore {
    state: Arc<Mutex<State>>,
}

struct State {
    database: SessionDatabase,
    active: Option<ActiveSession>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct StoredTurn {
    pub learner: String,
    pub assistant_reply: String,
    pub assistant_question: String,
}

struct ActiveSession {
    id: u64,
    opening_question: String,
    turns: Vec<StoredTurn>,
    in_flight: bool,
}

impl SessionStore {
    pub fn open(path: impl AsRef<Path>) -> rusqlite::Result<Self> {
        let database = SessionDatabase::open(path)?;
        Self::from_database(database)
    }

    fn from_database(database: SessionDatabase) -> rusqlite::Result<Self> {
        let active = if let Some(stored) = database.active_session()? {
            Some(ActiveSession {
                id: stored.id,
                opening_question: stored.opening_question,
                turns: database.turns(stored.id)?,
                in_flight: false,
            })
        } else {
            None
        };
        Ok(Self {
            state: Arc::new(Mutex::new(State { database, active })),
        })
    }

    pub fn start(&self) -> Result<PracticeSession, ProviderError> {
        let mut state = self.lock();
        if let Some(active) = &state.active {
            return Ok(PracticeSession {
                session_id: active.id,
                opening_question: active
                    .turns
                    .last()
                    .map(|turn| turn.assistant_question.clone())
                    .unwrap_or_else(|| active.opening_question.clone()),
                turn_count: active.turns.len(),
                target_turns: DAILY_TARGET_TURNS,
                retry_evidence: state
                    .database
                    .comparisons(active.id)
                    .map_err(database_error)?,
            });
        }
        let opening_question = OPENING_QUESTION.to_string();
        let session_id = state
            .database
            .create_session(&opening_question)
            .map_err(database_error)?;
        if session_id > MAX_SAFE_SESSION_ID {
            let _ = state.database.finish_session(session_id);
            return Err(database_error_message());
        }
        state.active = Some(ActiveSession {
            id: session_id,
            opening_question: opening_question.clone(),
            turns: Vec::new(),
            in_flight: false,
        });
        Ok(PracticeSession {
            session_id,
            opening_question,
            turn_count: 0,
            target_turns: DAILY_TARGET_TURNS,
            retry_evidence: Vec::new(),
        })
    }

    pub fn get_active(&self) -> Result<Option<PracticeSession>, ProviderError> {
        let state = self.lock();
        state
            .active
            .as_ref()
            .map(|active| {
                Ok(PracticeSession {
                    session_id: active.id,
                    opening_question: active
                        .turns
                        .last()
                        .map(|turn| turn.assistant_question.clone())
                        .unwrap_or_else(|| active.opening_question.clone()),
                    turn_count: active.turns.len(),
                    target_turns: DAILY_TARGET_TURNS,
                    retry_evidence: state
                        .database
                        .comparisons(active.id)
                        .map_err(database_error)?,
                })
            })
            .transpose()
    }

    pub fn send_turn<F>(
        &self,
        session_id: u64,
        transcript: String,
        generate: F,
    ) -> Result<ConversationTurn, ProviderError>
    where
        F: FnOnce(&ConversationContext) -> Result<ConversationTurn, ProviderError>,
    {
        validate_transcript(&transcript)?;
        let context = {
            let mut state = self.lock();
            let session = active_session_mut(&mut state, session_id)?;
            if session.in_flight {
                return Err(busy_error());
            }
            session.in_flight = true;
            let mut context = ConversationContext {
                opening_question: session.opening_question.clone(),
                recent_turns: session
                    .turns
                    .iter()
                    .rev()
                    .take(MAX_TURNS)
                    .map(|turn| ContextTurn {
                        learner: turn.learner.clone(),
                        assistant_reply: turn.assistant_reply.clone(),
                        assistant_question: turn.assistant_question.clone(),
                    })
                    .collect::<Vec<_>>()
                    .into_iter()
                    .rev()
                    .collect(),
                latest_transcript: transcript.trim().to_string(),
            };
            while context_char_count(&context) > MAX_CONTEXT_CHARS
                && !context.recent_turns.is_empty()
            {
                context.recent_turns.remove(0);
            }
            context
        };

        let result = generate(&context);
        let mut state = self.lock();
        let turn = match result {
            Ok(turn) => turn,
            Err(error) => {
                if let Some(session) = state
                    .active
                    .as_mut()
                    .filter(|session| session.id == session_id)
                {
                    session.in_flight = false;
                }
                return Err(error);
            }
        };
        let sequence = {
            let Some(session) = state
                .active
                .as_mut()
                .filter(|session| session.id == session_id)
            else {
                return Err(invalid_session_error());
            };
            session.in_flight = false;
            session.turns.len() + 1
        };
        let assistant_question = turn.question.clone().unwrap_or_default();
        let stored = StoredTurn {
            learner: context.latest_transcript,
            assistant_reply: turn.spoken_reply.clone(),
            assistant_question,
        };
        state
            .database
            .save_turn(session_id, sequence, &stored)
            .map_err(database_error)?;
        state
            .active
            .as_mut()
            .expect("session remains active while locked")
            .turns
            .push(stored);
        Ok(turn)
    }

    pub fn finish(&self, session_id: u64) -> Result<FinishedPracticeSession, ProviderError> {
        let mut state = self.lock();
        let session = active_session_mut(&mut state, session_id)?;
        if session.in_flight {
            return Err(busy_error());
        }
        if !state
            .database
            .finish_session(session_id)
            .map_err(database_error)?
        {
            return Err(invalid_session_error());
        }
        state.active = None;
        Ok(FinishedPracticeSession {
            session_id,
            finished: true,
        })
    }

    pub fn save_feedback(
        &self,
        session_id: u64,
        sequence: usize,
        transcript: &str,
        feedback: &TurnFeedback,
    ) -> Result<(), ProviderError> {
        validate_transcript(&transcript.to_string())?;
        if session_id > MAX_SAFE_SESSION_ID || sequence == 0 {
            return Err(invalid_retry_error());
        }
        if feedback.focus_feedback.len() > 1
            || !bounded_feedback_text(&feedback.b2_rewrite)
            || feedback.focus_feedback.iter().any(|focus| {
                !bounded_feedback_text(&focus.original)
                    || !bounded_feedback_text(&focus.improved)
                    || !bounded_feedback_text(&focus.explanation)
                    || crate::learning::normalize_phrase(&focus.improved).is_empty()
            })
        {
            return Err(invalid_retry_error());
        }
        let mut state = self.lock();
        active_session_mut(&mut state, session_id)?;
        let original = state
            .database
            .turn(session_id, sequence)
            .map_err(database_error)?
            .ok_or_else(invalid_retry_error)?;
        if original.learner.trim() != transcript.trim() {
            return Err(invalid_retry_error());
        }
        state
            .database
            .save_turn_feedback(session_id, sequence, feedback)
            .map_err(database_error)
    }

    pub fn retry_turn(
        &self,
        session_id: u64,
        sequence: usize,
        transcript: String,
    ) -> Result<AttemptComparison, ProviderError> {
        validate_transcript(&transcript)?;
        if session_id > MAX_SAFE_SESSION_ID || sequence == 0 {
            return Err(invalid_retry_error());
        }
        let mut state = self.lock();
        active_session_mut(&mut state, session_id)?;
        let original = state
            .database
            .turn(session_id, sequence)
            .map_err(database_error)?
            .ok_or_else(invalid_retry_error)?;
        let feedback = state
            .database
            .turn_feedback(session_id, sequence)
            .map_err(database_error)?
            .ok_or_else(invalid_retry_error)?;
        let target = feedback
            .focus_feedback
            .first()
            .map(|focus| focus.improved.as_str())
            .unwrap_or("");
        if target.len() > 300 || transcript.len() > MAX_TRANSCRIPT_CHARS {
            return Err(invalid_retry_error());
        }
        let comparison = compare_attempts(sequence, &original.learner, &transcript, target);
        state
            .database
            .save_comparison(session_id, &comparison)
            .map_err(database_error)?;
        Ok(comparison)
    }

    pub fn save_phrase(
        &self,
        phrase: String,
        meaning_or_note: String,
        session_id: Option<u64>,
        sequence: Option<usize>,
    ) -> Result<crate::learning::PhraseCardRecord, ProviderError> {
        let trimmed_phrase = phrase.trim();
        if trimmed_phrase.is_empty() || trimmed_phrase.chars().count() > 300 {
            return Err(ProviderError::new(
                ProviderErrorCode::InvalidRequest,
                "Phrase must be between 1 and 300 characters.",
            ));
        }
        if meaning_or_note.chars().count() > 500 {
            return Err(ProviderError::new(
                ProviderErrorCode::InvalidRequest,
                "Note must be 500 characters or fewer.",
            ));
        }
        if let Some(sid) = session_id {
            if sid > MAX_SAFE_SESSION_ID {
                return Err(ProviderError::new(
                    ProviderErrorCode::InvalidRequest,
                    "Invalid session ID.",
                ));
            }
        }
        if let Some(seq) = sequence {
            if seq == 0 || seq > 10_000 {
                return Err(ProviderError::new(
                    ProviderErrorCode::InvalidRequest,
                    "Invalid turn sequence.",
                ));
            }
        }
        if session_id.is_some() != sequence.is_some() {
            return Err(ProviderError::new(
                ProviderErrorCode::InvalidRequest,
                "Phrase provenance requires both a session ID and a turn sequence.",
            ));
        }

        let mut state = self.lock();
        if let (Some(sid), Some(seq)) = (session_id, sequence) {
            if state
                .database
                .turn(sid, seq)
                .map_err(database_error)?
                .is_none()
            {
                return Err(ProviderError::new(
                    ProviderErrorCode::InvalidRequest,
                    "The phrase source turn could not be found.",
                ));
            }
        }
        state
            .database
            .save_phrase_card(trimmed_phrase, &meaning_or_note, session_id, sequence)
            .map_err(database_error)
    }

    pub fn get_learning_memory(
        &self,
    ) -> Result<crate::learning::LearningMemoryView, ProviderError> {
        let state = self.lock();
        state.database.get_learning_memory().map_err(database_error)
    }

    pub fn submit_review(
        &self,
        item_type: crate::learning::LearningItemType,
        item_id: u64,
        response: crate::learning::ReviewResponse,
    ) -> Result<crate::learning::ReviewResult, ProviderError> {
        if item_id == 0 || item_id > MAX_SAFE_SESSION_ID {
            return Err(ProviderError::new(
                ProviderErrorCode::InvalidRequest,
                "Invalid learning item ID.",
            ));
        }
        let mut state = self.lock();
        state
            .database
            .record_review(item_type, item_id, response)
            .map_err(database_error)
    }

    fn lock(&self) -> std::sync::MutexGuard<'_, State> {
        self.state
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
    }
}

impl Default for SessionStore {
    fn default() -> Self {
        Self::from_database(
            SessionDatabase::open_in_memory().expect("in-memory SQLite should open"),
        )
        .expect("new in-memory database should load")
    }
}

fn database_error(_: rusqlite::Error) -> ProviderError {
    database_error_message()
}

fn database_error_message() -> ProviderError {
    ProviderError::new(
        ProviderErrorCode::DatabaseError,
        "Could not save this practice session locally. Please retry.",
    )
}

fn active_session_mut(
    state: &mut State,
    session_id: u64,
) -> Result<&mut ActiveSession, ProviderError> {
    state
        .active
        .as_mut()
        .filter(|session| session.id == session_id)
        .ok_or_else(invalid_session_error)
}

fn invalid_session_error() -> ProviderError {
    ProviderError::new(
        ProviderErrorCode::InvalidSession,
        "This practice session is no longer active. Start a new session and retry.",
    )
}

fn busy_error() -> ProviderError {
    ProviderError::new(
        ProviderErrorCode::Busy,
        "A response is already being generated. Please wait and retry.",
    )
}

fn invalid_retry_error() -> ProviderError {
    ProviderError::new(
        ProviderErrorCode::InvalidRequest,
        "This retry does not match a reviewed answer. Keep the original answer and try again.",
    )
}

fn bounded_feedback_text(value: &str) -> bool {
    !value.trim().is_empty() && value.chars().count() <= 300
}

#[cfg(test)]
#[path = "tests.rs"]
mod tests;
