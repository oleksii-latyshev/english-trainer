use crate::persistence::SessionDatabase;
use crate::providers::{
    ContextTurn, ConversationContext, ConversationTurn, ProviderError, ProviderErrorCode,
};
use serde::Serialize;
use std::path::Path;
use std::sync::{Arc, Mutex};
mod rules;
mod scaffold;
#[cfg(test)]
use rules::MAX_TRANSCRIPT_CHARS;
use rules::{
    context_char_count, validate_transcript, DAILY_TARGET_TURNS, MAX_CONTEXT_CHARS,
    MAX_SAFE_SESSION_ID, MAX_TURNS, OPENING_QUESTION,
};
pub use scaffold::{question_scaffold, QuestionScaffold};

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct PracticeSession {
    pub session_id: u64,
    pub opening_question: String,
    pub turn_count: usize,
    pub target_turns: usize,
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
        })
    }

    pub fn get_active(&self) -> Option<PracticeSession> {
        let state = self.lock();
        state.active.as_ref().map(|active| PracticeSession {
            session_id: active.id,
            opening_question: active
                .turns
                .last()
                .map(|turn| turn.assistant_question.clone())
                .unwrap_or_else(|| active.opening_question.clone()),
            turn_count: active.turns.len(),
            target_turns: DAILY_TARGET_TURNS,
        })
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

#[cfg(test)]
#[path = "tests.rs"]
mod tests;
