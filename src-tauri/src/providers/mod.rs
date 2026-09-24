mod agy;

use serde::{Deserialize, Serialize};

pub use agy::generate_follow_up;

pub trait ConversationEngine {
    fn generate_turn(&self, transcript: &str) -> Result<ConversationTurn, ProviderError>;
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ConversationTurn {
    pub spoken_reply: String,
    pub question: Option<String>,
    pub session_phase: String,
    pub is_complete: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum ProviderErrorCode {
    Unavailable,
    Timeout,
    InvalidOutput,
    ProcessFailed,
    InvalidRequest,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct ProviderError {
    pub code: ProviderErrorCode,
    pub message: String,
}

impl ProviderError {
    pub fn new(code: ProviderErrorCode, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
        }
    }
}
