use crate::core::{IpcError, IpcErrorCode};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum PersonalProfileError {
    #[error("{field} is longer than the allowed length")]
    FieldTooLong { field: &'static str },
    #[error("could not {operation} the personal profile")]
    Storage {
        operation: &'static str,
        #[source]
        source: Box<dyn std::error::Error + Send + Sync>,
    },
}

impl From<PersonalProfileError> for IpcError {
    fn from(error: PersonalProfileError) -> Self {
        match error {
            PersonalProfileError::FieldTooLong { field } => Self::new(
                IpcErrorCode::InvalidRequest,
                format!("{field} must be 150 characters or fewer."),
            ),
            PersonalProfileError::Storage { .. } => Self::new(
                IpcErrorCode::DatabaseError,
                "Could not read or save your profile locally. Please retry.",
            ),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn an_over_long_field_is_an_invalid_request_naming_the_field() {
        let ipc = IpcError::from(PersonalProfileError::FieldTooLong { field: "Role" });
        assert_eq!(ipc.code, IpcErrorCode::InvalidRequest);
        assert_eq!(ipc.message, "Role must be 150 characters or fewer.");
    }

    #[test]
    fn storage_failures_map_to_a_database_error_without_internal_details() {
        let ipc = IpcError::from(PersonalProfileError::Storage {
            operation: "save",
            source: Box::new(std::io::Error::other("/Users/someone/db.sqlite3")),
        });
        assert_eq!(ipc.code, IpcErrorCode::DatabaseError);
        assert!(!ipc.message.contains("/Users"));
    }
}
