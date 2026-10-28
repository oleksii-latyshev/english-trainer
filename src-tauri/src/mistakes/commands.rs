use super::domain::rules::RuleKey;
use super::domain::view::{MistakeDetail, MistakeGroups, RuleCardView};
use super::MistakesService;
use crate::core::IpcError;

#[tauri::command]
pub async fn list_mistake_groups(
    service: tauri::State<'_, MistakesService>,
) -> Result<MistakeGroups, IpcError> {
    let service = service.inner().clone();
    tauri::async_runtime::spawn_blocking(move || service.groups())
        .await
        .map_err(IpcError::task_failed("Could not read your mistakes."))?
        .map_err(IpcError::from)
}

#[tauri::command]
pub async fn get_mistake(
    service: tauri::State<'_, MistakesService>,
    id: u64,
) -> Result<MistakeDetail, IpcError> {
    let service = service.inner().clone();
    tauri::async_runtime::spawn_blocking(move || service.mistake(id))
        .await
        .map_err(IpcError::task_failed("Could not read that mistake."))?
        .map_err(IpcError::from)
}

#[tauri::command]
pub async fn get_rule_card(
    service: tauri::State<'_, MistakesService>,
    rule_key: RuleKey,
) -> Result<RuleCardView, IpcError> {
    let service = service.inner().clone();
    tauri::async_runtime::spawn_blocking(move || service.rule_card(rule_key))
        .await
        .map_err(IpcError::task_failed("Could not read that rule."))?
        .map_err(IpcError::from)
}

#[tauri::command]
pub async fn archive_mistake(
    service: tauri::State<'_, MistakesService>,
    id: u64,
) -> Result<(), IpcError> {
    let service = service.inner().clone();
    tauri::async_runtime::spawn_blocking(move || service.archive(id))
        .await
        .map_err(IpcError::task_failed("Could not archive that mistake."))?
        .map_err(IpcError::from)
}

#[tauri::command]
pub async fn retry_mistake_lesson(
    service: tauri::State<'_, MistakesService>,
    id: u64,
) -> Result<(), IpcError> {
    let service = service.inner().clone();
    tauri::async_runtime::spawn_blocking(move || service.retry_lesson(id))
        .await
        .map_err(IpcError::task_failed("Could not retry that lesson."))?
        .map_err(IpcError::from)
}
