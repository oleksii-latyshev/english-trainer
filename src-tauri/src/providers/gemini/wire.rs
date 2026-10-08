//! Pure Gemini wire format: request body, SSE lines, and HTTP error mapping.

use super::super::{plain_prompt, ConversationContext, ProviderError, ProviderErrorCode};
use serde::Deserialize;
use serde_json::{json, Value};

pub(super) fn request_body(context: &ConversationContext) -> Value {
    let contents: Vec<Value> = plain_prompt::dialogue(context)
        .iter()
        .map(|line| {
            json!({
                "role": if line.is_learner { "user" } else { "model" },
                "parts": [{ "text": line.text }],
            })
        })
        .collect();
    json!({
        "systemInstruction": { "parts": [{ "text": plain_prompt::instructions(context) }] },
        "contents": contents,
        "generationConfig": {
            "maxOutputTokens": 220,
            "temperature": 0.8,
            "thinkingConfig": { "thinkingLevel": "minimal" },
        },
    })
}

#[derive(Deserialize)]
struct Chunk {
    #[serde(default)]
    candidates: Vec<Candidate>,
    #[serde(default, rename = "promptFeedback")]
    prompt_feedback: Option<PromptFeedback>,
}

#[derive(Deserialize)]
struct PromptFeedback {
    #[serde(default, rename = "blockReason")]
    block_reason: Option<String>,
}

#[derive(Deserialize)]
struct Candidate {
    #[serde(default)]
    content: Option<Content>,
}

#[derive(Deserialize)]
struct Content {
    #[serde(default)]
    parts: Vec<Part>,
}

#[derive(Deserialize)]
struct Part {
    #[serde(default)]
    text: Option<String>,
    #[serde(default)]
    thought: bool,
}

/// Text carried by one SSE line; `None` for lines that carry none (comments, blanks, metadata).
pub(super) fn text_from_sse_line(line: &str) -> Result<Option<String>, ProviderError> {
    let Some(data) = line.trim_end().strip_prefix("data:") else {
        return Ok(None);
    };
    let chunk: Chunk = serde_json::from_str(data.trim()).map_err(|_| {
        ProviderError::new(
            ProviderErrorCode::InvalidOutput,
            "Gemini sent a stream chunk the app could not read. Please retry.",
        )
    })?;
    if chunk
        .prompt_feedback
        .and_then(|feedback| feedback.block_reason)
        .is_some()
    {
        return Err(ProviderError::new(
            ProviderErrorCode::InvalidOutput,
            "Gemini declined to answer this message. Rephrase it and retry.",
        ));
    }
    let text: String = chunk
        .candidates
        .into_iter()
        .filter_map(|candidate| candidate.content)
        .flat_map(|content| content.parts)
        .filter(|part| !part.thought)
        .filter_map(|part| part.text)
        .collect();
    Ok((!text.is_empty()).then_some(text))
}

/// Statuses where the larger fallback model may still succeed.
pub(super) fn is_retryable(status: u16) -> bool {
    matches!(status, 429 | 500 | 503)
}

/// Never copies the response body: it can echo request details.
pub(super) fn error_for_status(status: u16, body: &str) -> ProviderError {
    match status {
        401 | 403 => unauthorized(),
        400 if body.contains("API_KEY_INVALID") => unauthorized(),
        429 => ProviderError::new(
            ProviderErrorCode::RateLimited,
            "Gemini rate limit reached. Wait a minute and retry, or switch provider in Settings.",
        ),
        500..=599 => ProviderError::new(
            ProviderErrorCode::Unavailable,
            "Gemini is temporarily unavailable. Retry in a moment or switch provider in Settings.",
        ),
        _ => ProviderError::new(
            ProviderErrorCode::ProcessFailed,
            "Gemini rejected the request. Retry, or switch provider in Settings.",
        ),
    }
}

fn unauthorized() -> ProviderError {
    ProviderError::new(
        ProviderErrorCode::Unauthorized,
        "Gemini did not accept the API key. Check or replace it in Settings.",
    )
}
