use super::{SpeakingActivity, SpeakingActivityService};
use crate::core::IpcError;

#[tauri::command]
pub async fn get_speaking_activity(
    service: tauri::State<'_, SpeakingActivityService>,
) -> Result<SpeakingActivity, IpcError> {
    let service = service.inner().clone();
    tauri::async_runtime::spawn_blocking(move || service.overview())
        .await
        .map_err(IpcError::task_failed(
            "Could not read your speaking activity.",
        ))?
        .map_err(IpcError::from)
}
