use super::{GeminiKeyStatus, KeyService};
use crate::core::IpcError;

#[tauri::command]
pub async fn get_gemini_key_status(
    service: tauri::State<'_, KeyService>,
) -> Result<GeminiKeyStatus, IpcError> {
    let service = service.inner().clone();
    tauri::async_runtime::spawn_blocking(move || service.status())
        .await
        .map_err(IpcError::task_failed(
            "Could not read the Gemini key status.",
        ))?
        .map_err(IpcError::from)
}

#[tauri::command]
pub async fn save_gemini_api_key(
    service: tauri::State<'_, KeyService>,
    key: String,
) -> Result<(), IpcError> {
    let service = service.inner().clone();
    tauri::async_runtime::spawn_blocking(move || service.save(&key))
        .await
        .map_err(IpcError::task_failed("Could not save the Gemini API key."))?
        .map_err(IpcError::from)
}

#[tauri::command]
pub async fn delete_gemini_api_key(service: tauri::State<'_, KeyService>) -> Result<(), IpcError> {
    let service = service.inner().clone();
    tauri::async_runtime::spawn_blocking(move || service.remove())
        .await
        .map_err(IpcError::task_failed(
            "Could not remove the Gemini API key.",
        ))?
        .map_err(IpcError::from)
}
