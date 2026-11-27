use serde::Serialize;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, ts_rs::TS)]
#[ts(export)]
pub struct RecurringMistake {
    pub original: String,
    pub improved: String,
    pub explanation: String,
    pub times: usize,
}
