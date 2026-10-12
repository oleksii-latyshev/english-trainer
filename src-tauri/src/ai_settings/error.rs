use crate::core::{IpcError, IpcErrorCode};
use crate::providers::ProviderError;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum AiSettingsError {
    #[error("could not {operation} the conversation settings")]
    Storage {
        operation: &'static str,
        #[source]
        source: Box<dyn std::error::Error + Send + Sync>,
    },
    #[error("the conversation provider failed to warm up")]
    Provider(ProviderError),
}

impl From<AiSettingsError> for IpcError {
    fn from(error: AiSettingsError) -> Self {
        match error {
            AiSettingsError::Storage { .. } => Self::new(
                IpcErrorCode::DatabaseError,
                "Could not read or save conversation settings locally. Please retry.",
            ),
            AiSettingsError::Provider(provider) => Self::from(provider),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::providers::ProviderErrorCode;

    #[test]
    fn storage_failures_map_to_a_database_error_without_internal_details() {
        let error = AiSettingsError::Storage {
            operation: "read",
            source: Box::new(std::io::Error::other("/Users/someone/db.sqlite3")),
        };
        let ipc = IpcError::from(error);
        assert_eq!(ipc.code, IpcErrorCode::DatabaseError);
        assert!(!ipc.message.contains("/Users"));
    }

    #[test]
    fn provider_failures_keep_their_code_and_message() {
        let provider = ProviderError::new(ProviderErrorCode::Unauthorized, "Add a key.");
        assert_eq!(
            IpcError::from(AiSettingsError::Provider(provider)),
            IpcError::new(IpcErrorCode::Unauthorized, "Add a key.")
        );
    }
}
