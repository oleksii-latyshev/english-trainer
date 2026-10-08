//! Coaching state the session shows: per-answer progress, the manual retry and the wrap-up count.
//! The background queue that produces the coaching is in `coaching_queue`.

use super::{database_error, State};
use super::{SessionStore, MAX_SAFE_SESSION_ID};
use crate::persistence::CoachingProgress;
use crate::providers::{ProviderError, ProviderErrorCode, TurnFeedback};
use serde::Serialize;
use std::sync::Mutex;
use std::time::Instant;

/// State shared by every clone of the store and the coaching queue.
#[derive(Default)]
pub(crate) struct CoachingStatus {
    /// The Antigravity quota ran out: no batch runs until this moment, then one batch probes again.
    resume_at: Mutex<Option<Instant>>,
}

impl CoachingStatus {
    fn resume_at(&self) -> Option<Instant> {
        *self.resume_at.lock().unwrap_or_else(|p| p.into_inner())
    }

    pub(crate) fn is_paused(&self) -> bool {
        self.resume_at().is_some_and(|at| Instant::now() < at)
    }

    /// When a pause ends, if one is running; the queue wakes then.
    pub(crate) fn paused_until(&self) -> Option<Instant> {
        self.resume_at().filter(|at| Instant::now() < *at)
    }

    pub(crate) fn pause_until(&self, at: Instant) {
        *self.resume_at.lock().unwrap_or_else(|p| p.into_inner()) = Some(at);
    }

    pub(crate) fn resume(&self) {
        *self.resume_at.lock().unwrap_or_else(|p| p.into_inner()) = None;
    }
}

/// Where the coaching for one answer stands, as the Talk screen shows it under the answer.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(tag = "state", rename_all = "snake_case")]
pub enum TurnCoaching {
    /// Waiting in the queue or being checked: "Checking your answer…".
    Pending,
    /// The quota ran out; the answer stays unchecked until coaching is resumed.
    Paused,
    /// Checking failed twice: "couldn't check this answer", with a manual retry.
    Failed,
    Ready {
        feedback: TurnFeedback,
    },
}

impl SessionStore {
    /// Coaching of every answer of the session, in turn order.
    pub(super) fn turn_coaching(
        &self,
        state: &State,
        session_id: u64,
        turn_count: usize,
    ) -> Result<Vec<TurnCoaching>, ProviderError> {
        let progress = state
            .database
            .coaching_progress(session_id, turn_count)
            .map_err(database_error)?;
        let mut reviewed: std::collections::HashMap<usize, TurnFeedback> = state
            .database
            .reviewed_answers(session_id)
            .map_err(database_error)?
            .into_iter()
            .map(|answer| (answer.sequence, answer.feedback))
            .collect();
        let is_paused = self.coaching.is_paused();
        let mut coaching = Vec::with_capacity(turn_count);
        for (index, progress) in progress.into_iter().enumerate() {
            coaching.push(match (progress, reviewed.remove(&(index + 1))) {
                (_, Some(feedback)) => TurnCoaching::Ready { feedback },
                (CoachingProgress::GaveUp, None) => TurnCoaching::Failed,
                (_, None) if is_paused => TurnCoaching::Paused,
                _ => TurnCoaching::Pending,
            });
        }
        Ok(coaching)
    }

    /// Answers of the session still waiting for coaching, and whether coaching is paused.
    pub(super) fn waiting_coaching(
        &self,
        state: &State,
        session_id: u64,
        turn_count: usize,
    ) -> Result<usize, ProviderError> {
        Ok(state
            .database
            .coaching_progress(session_id, turn_count)
            .map_err(database_error)?
            .into_iter()
            .filter(|progress| *progress == CoachingProgress::Waiting)
            .count())
    }

    #[cfg(test)]
    pub fn is_coaching_paused(&self) -> bool {
        self.coaching.is_paused()
    }

    /// Lets coaching run again after a quota pause and gives one answer its tries back.
    /// False when that answer has feedback already.
    pub fn retry_answer_coaching(
        &self,
        session_id: u64,
        sequence: usize,
    ) -> Result<bool, ProviderError> {
        if session_id > MAX_SAFE_SESSION_ID || sequence == 0 {
            return Err(ProviderError::new(
                ProviderErrorCode::InvalidRequest,
                "This answer could not be found. Refresh the conversation and try again.",
            ));
        }
        let mut state = self.lock();
        let needs_feedback = state
            .database
            .reset_coaching_failures(session_id, sequence)
            .map_err(database_error)?;
        self.coaching.resume();
        Ok(needs_feedback)
    }

    /// Answers waiting for a coaching batch, oldest first.
    pub(crate) fn coaching_queue(
        &self,
        session_id: u64,
    ) -> Result<Vec<crate::persistence::UncoachedAnswer>, ProviderError> {
        self.lock()
            .database
            .coaching_queue(session_id)
            .map_err(database_error)
    }

    /// Counts a failed check against each of these answers.
    pub(crate) fn record_coaching_failures(
        &self,
        session_id: u64,
        sequences: &[usize],
    ) -> Result<(), ProviderError> {
        let mut state = self.lock();
        for sequence in sequences {
            state
                .database
                .record_coaching_failure(session_id, *sequence)
                .map_err(database_error)?;
        }
        Ok(())
    }

    /// The open session, if any.
    pub(crate) fn active_session_id(&self) -> Option<u64> {
        self.lock().active.as_ref().map(|active| active.id)
    }

    pub(crate) fn coaching_status(&self) -> std::sync::Arc<CoachingStatus> {
        self.coaching.clone()
    }
}
