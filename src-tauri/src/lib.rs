mod audio;

use tauri::Manager;

#[tauri::command]
async fn transcribe_audio(
    app: tauri::AppHandle,
    request: tauri::ipc::Request<'_>,
) -> Result<audio::Transcript, String> {
    let wav = match request.body() {
        tauri::ipc::InvokeBody::Raw(bytes) => bytes.clone(),
        _ => return Err("Expected raw WAV audio bytes.".into()),
    };
    let app_data = app
        .path()
        .app_data_dir()
        .map_err(|_| "Cannot locate application data directory.".to_string())?;
    tauri::async_runtime::spawn_blocking(move || audio::transcribe(wav, app_data))
        .await
        .map_err(|_| "Local transcription task failed. Please retry.".to_string())?
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![transcribe_audio])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
