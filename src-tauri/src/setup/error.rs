use crate::core::{IpcError, IpcErrorCode};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum SetupError {
    #[error("the application data directory could not be located")]
    DataDirectoryUnavailable,
}

impl From<SetupError> for IpcError {
    fn from(error: SetupError) -> Self {
        match error {
            SetupError::DataDirectoryUnavailable => Self::new(
                IpcErrorCode::ProcessFailed,
                "Cannot locate the application data directory.",
            ),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_missing_data_directory_maps_to_a_process_failure() {
        let ipc = IpcError::from(SetupError::DataDirectoryUnavailable);
        assert_eq!(ipc.code, IpcErrorCode::ProcessFailed);
    }
}
