use super::{
    LearningError, LearningItemType, LearningMemoryView, LearningService, MemoryUsageEvidence,
    PhraseCardRecord,
};
use crate::core::IpcError;

pub(super) async fn run_blocking<S: Clone + Send + Sync + 'static, T: Send + 'static>(
    service: tauri::State<'_, S>,
    failure: &'static str,
    work: impl FnOnce(S) -> Result<T, LearningError> + Send + 'static,
) -> Result<T, IpcError> {
    let service = service.inner().clone();
    tauri::async_runtime::spawn_blocking(move || work(service))
        .await
        .map_err(IpcError::task_failed(failure))?
        .map_err(IpcError::from)
}

#[tauri::command]
pub async fn get_learning_memory(
    service: tauri::State<'_, LearningService>,
) -> Result<LearningMemoryView, IpcError> {
    run_blocking(service, "Could not read your Memory.", |service| {
        service.memory()
    })
    .await
}

#[tauri::command]
pub async fn view_learning_memory(
    service: tauri::State<'_, LearningService>,
) -> Result<LearningMemoryView, IpcError> {
    run_blocking(service, "Could not read your Memory.", |service| {
        service.open_memory()
    })
    .await
}

#[tauri::command(rename_all = "snake_case")]
pub async fn save_phrase_card(
    service: tauri::State<'_, LearningService>,
    phrase: String,
    meaning_or_note: Option<String>,
    session_id: Option<u64>,
    sequence: Option<usize>,
) -> Result<PhraseCardRecord, IpcError> {
    run_blocking(service, "Could not save the phrase.", move |service| {
        service.save_phrase(
            &phrase,
            &meaning_or_note.unwrap_or_default(),
            session_id,
            sequence,
        )
    })
    .await
}

#[tauri::command(rename_all = "snake_case")]
pub async fn delete_phrase_card(
    service: tauri::State<'_, LearningService>,
    phrase_id: u64,
) -> Result<bool, IpcError> {
    run_blocking(service, "Could not remove the phrase.", move |service| {
        service.delete_phrase(phrase_id)
    })
    .await
}

#[tauri::command(rename_all = "snake_case")]
pub async fn delete_mistake(
    service: tauri::State<'_, LearningService>,
    mistake_id: u64,
) -> Result<bool, IpcError> {
    run_blocking(service, "Could not remove the mistake.", move |service| {
        service.delete_mistake(mistake_id)
    })
    .await
}

#[tauri::command(rename_all = "snake_case")]
pub async fn archive_learning_item(
    service: tauri::State<'_, LearningService>,
    item_type: LearningItemType,
    item_id: u64,
) -> Result<bool, IpcError> {
    run_blocking(service, "Could not archive the item.", move |service| {
        service.archive(item_type, item_id)
    })
    .await
}

#[tauri::command(rename_all = "snake_case")]
pub async fn get_memory_usage_evidence(
    service: tauri::State<'_, LearningService>,
    item_type: LearningItemType,
    item_id: u64,
) -> Result<MemoryUsageEvidence, IpcError> {
    run_blocking(
        service,
        "Could not read the usage evidence.",
        move |service| service.usage_evidence(item_type, item_id),
    )
    .await
}
