use crate::core::{IpcError, IpcErrorCode};
use thiserror::Error;

#[derive(Debug, Error, PartialEq, Eq)]
pub enum VoiceError {
    #[error("the speech request is not valid")]
    InvalidRequest,
    #[error("the local voice is not installed or not ready")]
    Unavailable,
    #[error("the local voice is already rendering another phrase")]
    Busy,
    #[error("the local voice missed its deadline")]
    Timeout,
    #[error("the local voice process failed")]
    ProcessFailed,
}

impl From<VoiceError> for IpcError {
    fn from(error: VoiceError) -> Self {
        let code = match error {
            VoiceError::InvalidRequest => IpcErrorCode::InvalidRequest,
            VoiceError::Unavailable => IpcErrorCode::Unavailable,
            VoiceError::Busy => IpcErrorCode::Busy,
            VoiceError::Timeout => IpcErrorCode::Timeout,
            VoiceError::ProcessFailed => IpcErrorCode::ProcessFailed,
        };
        Self::new(
            code,
            "Local voice could not play. Use the system voice or try again.",
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_failure_keeps_a_distinct_code_and_the_same_learner_message() {
        let cases = [
            (VoiceError::InvalidRequest, IpcErrorCode::InvalidRequest),
            (VoiceError::Unavailable, IpcErrorCode::Unavailable),
            (VoiceError::Busy, IpcErrorCode::Busy),
            (VoiceError::Timeout, IpcErrorCode::Timeout),
            (VoiceError::ProcessFailed, IpcErrorCode::ProcessFailed),
        ];
        for (error, code) in cases {
            let ipc = IpcError::from(error);
            assert_eq!(ipc.code, code);
            assert_eq!(
                ipc.message,
                "Local voice could not play. Use the system voice or try again."
            );
        }
    }
}
