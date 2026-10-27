pub mod commands;
mod domain;
mod error;
mod infra;
mod ports;
mod service;
#[cfg(test)]
mod service_tests;

pub use domain::{AnswerContext, ServerState, ServerStatus, SpeechSettings, SEED_GLOSSARY};
pub use infra::{
    resolve_server_binary, resolve_whisper_binary, CliTranscriber, KeptRecordingFiles, ModelFiles,
    SessionSpeechStore, SpeechCheckFiles, WhisperEngine,
};
pub use service::{SpeechRecognitionPorts, SpeechRecognitionService};
