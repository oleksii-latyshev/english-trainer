use crate::core::{IpcError, IpcErrorCode};
use crate::translation::{TranslationError, TranslationErrorCode};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum TranslationSettingsError {
    #[error("the native language is not supported")]
    UnsupportedLanguage,
    #[error("could not {operation} the translation settings")]
    Storage {
        operation: &'static str,
        #[source]
        source: Box<dyn std::error::Error + Send + Sync>,
    },
    #[error("translation availability failed")]
    Availability(TranslationError),
}

impl From<TranslationErrorCode> for IpcErrorCode {
    fn from(code: TranslationErrorCode) -> Self {
        match code {
            TranslationErrorCode::InvalidRequest | TranslationErrorCode::UnsupportedLanguage => {
                Self::InvalidRequest
            }
            TranslationErrorCode::Unavailable => Self::Unavailable,
            TranslationErrorCode::DownloadRequired => Self::DownloadRequired,
            TranslationErrorCode::Busy => Self::Busy,
            TranslationErrorCode::Timeout => Self::Timeout,
            TranslationErrorCode::ProcessFailed => Self::ProcessFailed,
            TranslationErrorCode::InvalidOutput => Self::InvalidOutput,
            TranslationErrorCode::DatabaseError => Self::DatabaseError,
            TranslationErrorCode::Cancelled => Self::Cancelled,
        }
    }
}

impl From<TranslationSettingsError> for IpcError {
    fn from(error: TranslationSettingsError) -> Self {
        match error {
            TranslationSettingsError::UnsupportedLanguage => Self::new(
                IpcErrorCode::InvalidRequest,
                "Choose a supported native language in Settings and try again.",
            ),
            TranslationSettingsError::Storage { .. } => Self::new(
                IpcErrorCode::DatabaseError,
                "Could not read or save translation settings locally. Please retry.",
            ),
            TranslationSettingsError::Availability(failure) => {
                Self::new(failure.code.into(), failure.message)
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn an_unsupported_language_is_an_invalid_request() {
        let ipc = IpcError::from(TranslationSettingsError::UnsupportedLanguage);
        assert_eq!(ipc.code, IpcErrorCode::InvalidRequest);
    }

    #[test]
    fn storage_failures_map_to_a_database_error_without_internal_details() {
        let ipc = IpcError::from(TranslationSettingsError::Storage {
            operation: "read",
            source: Box::new(std::io::Error::other("/Users/someone/db.sqlite3")),
        });
        assert_eq!(ipc.code, IpcErrorCode::DatabaseError);
        assert!(!ipc.message.contains("/Users"));
    }

    #[test]
    fn availability_failures_keep_their_message_and_map_the_code() {
        let failure = TranslationError::new(TranslationErrorCode::DownloadRequired, "Prepare it.");
        assert_eq!(
            IpcError::from(TranslationSettingsError::Availability(failure)),
            IpcError::new(IpcErrorCode::DownloadRequired, "Prepare it.")
        );
    }
}
