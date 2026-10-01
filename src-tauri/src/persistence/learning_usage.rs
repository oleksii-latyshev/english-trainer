#[derive(Debug, Clone)]
pub(crate) struct PreparedUsageReview {
    pub(crate) request: crate::providers::UsageReviewRequest,
    pub(crate) turn_time: i64,
    pub(crate) is_conversation: bool,
}

pub(crate) struct UsageAssessmentCommit<'a> {
    pub(crate) session_id: u64,
    pub(crate) sequence: usize,
    pub(crate) request: &'a crate::providers::UsageReviewRequest,
    pub(crate) turn_time: i64,
    pub(crate) assessment: crate::learning::TurnUsageAssessment,
    pub(crate) events: &'a [crate::learning::UsageEventRecord],
    pub(crate) active_session_id: Option<u64>,
}

mod candidates;
mod ledger;
mod read;
mod write;
pub(crate) use ledger::{counter_baseline, load_item_events};
pub(crate) use read::prepare_usage_review_on;
