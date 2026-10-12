use crate::providers::{ProviderError, ProviderErrorCode};
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

impl From<ProviderErrorCode> for IpcErrorCode {
    fn from(code: ProviderErrorCode) -> Self {
        match code {
            ProviderErrorCode::Unavailable => Self::Unavailable,
            ProviderErrorCode::Unauthorized => Self::Unauthorized,
            ProviderErrorCode::RateLimited => Self::RateLimited,
            ProviderErrorCode::Timeout => Self::Timeout,
            ProviderErrorCode::Cancelled => Self::Cancelled,
            ProviderErrorCode::InvalidOutput => Self::InvalidOutput,
            ProviderErrorCode::ProcessFailed => Self::ProcessFailed,
            ProviderErrorCode::InvalidRequest => Self::InvalidRequest,
            ProviderErrorCode::Busy => Self::Busy,
            ProviderErrorCode::InvalidSession => Self::InvalidSession,
            ProviderErrorCode::DatabaseError => Self::DatabaseError,
        }
    }
}

impl From<IpcErrorCode> for ProviderErrorCode {
    fn from(code: IpcErrorCode) -> Self {
        match code {
            IpcErrorCode::Unavailable => Self::Unavailable,
            IpcErrorCode::Unauthorized => Self::Unauthorized,
            IpcErrorCode::RateLimited => Self::RateLimited,
            IpcErrorCode::Timeout => Self::Timeout,
            IpcErrorCode::Cancelled => Self::Cancelled,
            IpcErrorCode::InvalidOutput => Self::InvalidOutput,
            IpcErrorCode::ProcessFailed => Self::ProcessFailed,
            IpcErrorCode::InvalidRequest => Self::InvalidRequest,
            IpcErrorCode::Busy => Self::Busy,
            IpcErrorCode::InvalidSession => Self::InvalidSession,
            IpcErrorCode::DatabaseError => Self::DatabaseError,
            IpcErrorCode::InvalidAudio => Self::InvalidRequest,
            IpcErrorCode::NoSpeech => Self::InvalidOutput,
            IpcErrorCode::ModelMissing | IpcErrorCode::EngineMissing => Self::Unavailable,
        }
    }
}

impl From<ProviderError> for IpcError {
    fn from(error: ProviderError) -> Self {
        Self::new(error.code.into(), error.message)
    }
}

impl From<IpcError> for ProviderError {
    fn from(error: IpcError) -> Self {
        Self::new(error.code.into(), error.message)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::providers::ReplyStage;

    const ALL_PROVIDER_CODES: [ProviderErrorCode; 11] = [
        ProviderErrorCode::Unavailable,
        ProviderErrorCode::Unauthorized,
        ProviderErrorCode::RateLimited,
        ProviderErrorCode::Timeout,
        ProviderErrorCode::Cancelled,
        ProviderErrorCode::InvalidOutput,
        ProviderErrorCode::ProcessFailed,
        ProviderErrorCode::InvalidRequest,
        ProviderErrorCode::Busy,
        ProviderErrorCode::InvalidSession,
        ProviderErrorCode::DatabaseError,
    ];

    #[test]
    fn codes_serialize_exactly_like_the_legacy_provider_codes() {
        for provider_code in ALL_PROVIDER_CODES {
            let ipc_code = IpcErrorCode::from(provider_code.clone());
            assert_eq!(
                serde_json::to_value(ipc_code).unwrap(),
                serde_json::to_value(&provider_code).unwrap()
            );
            assert_eq!(ProviderErrorCode::from(ipc_code), provider_code);
        }
    }

    #[test]
    fn an_ipc_error_has_the_same_json_shape_as_a_provider_error() {
        let ipc = IpcError::new(IpcErrorCode::InvalidRequest, "Try again.");
        let provider = ProviderError::new(ProviderErrorCode::InvalidRequest, "Try again.");
        assert_eq!(
            serde_json::to_value(&ipc).unwrap(),
            serde_json::to_value(&provider).unwrap()
        );
        assert_eq!(
            serde_json::to_value(&ipc).unwrap(),
            serde_json::json!({"code": "invalid_request", "message": "Try again."})
        );
    }

    #[test]
    fn converting_a_provider_error_keeps_code_and_message() {
        let mut provider = ProviderError::new(ProviderErrorCode::RateLimited, "Slow down.");
        provider.reply_stage = Some(ReplyStage::Content);
        assert_eq!(
            IpcError::from(provider),
            IpcError::new(IpcErrorCode::RateLimited, "Slow down.")
        );
    }
}
