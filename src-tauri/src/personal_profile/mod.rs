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

pub use domain::PersonalProfile;
pub use infra::SessionProfileStore;
pub use service::PersonalProfileService;
