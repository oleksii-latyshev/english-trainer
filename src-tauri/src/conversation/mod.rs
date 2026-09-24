use crate::providers::{
    ContextTurn, ConversationContext, ConversationTurn, ProviderError, ProviderErrorCode,
};
use serde::Serialize;
use std::sync::{Arc, Mutex};

const OPENING_QUESTION: &str = "What is something interesting that happened to you recently?";
const MAX_TURNS: usize = 8;
const MAX_TRANSCRIPT_CHARS: usize = 4_000;
const MAX_CONTEXT_CHARS: usize = 8_000;
const MAX_SAFE_SESSION_ID: u64 = 9_007_199_254_740_991;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct PracticeSession {
    pub session_id: u64,
    pub opening_question: String,
    pub turn_count: usize,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct FinishedPracticeSession {
    pub session_id: u64,
    pub finished: bool,
}

#[derive(Clone, Default)]
pub struct SessionStore {
    state: Arc<Mutex<State>>,
}

#[derive(Default)]
struct State {
    next_id: u64,
    active: Option<ActiveSession>,
}

struct ActiveSession {
    id: u64,
    opening_question: String,
    turns: Vec<ContextTurn>,
    in_flight: bool,
}

impl SessionStore {
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
            });
        }
        state.next_id = if state.next_id >= MAX_SAFE_SESSION_ID {
            1
        } else {
            state.next_id + 1
        };
        let session_id = state.next_id;
        let opening_question = OPENING_QUESTION.to_string();
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
                    .cloned()
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
        let Some(session) = state
            .active
            .as_mut()
            .filter(|session| session.id == session_id)
        else {
            return Err(invalid_session_error());
        };
        session.in_flight = false;
        let turn = result?;
        let assistant_question = turn.question.clone().unwrap_or_default();
        session.turns.push(ContextTurn {
            learner: context.latest_transcript,
            assistant_reply: turn.spoken_reply.clone(),
            assistant_question,
        });
        if session.turns.len() > MAX_TURNS {
            session.turns.remove(0);
        }
        Ok(turn)
    }

    pub fn finish(&self, session_id: u64) -> Result<FinishedPracticeSession, ProviderError> {
        let mut state = self.lock();
        let session = active_session_mut(&mut state, session_id)?;
        if session.in_flight {
            return Err(busy_error());
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

fn validate_transcript(transcript: &str) -> Result<(), ProviderError> {
    let length = transcript.trim().chars().count();
    if length == 0 || length > MAX_TRANSCRIPT_CHARS {
        return Err(ProviderError::new(
            ProviderErrorCode::InvalidRequest,
            "Transcript must contain between 1 and 4,000 characters.",
        ));
    }
    Ok(())
}

fn context_char_count(context: &ConversationContext) -> usize {
    context.opening_question.chars().count()
        + context.latest_transcript.chars().count()
        + context
            .recent_turns
            .iter()
            .map(|turn| {
                turn.learner.chars().count()
                    + turn.assistant_reply.chars().count()
                    + turn.assistant_question.chars().count()
            })
            .sum::<usize>()
}

#[cfg(test)]
#[path = "tests.rs"]
mod tests;
