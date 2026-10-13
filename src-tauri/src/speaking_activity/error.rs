use crate::core::{IpcError, IpcErrorCode};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum SpeakingActivityError {
    #[error("could not {operation} the speaking activity")]
    Storage {
        operation: &'static str,
        #[source]
        source: Box<dyn std::error::Error + Send + Sync>,
    },
}

impl From<SpeakingActivityError> for IpcError {
    fn from(error: SpeakingActivityError) -> Self {
        match error {
            SpeakingActivityError::Storage { .. } => Self::new(
                IpcErrorCode::DatabaseError,
                "Could not read your speaking activity saved on this Mac. Please retry.",
            ),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn storage_failures_map_to_a_database_error_without_internal_details() {
        let error = SpeakingActivityError::Storage {
            operation: "read",
            source: Box::new(std::io::Error::other("/Users/someone/db.sqlite3")),
        };
        let ipc = IpcError::from(error);
        assert_eq!(ipc.code, IpcErrorCode::DatabaseError);
        assert!(!ipc.message.contains("/Users"));
    }
}
