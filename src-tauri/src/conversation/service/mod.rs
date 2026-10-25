use super::domain::rehearsal::{parse_practice_mode, parse_practice_phase};
use super::domain::ActiveSession;
use super::error::ConversationError;
use crate::persistence::SessionDatabase;
use std::path::Path;
use std::sync::atomic::AtomicBool;
use std::sync::{Arc, Mutex};

mod coaching;
pub(crate) mod coaching_queue;
mod dialogue;
mod feedback;
mod guided;
mod interruption;
mod lifecycle;
mod planner;
mod recall;
mod rescue;
mod turn;
mod wrapup;
mod wrapup_generation;
mod wrapup_queue;

pub use coaching_queue::{CoachingQueue, IDLE_FLUSH, QUOTA_PAUSE};
pub use wrapup_queue::WrapupQueue;

#[cfg(test)]
mod tests;

const SESSION_MODE: &str = "conversation";

#[derive(Clone)]
pub struct SessionStore {
    state: Arc<Mutex<State>>,
    answer_plan_cache: Arc<Mutex<Option<planner::CachedPlan>>>,
    rescue_in_flight: Arc<AtomicBool>,
    pub(crate) coaching: Arc<coaching::CoachingStatus>,
}

pub(crate) struct State {
    pub(crate) database: SessionDatabase,
    pub(crate) active: Option<ActiveSession>,
    pub(crate) mistake_practice_preparing: bool,
}

impl SessionStore {
    pub fn open(path: impl AsRef<Path>) -> rusqlite::Result<Self> {
        let database = SessionDatabase::open(path)?;
        Self::from_database(database)
    }

    fn from_database(database: SessionDatabase) -> rusqlite::Result<Self> {
        let active = if let Some(stored) = database.active_session()? {
            let mistake_questions = if stored.is_mistake_practice {
                let questions = database.mistake_practice_questions(stored.id)?;
                if questions.len() != 5 {
                    return Err(rusqlite::Error::InvalidQuery);
                }
                questions
            } else {
                Vec::new()
            };
            Some(ActiveSession {
                id: stored.id,
                opening_question: stored.opening_question,
                turns: database.turns(stored.id)?,
                in_flight: false,
                reply_cancelled: Arc::new(AtomicBool::new(false)),
                topic_id: stored.topic_id,
                topic_label: stored.topic_label,
                topic_custom: stored.topic_custom,
                duration_goal_seconds: stored.duration_goal_seconds,
                active_duration_ms: stored.active_duration_ms,
                started_at: stored.started_at,
                clock_anchor: None,
                practice_mode: parse_practice_mode(&stored.practice_mode),
                practice_phase: parse_practice_phase(&stored.practice_phase),
                written_turn_count: stored.written_turn_count,
                is_mistake_practice: stored.is_mistake_practice,
                mistake_questions,
            })
        } else {
            None
        };
        Ok(Self {
            state: Arc::new(Mutex::new(State {
                database,
                active,
                mistake_practice_preparing: false,
            })),
            answer_plan_cache: Arc::new(Mutex::new(None)),
            rescue_in_flight: Arc::new(AtomicBool::new(false)),
            coaching: Arc::new(coaching::CoachingStatus::default()),
        })
    }

    pub(crate) fn lock(&self) -> std::sync::MutexGuard<'_, State> {
        self.state
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
    }
}

#[cfg(test)]
impl Default for SessionStore {
    fn default() -> Self {
        Self::from_database(
            SessionDatabase::open_in_memory().expect("in-memory SQLite should open"),
        )
        .expect("new in-memory database should load")
    }
}

fn active_session_mut(
    state: &mut State,
    session_id: u64,
) -> Result<&mut ActiveSession, ConversationError> {
    state
        .active
        .as_mut()
        .filter(|session| session.id == session_id)
        .ok_or(ConversationError::InvalidSession)
}

#[cfg(test)]
pub(crate) fn code_of(
    error: impl Into<crate::providers::ProviderError>,
) -> crate::providers::ProviderErrorCode {
    error.into().code
}
