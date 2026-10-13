use super::{domain::SetupDiagnostics, error::SetupError, service};
use crate::core::IpcError;
use crate::speech_recognition::SpeechRecognitionService;
use tauri::Manager;

#[tauri::command]
pub async fn get_setup_diagnostics(
    app: tauri::AppHandle,
    speech: tauri::State<'_, SpeechRecognitionService>,
) -> Result<SetupDiagnostics, IpcError> {
    let app_data = app
        .path()
        .app_data_dir()
        .map_err(|_| IpcError::from(SetupError::DataDirectoryUnavailable))?;
    let model_file = speech.settings().map_err(IpcError::from)?.model_file;
    let model = speech.model_path(&model_file);
    let server = speech.server_status();
    tauri::async_runtime::spawn_blocking(move || service::collect(&app_data, &model, &server))
        .await
        .map_err(IpcError::task_failed("Setup diagnostics task failed."))
}
