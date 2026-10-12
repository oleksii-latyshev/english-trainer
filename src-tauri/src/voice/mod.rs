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

pub use infra::SupertonicEngine;
pub use service::VoiceService;
