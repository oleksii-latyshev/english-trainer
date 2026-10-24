use super::TranslationError;
use crate::core::IpcError;

impl From<TranslationError> for IpcError {
    fn from(error: TranslationError) -> Self {
        Self::new(error.code.into(), error.message)
    }
}
