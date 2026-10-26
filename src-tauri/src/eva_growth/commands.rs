use super::{domain::EvaGrowth, EvaGrowthService};
use crate::core::IpcError;

#[tauri::command]
pub async fn get_eva_growth(
    service: tauri::State<'_, EvaGrowthService>,
) -> Result<EvaGrowth, IpcError> {
    let service = service.inner().clone();
    tauri::async_runtime::spawn_blocking(move || service.growth())
        .await
        .map_err(IpcError::task_failed("Could not read Eva's growth."))?
        .map_err(IpcError::from)
}
