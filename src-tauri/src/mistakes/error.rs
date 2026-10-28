use crate::core::{IpcError, IpcErrorCode};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum MistakesError {
    #[error("could not {operation} mistakes")]
    Storage {
        operation: &'static str,
        #[source]
        source: Box<dyn std::error::Error + Send + Sync>,
    },
    #[error("mistake {0} does not exist")]
    NotFound(u64),
}

impl MistakesError {
    pub fn storage(
        operation: &'static str,
    ) -> impl FnOnce(rusqlite::Error) -> Self + Copy + 'static {
        move |source| Self::Storage {
            operation,
            source: Box::new(source),
        }
    }
}

impl From<MistakesError> for IpcError {
    fn from(error: MistakesError) -> Self {
        match error {
            MistakesError::Storage { .. } => Self::new(
                IpcErrorCode::DatabaseError,
                "Could not read or save your mistakes on this Mac. Please retry.",
            ),
            MistakesError::NotFound(_) => Self::new(
                IpcErrorCode::InvalidRequest,
                "That mistake is no longer in your list.",
            ),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LessonProviderError {
    QuotaExhausted,
    Failed,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn storage_failures_map_to_a_database_error_without_internal_details() {
        let error = MistakesError::Storage {
            operation: "read",
            source: Box::new(std::io::Error::other("/Users/someone/db.sqlite3")),
        };
        let ipc = IpcError::from(error);
        assert_eq!(ipc.code, IpcErrorCode::DatabaseError);
        assert!(!ipc.message.contains("/Users"));
    }

    #[test]
    fn a_missing_mistake_is_an_invalid_request() {
        let ipc = IpcError::from(MistakesError::NotFound(3));
        assert_eq!(ipc.code, IpcErrorCode::InvalidRequest);
    }
}
