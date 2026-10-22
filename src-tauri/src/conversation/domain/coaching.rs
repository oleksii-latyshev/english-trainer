use crate::providers::TurnFeedback;
use serde::Serialize;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(tag = "state", rename_all = "snake_case")]
pub enum TurnCoaching {
    Pending,
    Paused,
    Failed,
    Ready { feedback: TurnFeedback },
}
