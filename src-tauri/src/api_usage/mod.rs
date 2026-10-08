//! What the app can know about its Gemini and Antigravity limits. Neither has an API for the
//! remaining quota, so requests are counted where they are sent and limit errors are noted where
//! they arrive; Google's own page shows the exact figures.

mod limit_text;
mod pacific;

pub use limit_text::{gemini_error_message, quota_excerpt, resets_in_secs};
pub use pacific::{next_pacific_midnight_ms, pacific_day};

use serde::Serialize;
use std::sync::{mpsc::Sender, OnceLock};
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum UsageSource {
    Gemini,
    Antigravity,
}

impl UsageSource {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Gemini => "gemini",
            Self::Antigravity => "antigravity",
        }
    }
}

/// Something worth remembering about the use of a provider's quota.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum UsageEvent {
    /// A request was sent.
    Request {
        source: UsageSource,
        model: String,
        at_ms: i64,
    },
    /// The provider said its limit is reached.
    Limited {
        source: UsageSource,
        model: String,
        message: String,
        /// When the quota comes back, if the provider said so.
        resets_at_ms: Option<i64>,
        at_ms: i64,
    },
}

static SINK: OnceLock<Sender<UsageEvent>> = OnceLock::new();

/// Sets where events go. They are written by another thread, so noting a request never delays one.
pub fn install(sender: Sender<UsageEvent>) {
    // A second install keeps the first sink; the app installs once at start.
    let _ = SINK.set(sender);
}

/// Hands an event to the installed sink; a no-op until one is installed (tests, helper binaries).
pub fn record(event: UsageEvent) {
    if let Some(sink) = SINK.get() {
        // The receiver only closes when the app is quitting; a lost count is harmless.
        let _ = sink.send(event);
    }
}

pub fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |elapsed| {
            i64::try_from(elapsed.as_millis()).unwrap_or(i64::MAX)
        })
}

pub fn record_request(source: UsageSource, model: &str) {
    record(UsageEvent::Request {
        source,
        model: model.to_string(),
        at_ms: now_ms(),
    });
}

pub fn record_limit(source: UsageSource, model: &str, message: String, resets_in: Option<u64>) {
    record(limit_event(source, model, message, resets_in, now_ms()));
}

fn limit_event(
    source: UsageSource,
    model: &str,
    message: String,
    resets_in: Option<u64>,
    at_ms: i64,
) -> UsageEvent {
    let resets_at_ms = resets_in.map(|seconds| {
        let millis = i64::try_from(seconds.saturating_mul(1_000)).unwrap_or(i64::MAX);
        at_ms.saturating_add(millis)
    });
    UsageEvent::Limited {
        source,
        model: model.to_string(),
        message,
        resets_at_ms,
        at_ms,
    }
}

/// The event for Antigravity output that says its quota is used up: the quota line, and the
/// moment it comes back when the text says "Resets in …".
pub fn antigravity_limit_event(model: &str, text: &str, at_ms: i64) -> UsageEvent {
    limit_event(
        UsageSource::Antigravity,
        model,
        quota_excerpt(text)
            .unwrap_or_else(|| "Antigravity reported that its quota is used up.".into()),
        resets_in_secs(text),
        at_ms,
    )
}

/// The daily request counts and last limit errors the Settings screen shows.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct ApiUsageOverview {
    /// The Pacific date these counts belong to, `YYYY-MM-DD`.
    pub day: String,
    pub gemini: GeminiUsage,
    pub antigravity: AntigravityUsage,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct GeminiUsage {
    pub models: Vec<ModelRequests>,
    /// Today's last rate-limit error, if there was one.
    pub last_limit: Option<LimitNote>,
    /// When today's count starts over: the next Pacific midnight.
    pub resets_at_ms: i64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct ModelRequests {
    pub model: String,
    pub requests: u64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct AntigravityUsage {
    pub requests_today: u64,
    /// The last quota error, whatever its age; `resets_at_ms` says whether it still applies.
    pub last_quota_error: Option<LimitNote>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct LimitNote {
    pub occurred_at_ms: i64,
    pub model: String,
    pub message: String,
    pub resets_at_ms: Option<i64>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn agy_output_becomes_a_limit_event_with_the_moment_the_quota_returns() {
        let stderr = "warming up\nError 429: RESOURCE_EXHAUSTED. Resets in 4h44m53s\n";
        assert_eq!(
            antigravity_limit_event("gemini-3.8-flash-medium", stderr, 1_000),
            UsageEvent::Limited {
                source: UsageSource::Antigravity,
                model: "gemini-3.8-flash-medium".into(),
                message: "Error 429: RESOURCE_EXHAUSTED. Resets in 4h44m53s".into(),
                resets_at_ms: Some(1_000 + 17_093_000),
                at_ms: 1_000,
            }
        );
    }

    #[test]
    fn a_quota_message_without_a_reset_time_has_no_reset_moment() {
        let UsageEvent::Limited { resets_at_ms, .. } =
            antigravity_limit_event("m", "RESOURCE_EXHAUSTED", 5)
        else {
            panic!("a limit event");
        };
        assert_eq!(resets_at_ms, None);
    }
}
