#![cfg_attr(
    not(test),
    deny(clippy::unwrap_used, clippy::expect_used, clippy::panic)
)]

pub mod commands;
mod domain;
mod error;
mod infra;
mod service;
#[cfg(test)]
mod tests;
