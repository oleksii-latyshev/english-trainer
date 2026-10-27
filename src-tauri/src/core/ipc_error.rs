use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "snake_case")]
#[ts(export)]
pub enum IpcErrorCode {
    Unavailable,
    Unauthorized,
    RateLimited,
    Timeout,
    Cancelled,
    InvalidOutput,
    ProcessFailed,
    InvalidRequest,
    Busy,
    InvalidSession,
    DatabaseError,
    InvalidAudio,
    NoSpeech,
    ModelMissing,
    EngineMissing,
    DownloadRequired,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct IpcError {
    pub code: IpcErrorCode,
    pub message: String,
}

impl IpcError {
    pub fn new(code: IpcErrorCode, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
        }
    }

    pub fn task_failed(message: &'static str) -> impl FnOnce(tauri::Error) -> Self {
        move |_| Self::new(IpcErrorCode::ProcessFailed, message)
    }
}
