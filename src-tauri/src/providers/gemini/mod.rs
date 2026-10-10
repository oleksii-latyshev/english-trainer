//! Gemini API conversation adapter: streamed plain-text replies over HTTPS.

mod key;
mod stream;
#[cfg(test)]
mod tests;
mod wire;

use super::{
    answered_by::GEMINI_CONVERSATION_MODEL as CONVERSATION_MODEL,
    context::validate_plain_context,
    race::{self, Backup},
    reply_text::plain_turn,
    AnsweredBy, ConversationContext, ConversationTurn, ProviderError, ProviderErrorCode,
};
use std::{sync::OnceLock, time::Duration};

pub use key::{configure_key_store, delete_api_key, key_status, save_api_key, GeminiKeyStatus};

const BASE_URL: &str = "https://generativelanguage.googleapis.com";
const CONNECT_TIMEOUT: Duration = Duration::from_secs(5);
const REQUEST_TIMEOUT: Duration = Duration::from_secs(20);

/// Total context the primary accepts: 20 full turns plus condensed history and asked questions.
pub(crate) const MAX_CONTEXT_CHARS: usize = 24_000;

/// Streams a reply; `backup` takes over if Gemini stalls or is overloaded before its first word.
#[cfg(test)]
pub(super) fn generate_turn(
    context: &ConversationContext,
    backup: Option<Backup>,
    on_delta: &mut dyn FnMut(&str),
) -> Result<ConversationTurn, ProviderError> {
    generate_turn_cancellable(
        context,
        backup,
        on_delta,
        &std::sync::atomic::AtomicBool::new(false),
    )
}

pub(super) fn generate_turn_cancellable(
    context: &ConversationContext,
    backup: Option<Backup>,
    on_delta: &mut dyn FnMut(&str),
    cancelled: &std::sync::atomic::AtomicBool,
) -> Result<ConversationTurn, ProviderError> {
    validate_plain_context(context, MAX_CONTEXT_CHARS)?;
    let api_key = key::resolve_key()?;
    let result =
        generate_from_cancellable(BASE_URL, &api_key, context, backup, on_delta, cancelled);
    if matches!(&result, Err(error) if error.code == ProviderErrorCode::Unauthorized) {
        key::forget_cached_key();
    }
    result
}

/// Decrypts the API key into memory before the first reply.
pub(super) fn prewarm() -> Result<(), ProviderError> {
    key::resolve_key().map(|_| ())
}

#[cfg(test)]
fn generate_from(
    base_url: &str,
    api_key: &str,
    context: &ConversationContext,
    backup: Option<Backup>,
    on_delta: &mut dyn FnMut(&str),
) -> Result<ConversationTurn, ProviderError> {
    generate_from_cancellable(
        base_url,
        api_key,
        context,
        backup,
        on_delta,
        &std::sync::atomic::AtomicBool::new(false),
    )
}

fn generate_from_cancellable(
    base_url: &str,
    api_key: &str,
    context: &ConversationContext,
    backup: Option<Backup>,
    on_delta: &mut dyn FnMut(&str),
    cancelled: &std::sync::atomic::AtomicBool,
) -> Result<ConversationTurn, ProviderError> {
    let primary = stream::leg(stream::Request {
        base_url: base_url.to_string(),
        api_key: api_key.to_string(),
        model: CONVERSATION_MODEL,
        body: wire::request_body(context),
    });
    let (reply, answered_by) = race::race_cancellable(
        (primary, AnsweredBy::gemini()),
        backup,
        REQUEST_TIMEOUT,
        on_delta,
        cancelled,
    )?;
    let mut turn = plain_turn(&reply)?;
    turn.answered_by = Some(answered_by);
    Ok(turn)
}

// One client per app run keeps the TLS connection alive between turns, saving a handshake per reply.
fn client() -> Result<&'static reqwest::blocking::Client, ProviderError> {
    static CLIENT: OnceLock<reqwest::blocking::Client> = OnceLock::new();
    if let Some(client) = CLIENT.get() {
        return Ok(client);
    }
    let client = reqwest::blocking::Client::builder()
        .connect_timeout(CONNECT_TIMEOUT)
        .timeout(REQUEST_TIMEOUT)
        .build()
        .map_err(|_| {
            ProviderError::new(
                ProviderErrorCode::ProcessFailed,
                "Could not prepare the Gemini request. Please retry.",
            )
        })?;
    Ok(CLIENT.get_or_init(|| client))
}

fn network_error(is_timeout: bool) -> ProviderError {
    if is_timeout {
        return ProviderError::new(
            ProviderErrorCode::Timeout,
            "Gemini took too long to answer. Retry, or switch provider in Settings.",
        );
    }
    ProviderError::new(
        ProviderErrorCode::Unavailable,
        "Could not reach Gemini. Check your internet connection and retry.",
    )
}
