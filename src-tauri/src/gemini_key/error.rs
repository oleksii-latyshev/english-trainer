use crate::core::{IpcError, IpcErrorCode};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum GeminiKeyError {
    #[error("the key store has not been configured")]
    StoreNotConfigured,
    #[error("could not {operation} the key file")]
    Storage {
        operation: &'static str,
        #[source]
        source: std::io::Error,
    },
    #[error("could not derive this computer's secret")]
    DeviceSecret,
    #[error("could not encrypt the key")]
    Encryption,
    #[error("the saved key cannot be decrypted on this computer")]
    Unreadable,
    #[error("no Gemini API key is set")]
    Missing,
    #[error("the text does not look like a Gemini API key")]
    Implausible,
}

impl From<GeminiKeyError> for IpcError {
    fn from(error: GeminiKeyError) -> Self {
        match error {
            GeminiKeyError::StoreNotConfigured
            | GeminiKeyError::Storage { .. }
            | GeminiKeyError::DeviceSecret
            | GeminiKeyError::Encryption => Self::new(
                IpcErrorCode::Unavailable,
                "Could not access the saved Gemini API key. Paste it again in Settings.",
            ),
            GeminiKeyError::Unreadable => Self::new(
                IpcErrorCode::Unauthorized,
                "The saved Gemini API key cannot be read on this computer. Paste it again in Settings.",
            ),
            GeminiKeyError::Missing => Self::new(
                IpcErrorCode::Unauthorized,
                "No Gemini API key is set. Add one in Settings, or choose another provider.",
            ),
            GeminiKeyError::Implausible => Self::new(
                IpcErrorCode::InvalidRequest,
                "That does not look like a Gemini API key. Copy it again from Google AI Studio.",
            ),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn each_failure_maps_to_the_code_the_ui_branches_on() {
        let code = |error: GeminiKeyError| IpcError::from(error).code;
        assert_eq!(
            code(GeminiKeyError::StoreNotConfigured),
            IpcErrorCode::Unavailable
        );
        assert_eq!(
            code(GeminiKeyError::DeviceSecret),
            IpcErrorCode::Unavailable
        );
        assert_eq!(code(GeminiKeyError::Unreadable), IpcErrorCode::Unauthorized);
        assert_eq!(code(GeminiKeyError::Missing), IpcErrorCode::Unauthorized);
        assert_eq!(
            code(GeminiKeyError::Implausible),
            IpcErrorCode::InvalidRequest
        );
    }

    #[test]
    fn learner_messages_never_leak_file_paths() {
        let error = GeminiKeyError::Storage {
            operation: "read",
            source: std::io::Error::other("/Users/someone/Library/key.enc"),
        };
        assert!(!IpcError::from(error).message.contains("/Users"));
    }
}
