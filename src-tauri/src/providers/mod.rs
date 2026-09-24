mod agy;

use serde::{Deserialize, Serialize};

pub use agy::{generate_conversation_turn, generate_follow_up};

pub trait ConversationEngine: Send + Sync {
    fn generate_turn(
        &self,
        context: &ConversationContext,
    ) -> Result<ConversationTurn, ProviderError>;
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct ConversationContext {
    pub opening_question: String,
    pub recent_turns: Vec<ContextTurn>,
    pub latest_transcript: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct ContextTurn {
    pub learner: String,
    pub assistant_reply: String,
    pub assistant_question: String,
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
    Busy,
    InvalidSession,
    DatabaseError,
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
