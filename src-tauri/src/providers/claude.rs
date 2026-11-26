//! The background analysis provider: one Claude Code CLI call per job, pinned to Sonnet.
//! Real-time conversation never goes through here.

pub(crate) mod coaching;
pub(crate) mod mistake_practice;
pub(crate) mod rescue;
pub(crate) mod runner;
pub(crate) mod session_wrapup;
pub(crate) mod spoken_review;
pub(crate) mod structured;
pub(crate) mod usage;

#[cfg(test)]
mod live_tests;
#[cfg(test)]
mod runner_tests;
