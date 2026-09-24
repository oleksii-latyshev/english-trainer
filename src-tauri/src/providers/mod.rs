mod agy;

use serde::{Deserialize, Serialize};
use std::time::Instant;

pub fn generate_follow_up(transcript: String) -> Result<ConversationTurn, ProviderError> {
    generate_conversation_turn(&ConversationContext {
        opening_question: String::new(),
        recent_turns: Vec::new(),
        latest_transcript: transcript,
    })
}

pub fn generate_conversation_turn(
    context: &ConversationContext,
) -> Result<ConversationTurn, ProviderError> {
    measure_turn(|| agy::generate_turn(context))
}

fn measure_turn(
    generate: impl FnOnce() -> Result<ConversationTurn, ProviderError>,
) -> Result<ConversationTurn, ProviderError> {
    let started_at = Instant::now();
    let mut turn = generate()?;
    turn.provider_latency_ms =
        Some(u64::try_from(started_at.elapsed().as_millis()).unwrap_or(u64::MAX));
    Ok(turn)
}

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
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub provider_latency_ms: Option<u64>,
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

#[cfg(test)]
mod timing_tests {
    use super::*;

    #[test]
    fn provider_boundary_adds_latency_to_the_returned_turn() {
        let turn = measure_turn(|| {
            Ok(ConversationTurn {
                spoken_reply: "I see.".into(),
                question: Some("Why?".into()),
                session_phase: "active".into(),
                is_complete: false,
                provider_latency_ms: None,
            })
        })
        .unwrap();

        assert!(turn.provider_latency_ms.is_some());
        assert!(serde_json::to_value(&turn)
            .unwrap()
            .get("provider_latency_ms")
            .is_some());
    }
}
