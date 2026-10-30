use super::{domain::DiagnosticEvent, Diagnostics};
use crate::core::IpcError;

#[tauri::command]
pub async fn record_diagnostic_event(
    diagnostics: tauri::State<'_, Diagnostics>,
    event: DiagnosticEvent,
) -> Result<(), IpcError> {
    let diagnostics = diagnostics.inner().clone();
    tauri::async_runtime::spawn_blocking(move || diagnostics.record_event(&event))
        .await
        .map_err(IpcError::task_failed(
            "Could not write the diagnostics log.",
        ))
}
