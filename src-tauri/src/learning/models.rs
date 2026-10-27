use super::phrase_kind::PhraseKind;
use crate::providers::FocusCategory;
use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "snake_case")]
#[ts(export)]
pub enum LearningStatus {
    New,
    Learning,
    Improving,
    Stable,
    Archived,
}

impl LearningStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::New => "new",
            Self::Learning => "learning",
            Self::Improving => "improving",
            Self::Stable => "stable",
            Self::Archived => "archived",
        }
    }

    pub fn parse(value: &str) -> Option<Self> {
        match value {
            "new" => Some(Self::New),
            "learning" => Some(Self::Learning),
            "improving" => Some(Self::Improving),
            "stable" => Some(Self::Stable),
            "archived" => Some(Self::Archived),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "snake_case")]
#[ts(export)]
pub enum ReviewResponse {
    Remembered,
    NeedPractice,
}

impl ReviewResponse {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Remembered => "remembered",
            Self::NeedPractice => "need_practice",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, TS)]
#[serde(rename_all = "snake_case")]
#[ts(export)]
pub enum LearningItemType {
    Mistake,
    Phrase,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct MistakeRecord {
    pub id: u64,
    pub normalized_key: String,
    pub category: FocusCategory,
    pub original_example: String,
    pub corrected_example: String,
    pub explanation: String,
    pub times_seen: usize,
    pub times_correct_afterwards: usize,
    pub last_seen_at: i64,
    pub last_reviewed_at: Option<i64>,
    pub next_review_at: i64,
    pub interval_days: u32,
    pub ease_factor: f64,
    pub status: LearningStatus,
    pub is_due: bool,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct PhraseCardRecord {
    pub id: u64,
    pub phrase: String,
    pub kind: PhraseKind,
    pub normalized_phrase: String,
    pub meaning_or_note: String,
    pub session_id: Option<u64>,
    pub sequence: Option<usize>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub session_topic: Option<String>,
    pub created_at: i64,
    pub last_reviewed_at: Option<i64>,
    pub next_review_at: i64,
    pub interval_days: u32,
    pub ease_factor: f64,
    pub status: LearningStatus,
    pub is_due: bool,
    pub times_used_on_own: usize,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct LearningMemoryView {
    pub mistakes: Vec<MistakeRecord>,
    pub phrase_cards: Vec<PhraseCardRecord>,
    pub due_count: usize,
}
