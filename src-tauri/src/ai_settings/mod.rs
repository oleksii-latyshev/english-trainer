#![cfg_attr(
    not(test),
    deny(clippy::unwrap_used, clippy::expect_used, clippy::panic)
)]

pub mod commands;
mod domain;
mod error;
mod infra;
mod ports;
mod service;

pub use domain::{AgyModel, AiSettings, ConversationProvider, EvaStyle};
pub use infra::{AppleProviderWarmup, SessionSettingsStore};
pub use service::AiSettingsService;
