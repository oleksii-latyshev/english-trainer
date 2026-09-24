use serde::Serialize;

#[derive(Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum TranscriptionErrorCode {
    InvalidAudio,
    NoSpeech,
    ModelMissing,
    EngineMissing,
    EngineFailed,
    Timeout,
    IoFailure,
    InvalidOutput,
}

#[derive(Debug, PartialEq, Eq, Serialize)]
pub struct TranscriptionError {
    pub code: TranscriptionErrorCode,
    pub message: String,
}

impl TranscriptionError {
    pub fn new(code: TranscriptionErrorCode, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
        }
    }
}
