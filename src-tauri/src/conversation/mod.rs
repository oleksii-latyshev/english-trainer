#![cfg_attr(
    not(test),
    deny(clippy::unwrap_used, clippy::expect_used, clippy::panic)
)]

pub mod commands;
pub(crate) mod domain;
pub(crate) mod error;
pub(crate) mod infra;
pub mod ports;
pub(crate) mod service;

pub use domain::{
    question_scaffold, FinishedPracticeSession, InputSource, PracticeDialogue, PracticeMode,
    PracticePhase, PracticeSession, SavedWrapupPhrases, StartPracticeOptions, StoredTurn,
    WrapupPhrase,
};
pub use service::{CoachingQueue, SessionStore, WrapupQueue, IDLE_FLUSH, QUOTA_PAUSE};
