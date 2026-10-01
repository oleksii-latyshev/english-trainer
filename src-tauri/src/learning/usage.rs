use super::models::{LearningItemType, LearningStatus};
use super::normalization::normalize_phrase as norm;
use super::scheduling::MS_PER_DAY;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;

pub const MAX_TARGET_CHARS: usize = 300;
pub const MAX_EXCERPT_CHARS: usize = 500;
pub const MIN_CONFIDENCE: f64 = 0.9;
pub const STABLE_REQUIRED_DAYS: i64 = 21;
pub const STABLE_REQUIRED_SESSIONS: usize = 3;
pub const STABLE_REQUIRED_BUCKETS: usize = 3;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum UsageOutcome {
    Correct,
    Incorrect,
    Uncertain,
}

impl UsageOutcome {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Correct => "correct",
            Self::Incorrect => "incorrect",
            Self::Uncertain => "uncertain",
        }
    }

    pub fn parse(value: &str) -> Option<Self> {
        match value {
            "correct" => Some(Self::Correct),
            "incorrect" => Some(Self::Incorrect),
            "uncertain" => Some(Self::Uncertain),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct UsageFinding {
    pub item_type: LearningItemType,
    pub item_id: u64,
    pub outcome: UsageOutcome,
    pub confidence: f64,
    pub exact_excerpt: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct UsageCandidate {
    pub item_type: LearningItemType,
    pub item_id: u64,
    pub target: String,
    pub cue: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct UsageEventRecord {
    pub id: u64,
    pub item_type: LearningItemType,
    pub item_id: u64,
    pub session_id: u64,
    pub sequence: usize,
    pub origin: String,
    pub original_turn_time: i64,
    pub outcome: UsageOutcome,
    pub exact_excerpt: String,
    pub confidence: f64,
    pub created_at: i64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct UsageAssessmentFinding {
    pub item_type: LearningItemType,
    pub item_id: u64,
    pub target: String,
    pub outcome: UsageOutcome,
    pub confidence: f64,
    pub exact_excerpt: String,
    pub credited: bool,
    pub status_after: LearningStatus,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct TurnUsageAssessment {
    pub session_id: u64,
    pub sequence: usize,
    pub assessed_at: i64,
    pub findings: Vec<UsageAssessmentFinding>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct MemoryUsageEvidence {
    pub item_type: LearningItemType,
    pub item_id: u64,
    pub distinct_session_count: usize,
    pub streak: usize,
    pub events: Vec<UsageEventRecord>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ProjectedMastery {
    pub status: LearningStatus,
    pub streak: usize,
    pub lifetime_distinct_sessions: usize,
    pub interval_days: u32,
    pub next_review_at: i64,
}

pub fn is_eligible_target_length(target: &str) -> bool {
    let trimmed = target.trim();
    if trimmed.is_empty() || trimmed.chars().count() > MAX_TARGET_CHARS {
        return false;
    }
    let normalized = norm(trimmed);
    let words: Vec<&str> = normalized.split_whitespace().collect();
    words.len() >= 2
}

pub fn contains_normalized_words(text: &str, target: &str) -> bool {
    let norm_target = norm(target);
    if norm_target.is_empty() {
        return false;
    }
    let target_words: Vec<&str> = norm_target.split_whitespace().collect();
    if target_words.is_empty() {
        return false;
    }
    let norm_text = norm(text);
    let text_words: Vec<&str> = norm_text.split_whitespace().collect();
    if text_words.len() < target_words.len() {
        return false;
    }
    text_words
        .windows(target_words.len())
        .any(|window| window == target_words.as_slice())
}

pub fn is_rejected_by_sources(target: &str, rejected_sources: &[&str]) -> bool {
    rejected_sources
        .iter()
        .any(|source| contains_normalized_words(source, target))
}

pub fn project_mastery_state(
    current_status: LearningStatus,
    events: &[UsageEventRecord],
    current_interval_days: u32,
    current_next_review_at: i64,
) -> ProjectedMastery {
    let lifetime_distinct_sessions = events
        .iter()
        .filter(|event| {
            event.outcome == UsageOutcome::Correct && event.confidence >= MIN_CONFIDENCE
        })
        .map(|event| event.session_id)
        .collect::<HashSet<_>>()
        .len();

    if current_status == LearningStatus::Archived {
        return ProjectedMastery {
            status: LearningStatus::Archived,
            streak: 0,
            lifetime_distinct_sessions,
            interval_days: current_interval_days,
            next_review_at: current_next_review_at,
        };
    }

    let mut sorted_events: Vec<&UsageEventRecord> = events.iter().collect();
    sorted_events.sort_by_key(|e| (e.original_turn_time, e.id));

    let latest_relapse = sorted_events.iter().rev().find(|e| {
        (e.outcome == UsageOutcome::Incorrect && e.confidence >= MIN_CONFIDENCE)
            || e.origin == "feedback"
    });

    // Collapse retries and duplicate evidence within one session before assigning days.
    // Otherwise a later duplicate from one session could consume the day of a new session.
    let mut first_success_by_session = std::collections::BTreeMap::new();
    for event in &sorted_events {
        if event.outcome != UsageOutcome::Correct || event.confidence < MIN_CONFIDENCE {
            continue;
        }
        if let Some(relapse) = latest_relapse {
            if event.original_turn_time <= relapse.original_turn_time
                || event.session_id == relapse.session_id
            {
                continue;
            }
        }
        first_success_by_session
            .entry(event.session_id)
            .or_insert(event.original_turn_time);
    }

    let mut session_successes: Vec<(u64, i64)> = first_success_by_session.into_iter().collect();
    session_successes.sort_by_key(|(_, time)| *time);
    let mut qualifying_sessions = Vec::new();
    let mut seen_days = HashSet::new();
    for (session_id, time) in session_successes {
        let day = time / MS_PER_DAY;
        if seen_days.insert(day) {
            qualifying_sessions.push((session_id, time));
        }
    }

    let streak = qualifying_sessions.len();

    if let Some(relapse) = latest_relapse {
        if streak == 0 {
            return ProjectedMastery {
                status: LearningStatus::Learning,
                streak: 0,
                lifetime_distinct_sessions,
                interval_days: 1,
                next_review_at: relapse.original_turn_time,
            };
        }
        return ProjectedMastery {
            status: if satisfies_stable_rule(&qualifying_sessions) {
                LearningStatus::Stable
            } else if streak >= 2 {
                LearningStatus::Improving
            } else {
                LearningStatus::Learning
            },
            streak,
            lifetime_distinct_sessions,
            interval_days: 1,
            next_review_at: relapse.original_turn_time,
        };
    }

    let status = if current_status == LearningStatus::Stable
        || satisfies_stable_rule(&qualifying_sessions)
    {
        LearningStatus::Stable
    } else if current_status == LearningStatus::Improving || streak >= 2 {
        LearningStatus::Improving
    } else if streak >= 1 || current_status == LearningStatus::Learning {
        LearningStatus::Learning
    } else {
        LearningStatus::New
    };

    ProjectedMastery {
        status,
        streak,
        lifetime_distinct_sessions,
        interval_days: current_interval_days,
        next_review_at: current_next_review_at,
    }
}

fn satisfies_stable_rule(qualifying_sessions: &[(u64, i64)]) -> bool {
    if qualifying_sessions.len() < STABLE_REQUIRED_SESSIONS {
        return false;
    }
    let first_time = qualifying_sessions[0].1;
    let last_time = qualifying_sessions
        .last()
        .map(|(_, t)| *t)
        .unwrap_or(first_time);

    if last_time - first_time < STABLE_REQUIRED_DAYS * MS_PER_DAY {
        return false;
    }

    let mut weekly_buckets = HashSet::new();
    for (_, time) in qualifying_sessions {
        let bucket = (time - first_time) / (7 * MS_PER_DAY);
        weekly_buckets.insert(bucket);
    }

    weekly_buckets.len() >= STABLE_REQUIRED_BUCKETS
}
