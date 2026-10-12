use super::limit_text::{quota_excerpt, resets_in_secs};
use serde::Serialize;
use ts_rs::TS;

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

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum UsageEvent {
    Request {
        source: UsageSource,
        model: String,
        at_ms: i64,
    },
    Limited {
        source: UsageSource,
        model: String,
        message: String,
        resets_at_ms: Option<i64>,
        at_ms: i64,
    },
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, TS)]
#[ts(export)]
pub struct ApiUsageOverview {
    pub day: String,
    pub gemini: GeminiUsage,
    pub antigravity: AntigravityUsage,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, TS)]
#[ts(export)]
pub struct GeminiUsage {
    pub models: Vec<ModelRequests>,
    pub last_limit: Option<LimitNote>,
    pub resets_at_ms: i64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, TS)]
#[ts(export)]
pub struct ModelRequests {
    pub model: String,
    pub requests: u64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, TS)]
#[ts(export)]
pub struct AntigravityUsage {
    pub requests_today: u64,
    pub last_quota_error: Option<LimitNote>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, TS)]
#[ts(export)]
pub struct LimitNote {
    pub occurred_at_ms: i64,
    pub model: String,
    pub message: String,
    pub resets_at_ms: Option<i64>,
}

pub fn limit_event(
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

    #[test]
    fn the_overview_serializes_with_snake_case_fields_and_null_notes() {
        let overview = ApiUsageOverview {
            day: "2027-01-15".into(),
            gemini: GeminiUsage {
                models: vec![ModelRequests {
                    model: "m".into(),
                    requests: 2,
                }],
                last_limit: None,
                resets_at_ms: 9,
            },
            antigravity: AntigravityUsage {
                requests_today: 1,
                last_quota_error: None,
            },
        };
        assert_eq!(
            serde_json::to_value(overview).unwrap(),
            serde_json::json!({
                "day": "2027-01-15",
                "gemini": {"models": [{"model": "m", "requests": 2}], "last_limit": null, "resets_at_ms": 9},
                "antigravity": {"requests_today": 1, "last_quota_error": null}
            })
        );
    }
}
