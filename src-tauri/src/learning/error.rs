use super::review_rules::ReviewRejection;
use super::usage_rules::UsageRejection;
use crate::core::{IpcError, IpcErrorCode};
use crate::providers::ProviderError;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum LearningError {
    #[error("invalid learning item id")]
    InvalidItemId,
    #[error("phrase length is out of range")]
    InvalidPhrase,
    #[error("note is too long")]
    NoteTooLong,
    #[error("invalid phrase source session")]
    InvalidSourceSession,
    #[error("invalid phrase source turn")]
    InvalidSourceTurn,
    #[error("phrase source is incomplete")]
    IncompletePhraseSource,
    #[error("phrase source turn not found")]
    PhraseSourceNotFound,
    #[error("learning item not found")]
    ItemNotFound,
    #[error("review rejected: {0:?}")]
    Review(ReviewRejection),
    #[error("usage review rejected: {0:?}")]
    Usage(UsageRejection),
    #[error("provider failed: {0:?}")]
    Provider(ProviderError),
    #[error("could not {operation} learning memory")]
    Storage {
        operation: &'static str,
        #[source]
        source: Box<dyn std::error::Error + Send + Sync>,
    },
}

impl From<LearningError> for IpcError {
    fn from(error: LearningError) -> Self {
        match error {
            LearningError::InvalidItemId => {
                Self::new(IpcErrorCode::InvalidRequest, "Invalid learning item ID.")
            }
            LearningError::InvalidPhrase => Self::new(
                IpcErrorCode::InvalidRequest,
                "Phrase must be between 1 and 300 characters.",
            ),
            LearningError::NoteTooLong => Self::new(
                IpcErrorCode::InvalidRequest,
                "Note must be 500 characters or fewer.",
            ),
            LearningError::InvalidSourceSession => {
                Self::new(IpcErrorCode::InvalidRequest, "Invalid session ID.")
            }
            LearningError::InvalidSourceTurn => {
                Self::new(IpcErrorCode::InvalidRequest, "Invalid turn sequence.")
            }
            LearningError::IncompletePhraseSource => Self::new(
                IpcErrorCode::InvalidRequest,
                "Phrase provenance requires both a session ID and a turn sequence.",
            ),
            LearningError::PhraseSourceNotFound => Self::new(
                IpcErrorCode::InvalidRequest,
                "The phrase source turn could not be found.",
            ),
            LearningError::ItemNotFound => Self::new(
                IpcErrorCode::InvalidRequest,
                "The requested learning item does not exist.",
            ),
            LearningError::Review(rejection) => Self::new(rejection.code(), rejection.message()),
            LearningError::Usage(rejection) => Self::new(rejection.code(), rejection.message()),
            LearningError::Provider(error) => Self::from(error),
            LearningError::Storage { .. } => Self::new(
                IpcErrorCode::DatabaseError,
                "Could not read or update your Memory saved on this Mac. Please retry.",
            ),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn storage_failures_map_to_a_database_error_without_internal_details() {
        let error = LearningError::Storage {
            operation: "read",
            source: Box::new(std::io::Error::other("/Users/someone/db.sqlite3")),
        };
        let ipc = IpcError::from(error);
        assert_eq!(ipc.code, IpcErrorCode::DatabaseError);
        assert!(!ipc.message.contains("/Users"));
    }

    #[test]
    fn validation_failures_map_to_invalid_request() {
        for error in [
            LearningError::InvalidItemId,
            LearningError::InvalidPhrase,
            LearningError::NoteTooLong,
            LearningError::InvalidSourceSession,
            LearningError::InvalidSourceTurn,
            LearningError::IncompletePhraseSource,
            LearningError::PhraseSourceNotFound,
            LearningError::ItemNotFound,
        ] {
            assert_eq!(IpcError::from(error).code, IpcErrorCode::InvalidRequest);
        }
    }
}
