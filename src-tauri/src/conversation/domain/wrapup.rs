use serde::Serialize;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, ts_rs::TS)]
#[ts(export)]
pub struct RecurringMistake {
    pub original: String,
    pub improved: String,
    pub explanation: String,
    pub times: usize,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, ts_rs::TS)]
#[ts(export)]
pub struct FinishedSessionItem {
    pub session_id: u64,
    pub ended_at: i64,
    pub title: String,
    pub answer_count: usize,
    pub focus_rule_title: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, ts_rs::TS)]
#[ts(export)]
pub struct FinishedSessionPage {
    pub sessions: Vec<FinishedSessionItem>,
    pub has_more: bool,
}
