use super::{ApiUsageOverview, ApiUsageService};
use crate::core::IpcError;

#[tauri::command]
pub async fn get_api_usage(
    service: tauri::State<'_, ApiUsageService>,
) -> Result<ApiUsageOverview, IpcError> {
    let service = service.inner().clone();
    tauri::async_runtime::spawn_blocking(move || service.overview())
        .await
        .map_err(IpcError::task_failed("Could not read the usage counts."))?
        .map_err(IpcError::from)
}
