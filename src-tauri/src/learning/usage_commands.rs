use super::commands::run_blocking;
use super::{TurnUsageAssessment, UsageReviewService};
use crate::core::IpcError;
use crate::providers::review_turn_usage;

#[tauri::command(rename_all = "snake_case")]
pub async fn review_practice_memory_usage(
    service: tauri::State<'_, UsageReviewService>,
    session_id: u64,
    sequence: usize,
) -> Result<TurnUsageAssessment, IpcError> {
    run_blocking(
        service,
        "The usage review task failed. Please retry.",
        move |service| service.review(session_id, sequence, review_turn_usage),
    )
    .await
}

#[tauri::command(rename_all = "snake_case")]
pub async fn get_practice_memory_usage(
    service: tauri::State<'_, UsageReviewService>,
    session_id: u64,
    sequence: usize,
) -> Result<Option<TurnUsageAssessment>, IpcError> {
    run_blocking(
        service,
        "Could not restore this saved review.",
        move |service| service.saved(session_id, sequence),
    )
    .await
}
