use crate::providers::TurnFeedback;
use serde::Serialize;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, ts_rs::TS)]
#[serde(tag = "state", rename_all = "snake_case")]
#[ts(export)]
pub enum TurnCoaching {
    Pending,
    Paused,
    Failed,
    Ready { feedback: TurnFeedback },
}
