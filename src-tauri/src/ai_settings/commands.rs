use super::{AiSettings, AiSettingsService};
use crate::core::IpcError;

#[tauri::command]
pub async fn get_ai_settings(
    service: tauri::State<'_, AiSettingsService>,
) -> Result<AiSettings, IpcError> {
    let service = service.inner().clone();
    tauri::async_runtime::spawn_blocking(move || service.get())
        .await
        .map_err(IpcError::task_failed(
            "Could not read the conversation settings.",
        ))?
        .map_err(IpcError::from)
}

#[tauri::command]
pub async fn save_ai_settings(
    service: tauri::State<'_, AiSettingsService>,
    settings: AiSettings,
) -> Result<AiSettings, IpcError> {
    let service = service.inner().clone();
    tauri::async_runtime::spawn_blocking(move || service.save(settings))
        .await
        .map_err(IpcError::task_failed(
            "Could not save the conversation settings.",
        ))?
        .map_err(IpcError::from)
}

#[tauri::command]
pub async fn prewarm_conversation_provider(
    service: tauri::State<'_, AiSettingsService>,
) -> Result<(), IpcError> {
    let service = service.inner().clone();
    tauri::async_runtime::spawn_blocking(move || service.prewarm())
        .await
        .map_err(IpcError::task_failed("Provider warm-up failed."))?
        .map_err(IpcError::from)
}
