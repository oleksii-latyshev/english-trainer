mod audio;

use tauri::Manager;

#[tauri::command]
async fn transcribe_audio(
    app: tauri::AppHandle,
    request: tauri::ipc::Request<'_>,
) -> Result<audio::Transcript, audio::TranscriptionError> {
    let wav = match request.body() {
        tauri::ipc::InvokeBody::Raw(bytes) => bytes.clone(),
        _ => {
            return Err(audio::TranscriptionError::new(
                audio::TranscriptionErrorCode::InvalidAudio,
                "Expected raw WAV audio bytes. Please record again.",
            ))
        }
    };
    let app_data = app.path().app_data_dir().map_err(|_| {
        audio::TranscriptionError::new(
            audio::TranscriptionErrorCode::IoFailure,
            "Cannot locate application data directory. Please restart the app and retry.",
        )
    })?;
    tauri::async_runtime::spawn_blocking(move || audio::transcribe(wav, app_data))
        .await
        .map_err(|_| {
            audio::TranscriptionError::new(
                audio::TranscriptionErrorCode::EngineFailed,
                "Local transcription task failed. Please retry.",
            )
        })?
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![transcribe_audio])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
