use super::commands::run_blocking;
use super::review_material::ReviewMaterials;
use super::{LearningItemType, MemoryRecallResult, MemoryReviewRun, ReviewService};
use crate::core::IpcError;
use crate::providers::generate_review_material;

#[tauri::command(rename_all = "snake_case")]
pub async fn start_memory_review(
    service: tauri::State<'_, ReviewService>,
    warmup: Option<bool>,
) -> Result<Option<MemoryReviewRun>, IpcError> {
    run_blocking(service, "Could not start the review.", move |service| {
        service.start(warmup.unwrap_or(false))
    })
    .await
}

#[tauri::command(rename_all = "snake_case")]
pub async fn start_item_review(
    service: tauri::State<'_, ReviewService>,
    item_type: LearningItemType,
    item_id: u64,
) -> Result<Option<MemoryReviewRun>, IpcError> {
    run_blocking(service, "Could not start the review.", move |service| {
        service.start_item(item_type, item_id)
    })
    .await
}

#[tauri::command(rename_all = "snake_case")]
pub async fn get_memory_review(
    service: tauri::State<'_, ReviewService>,
) -> Result<Option<MemoryReviewRun>, IpcError> {
    run_blocking(service, "Could not read the review.", |service| {
        service.active()
    })
    .await
}

#[tauri::command(rename_all = "snake_case")]
pub async fn submit_memory_recall(
    service: tauri::State<'_, ReviewService>,
    run_id: u64,
    item_type: LearningItemType,
    item_id: u64,
    transcript: String,
) -> Result<MemoryRecallResult, IpcError> {
    run_blocking(service, "Could not save your answer.", move |service| {
        service.submit_recall(run_id, item_type, item_id, &transcript)
    })
    .await
}

#[tauri::command(rename_all = "snake_case")]
pub async fn skip_memory_review_item(
    service: tauri::State<'_, ReviewService>,
    run_id: u64,
    item_type: LearningItemType,
    item_id: u64,
) -> Result<MemoryReviewRun, IpcError> {
    run_blocking(service, "Could not skip this item.", move |service| {
        service.skip(run_id, item_type, item_id)
    })
    .await
}

#[tauri::command(rename_all = "snake_case")]
pub async fn finish_memory_review(
    service: tauri::State<'_, ReviewService>,
    run_id: u64,
) -> Result<(), IpcError> {
    run_blocking(service, "Could not finish the review.", move |service| {
        service.finish(run_id)
    })
    .await
}

#[tauri::command(rename_all = "snake_case")]
pub async fn get_review_material(
    service: tauri::State<'_, ReviewService>,
    run_id: u64,
) -> Result<ReviewMaterials, IpcError> {
    run_blocking(
        service,
        "Could not read the review situations.",
        move |service| service.materials(run_id),
    )
    .await
}

#[tauri::command(rename_all = "snake_case")]
pub async fn prepare_review_material(
    service: tauri::State<'_, ReviewService>,
    run_id: u64,
    retry: Option<bool>,
) -> Result<ReviewMaterials, IpcError> {
    run_blocking(
        service,
        "Could not prepare review situations. Please retry.",
        move |service| {
            service.prepare_materials(run_id, retry.unwrap_or(false), generate_review_material)
        },
    )
    .await
}

#[tauri::command(rename_all = "snake_case")]
pub async fn reveal_review_phrase(
    service: tauri::State<'_, ReviewService>,
    run_id: u64,
    position: usize,
) -> Result<ReviewMaterials, IpcError> {
    run_blocking(service, "Could not show the phrase.", move |service| {
        service.reveal_phrase(run_id, position)
    })
    .await
}
