pub mod commands;
mod domain;
mod infra;
mod ports;
mod service;

pub use infra::FileLogStore;
pub use service::{install, log, Diagnostics};
