use super::VoiceService;
use crate::core::IpcError;

#[tauri::command]
pub async fn prewarm_natural_voice(
    service: tauri::State<'_, VoiceService>,
) -> Result<bool, IpcError> {
    let service = service.inner().clone();
    tauri::async_runtime::spawn_blocking(move || service.prewarm())
        .await
        .map_err(IpcError::task_failed("Local voice could not start."))?
        .map_err(IpcError::from)
}

#[tauri::command(rename_all = "snake_case")]
pub async fn synthesize_natural_voice(
    service: tauri::State<'_, VoiceService>,
    text: String,
    voice_id: u32,
    speed: f32,
) -> Result<tauri::ipc::Response, IpcError> {
    let service = service.inner().clone();
    tauri::async_runtime::spawn_blocking(move || service.synthesize(&text, voice_id, speed))
        .await
        .map_err(IpcError::task_failed(
            "Local voice could not play. Use the system voice or try again.",
        ))?
        .map_err(IpcError::from)
        .map(tauri::ipc::Response::new)
}
