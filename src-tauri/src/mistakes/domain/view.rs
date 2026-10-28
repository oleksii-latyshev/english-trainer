use super::lesson::{ContrastLine, LessonWord};
use super::rules::RuleKey;
use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "snake_case")]
#[ts(export)]
pub enum LessonState {
    Pending,
    Ready,
    Failed,
}

impl LessonState {
    pub fn parse(text: &str) -> Self {
        match text {
            "ready" => Self::Ready,
            "failed" => Self::Failed,
            _ => Self::Pending,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct MistakeSummary {
    pub id: u64,
    pub said: String,
    pub corrected: String,
    pub rule_key: Option<RuleKey>,
    pub lesson_state: LessonState,
    pub ladder_step: u8,
    pub is_fixed: bool,
    pub is_due: bool,
    pub last_seen_at: i64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct MistakeGroup {
    pub rule_key: RuleKey,
    pub title: String,
    pub summary: String,
    pub mistake_count: u32,
    pub fixed_count: u32,
    pub due_count: u32,
    pub relapse_count: u32,
    pub last_relapse_at: Option<i64>,
    pub mistakes: Vec<MistakeSummary>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct MistakeGroups {
    pub groups: Vec<MistakeGroup>,
    pub ungrouped: Vec<MistakeSummary>,
    pub due_count: u32,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct LessonView {
    pub explanation: String,
    pub contrast: Vec<ContrastLine>,
    pub examples: Vec<String>,
    pub word: Option<LessonWord>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct MistakeRule {
    pub rule_key: RuleKey,
    pub title: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct MistakeDetail {
    pub id: u64,
    pub question: String,
    pub said: String,
    pub corrected: String,
    pub review_explanation: String,
    pub session_id: Option<u64>,
    pub sequence: Option<u64>,
    pub last_seen_at: i64,
    pub ladder_step: u8,
    pub fixed_at: Option<i64>,
    pub next_review_at: i64,
    pub is_due: bool,
    pub rule: Option<MistakeRule>,
    pub lesson_state: LessonState,
    pub lesson: Option<LessonView>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct RuleCardView {
    pub rule_key: RuleKey,
    pub title: String,
    pub summary: String,
    pub body: Option<String>,
    pub examples: Vec<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, TS)]
#[ts(export)]
pub struct MistakesUpdated {
    pub lessons_ready: u32,
}
