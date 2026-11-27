//! Background usage review of finished sessions: one job per session, never on the turn path.

use super::error::LearningError;
use super::usage_service::UsageReviewService;
use crate::providers::{ProviderErrorCode, UsageBatchAnswer, UsageBatchResult};
use std::sync::mpsc::{self, RecvTimeoutError, Sender};
use std::thread;
use std::time::{Duration, Instant};

/// A session review has this many tries; one retry after the first failure.
pub const MAX_ATTEMPTS: u32 = 2;
pub const RETRY_DELAY: Duration = Duration::from_secs(60);
pub const QUOTA_PAUSE: Duration = Duration::from_secs(30 * 60);

type ProviderResult = Result<Vec<UsageBatchResult>, crate::providers::ProviderError>;

pub trait BatchReviewer: Send + Sync {
    fn review(&self, answers: &[UsageBatchAnswer]) -> ProviderResult;
}

impl<F> BatchReviewer for F
where
    F: Fn(&[UsageBatchAnswer]) -> ProviderResult + Send + Sync,
{
    fn review(&self, answers: &[UsageBatchAnswer]) -> ProviderResult {
        self(answers)
    }
}

/// What a run leaves to do.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Next {
    Done,
    RetryAfter(Duration),
    PausedFor(Duration),
    GiveUp,
}

pub struct UsageReviewWorker {
    service: UsageReviewService,
    reviewer: Box<dyn BatchReviewer>,
    retry_delay: Duration,
    quota_pause: Duration,
}

impl UsageReviewWorker {
    pub fn new(
        service: UsageReviewService,
        reviewer: impl BatchReviewer + 'static,
        retry_delay: Duration,
        quota_pause: Duration,
    ) -> Self {
        Self {
            service,
            reviewer: Box::new(reviewer),
            retry_delay,
            quota_pause,
        }
    }

    /// One try at reviewing the session. `attempt` counts from 1.
    pub fn run(&self, session_id: u64, attempt: u32) -> Next {
        let outcome = self
            .service
            .review_session(session_id, |answers| self.reviewer.review(answers));
        match outcome {
            Ok(report) if report.failed == 0 => Next::Done,
            Ok(_) => self.after_failure(attempt, self.retry_delay, "some answers"),
            Err(LearningError::Provider(error)) if error.code == ProviderErrorCode::RateLimited => {
                crate::diagnostics::log(
                    "usage-review",
                    format_args!("The usage review hit the quota."),
                );
                Next::PausedFor(self.quota_pause)
            }
            Err(error) => {
                crate::diagnostics::log(
                    "usage-review",
                    format_args!("The usage review failed: {error}"),
                );
                self.after_failure(attempt, self.retry_delay, "the session")
            }
        }
    }

    fn after_failure(&self, attempt: u32, delay: Duration, what: &str) -> Next {
        if attempt >= MAX_ATTEMPTS {
            crate::diagnostics::log(
                "usage-review",
                format_args!("The usage review of {what} gave up."),
            );
            return Next::GiveUp;
        }
        Next::RetryAfter(delay)
    }
}

struct Job {
    session_id: u64,
    attempt: u32,
    due_at: Instant,
}

pub struct UsageReviewQueue {
    sender: Sender<u64>,
}

impl UsageReviewQueue {
    /// Starts the worker thread. `notify` runs after every run, so the screens can read the result.
    pub fn start(
        worker: UsageReviewWorker,
        notify: impl Fn(u64) + Send + 'static,
    ) -> std::io::Result<Self> {
        let (sender, receiver) = mpsc::channel::<u64>();
        thread::Builder::new()
            .name("usage-review-queue".into())
            .spawn(move || {
                let mut jobs: Vec<Job> = Vec::new();
                loop {
                    let wait = jobs
                        .iter()
                        .map(|job| job.due_at.saturating_duration_since(Instant::now()))
                        .min();
                    let incoming = match wait {
                        Some(wait) => receiver.recv_timeout(wait),
                        None => receiver.recv().map_err(|_| RecvTimeoutError::Disconnected),
                    };
                    match incoming {
                        Ok(session_id) => {
                            if jobs.iter().all(|job| job.session_id != session_id) {
                                jobs.push(Job {
                                    session_id,
                                    attempt: 1,
                                    due_at: Instant::now(),
                                });
                            }
                        }
                        Err(RecvTimeoutError::Timeout) => {}
                        Err(RecvTimeoutError::Disconnected) => return,
                    }
                    let now = Instant::now();
                    let (due, later): (Vec<Job>, Vec<Job>) =
                        jobs.drain(..).partition(|job| job.due_at <= now);
                    jobs = later;
                    for job in due {
                        let next = worker.run(job.session_id, job.attempt);
                        notify(job.session_id);
                        let (attempt, delay) = match next {
                            Next::RetryAfter(delay) => (job.attempt + 1, delay),
                            Next::PausedFor(delay) => (job.attempt, delay),
                            Next::Done | Next::GiveUp => continue,
                        };
                        jobs.push(Job {
                            session_id: job.session_id,
                            attempt,
                            due_at: Instant::now() + delay,
                        });
                    }
                }
            })?;
        Ok(Self { sender })
    }

    /// Queues the review of a finished session; it never blocks and never fails the caller.
    pub fn enqueue(&self, session_id: u64) {
        let _ = self.sender.send(session_id);
    }
}
