use super::SessionStore;
use crate::conversation::error::ConversationError;
use crate::providers::{CoachedAnswer, CoachingAnswer, ProviderError, ProviderErrorCode};
use serde::Serialize;
use std::collections::BTreeMap;
use std::sync::{Arc, Condvar, Mutex, MutexGuard};
use std::thread;
use std::time::{Duration, Instant};

pub const BATCH_SIZE: usize = 5;
pub const IDLE_FLUSH: Duration = Duration::from_secs(60);

pub const QUOTA_PAUSE: Duration = Duration::from_secs(30 * 60);

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
pub struct CoachingEvent {
    pub session_id: u64,
}

pub trait BatchCoach: Send + Sync {
    fn coach(&self, answers: &[CoachingAnswer]) -> Result<Vec<CoachedAnswer>, ProviderError>;
}

impl<F> BatchCoach for F
where
    F: Fn(&[CoachingAnswer]) -> Result<Vec<CoachedAnswer>, ProviderError> + Send + Sync,
{
    fn coach(&self, answers: &[CoachingAnswer]) -> Result<Vec<CoachedAnswer>, ProviderError> {
        self(answers)
    }
}

type Notify = dyn Fn(CoachingEvent) + Send + Sync;

#[derive(Debug, Clone, Copy)]
struct SessionTiming {
    last_answer_at: Instant,
    is_flushing: bool,
}

struct Control {
    sessions: BTreeMap<u64, SessionTiming>,
    is_shut_down: bool,
}

struct Shared {
    store: SessionStore,
    coach: Box<dyn BatchCoach>,
    notify: Box<Notify>,
    idle: Duration,
    quota_pause: Duration,
    control: Mutex<Control>,
    wake: Condvar,
}

#[derive(Debug, PartialEq, Eq)]
enum Due {
    Now,
    At(Instant),
    Never,
}

fn due(
    waiting: usize,
    has_failed_before: bool,
    timing: SessionTiming,
    idle: Duration,
    now: Instant,
) -> Due {
    if waiting == 0 {
        return Due::Never;
    }
    if waiting >= BATCH_SIZE || timing.is_flushing || has_failed_before {
        return Due::Now;
    }
    let idle_at = timing.last_answer_at + idle;
    if now >= idle_at {
        Due::Now
    } else {
        Due::At(idle_at)
    }
}

pub struct CoachingQueue {
    shared: Arc<Shared>,
}

impl CoachingQueue {
    pub fn start(
        store: SessionStore,
        coach: impl BatchCoach + 'static,
        idle: Duration,
        quota_pause: Duration,
        notify: impl Fn(CoachingEvent) + Send + Sync + 'static,
    ) -> std::io::Result<Self> {
        let shared = Arc::new(Shared {
            store,
            coach: Box::new(coach),
            notify: Box::new(notify),
            idle,
            quota_pause,
            control: Mutex::new(Control {
                sessions: BTreeMap::new(),
                is_shut_down: false,
            }),
            wake: Condvar::new(),
        });
        if let Some(session_id) = shared.store.active_session_id() {
            shared.note_answer(session_id);
        }
        let worker = shared.clone();
        thread::Builder::new()
            .name("coaching-queue".into())
            .spawn(move || worker.run())?;
        Ok(Self { shared })
    }

    pub fn answer_saved(&self, session_id: u64) {
        self.shared.note_answer(session_id);
    }

    pub fn flush(&self, session_id: u64) {
        let mut control = self.shared.control();
        control
            .sessions
            .entry(session_id)
            .or_insert_with(SessionTiming::now)
            .is_flushing = true;
        drop(control);
        self.shared.wake.notify_all();
    }

    pub fn retry(&self, session_id: u64, sequence: usize) -> Result<(), ConversationError> {
        let needs_feedback = self
            .shared
            .store
            .retry_answer_coaching(session_id, sequence)?;
        if needs_feedback {
            self.flush(session_id);
        }
        Ok(())
    }
}

impl Drop for CoachingQueue {
    fn drop(&mut self) {
        self.shared.control().is_shut_down = true;
        self.shared.wake.notify_all();
    }
}

impl SessionTiming {
    fn now() -> Self {
        Self {
            last_answer_at: Instant::now(),
            is_flushing: false,
        }
    }
}

impl Shared {
    fn control(&self) -> MutexGuard<'_, Control> {
        self.control
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
    }

    fn note_answer(&self, session_id: u64) {
        let mut control = self.control();
        let timing = control
            .sessions
            .entry(session_id)
            .or_insert_with(SessionTiming::now);
        timing.last_answer_at = Instant::now();
        drop(control);
        self.wake.notify_all();
    }

    fn run(&self) {
        loop {
            let Some((session_id, answers)) = self.next_batch() else {
                return;
            };
            self.check(session_id, answers);
        }
    }

    fn next_batch(&self) -> Option<(u64, Vec<crate::persistence::UncoachedAnswer>)> {
        let mut control = self.control();
        loop {
            if control.is_shut_down {
                return None;
            }
            let now = Instant::now();
            let mut finished_sessions = Vec::new();
            let paused_until = self.store.coaching_status().paused_until();
            let is_paused = paused_until.is_some();
            let mut next_wake: Option<Instant> = paused_until;
            let sessions: Vec<_> = control.sessions.iter().map(|(id, t)| (*id, *t)).collect();
            for (session_id, timing) in sessions {
                let Ok(waiting) = self.store.coaching_queue(session_id) else {
                    continue;
                };
                if waiting.is_empty() {
                    if timing.is_flushing {
                        finished_sessions.push(session_id);
                    }
                    continue;
                }
                if is_paused {
                    continue;
                }
                let has_failed_before = waiting.iter().any(|answer| answer.failed_attempts > 0);
                match due(waiting.len(), has_failed_before, timing, self.idle, now) {
                    Due::Now => {
                        let batch = waiting.into_iter().take(BATCH_SIZE).collect();
                        return Some((session_id, batch));
                    }
                    Due::At(at) => next_wake = Some(next_wake.map_or(at, |soon| soon.min(at))),
                    Due::Never => {}
                }
            }
            for session_id in finished_sessions {
                control.sessions.remove(&session_id);
            }
            control = match next_wake {
                Some(at) => {
                    self.wake
                        .wait_timeout(control, at.saturating_duration_since(now))
                        .unwrap_or_else(|poisoned| poisoned.into_inner())
                        .0
                }
                None => self
                    .wake
                    .wait(control)
                    .unwrap_or_else(|poisoned| poisoned.into_inner()),
            };
        }
    }

    fn check(&self, session_id: u64, answers: Vec<crate::persistence::UncoachedAnswer>) {
        let request: Vec<CoachingAnswer> = answers
            .iter()
            .map(|answer| CoachingAnswer {
                sequence: answer.sequence,
                question: answer.question.clone(),
                transcript: answer.transcript.clone(),
            })
            .collect();
        match self.coach.coach(&request) {
            Ok(coached) => {
                let mut failed = Vec::new();
                for answer in &answers {
                    let saved = coached
                        .iter()
                        .find(|item| item.sequence == answer.sequence)
                        .is_some_and(|item| {
                            self.store
                                .save_feedback(
                                    session_id,
                                    answer.sequence,
                                    &answer.transcript,
                                    &item.feedback,
                                )
                                .is_ok()
                        });
                    if !saved {
                        failed.push(answer.sequence);
                    }
                }
                self.count_failures(session_id, &failed);
            }
            Err(error) if error.code == ProviderErrorCode::RateLimited => {
                self.store
                    .coaching_status()
                    .pause_until(Instant::now() + self.quota_pause);
            }
            Err(_) => {
                let sequences: Vec<usize> = answers.iter().map(|answer| answer.sequence).collect();
                self.count_failures(session_id, &sequences);
            }
        }
        (self.notify)(CoachingEvent { session_id });
    }

    fn count_failures(&self, session_id: u64, sequences: &[usize]) {
        if sequences.is_empty() {
            return;
        }
        let _ = self.store.record_coaching_failures(session_id, sequences);
    }
}

#[cfg(test)]
#[path = "coaching_queue_tests.rs"]
mod tests;
