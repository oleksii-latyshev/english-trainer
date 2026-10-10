use super::{models::model_path, SpeechEngine};
use crate::{
    conversation::SessionStore,
    providers::{ProviderError, ProviderErrorCode},
};
use std::sync::Arc;
use tauri::Manager;

/// An explicit short snapshot uses the loaded local model even when the live transcript is off.
/// No final-transcription state or audio-retention setting is touched.
#[tauri::command]
pub(crate) async fn transcribe_rescue(
    app: tauri::AppHandle,
    sessions: tauri::State<'_, SessionStore>,
    engine: tauri::State<'_, Arc<SpeechEngine>>,
    request: tauri::ipc::Request<'_>,
) -> Result<String, ProviderError> {
    let session_id = header(&request, "x-session-id")?;
    let sequence =
        usize::try_from(header(&request, "x-answer-sequence")?).map_err(|_| invalid())?;
    let question = sessions.rescue_question(session_id, sequence, None)?;
    let wav = match request.body() {
        tauri::ipc::InvokeBody::Raw(bytes) if bytes.len() <= 1_000_044 => bytes.clone(),
        _ => return Err(invalid()),
    };
    super::validate_wav(&wav).map_err(|_| invalid())?;
    let app_data = app.path().app_data_dir().map_err(|_| unavailable())?;
    let settings = sessions.speech_settings()?.resolved(&app_data);
    let model = model_path(&app_data, &settings.model_file);
    let prompt = super::commands::prompt_for_current_answer(&sessions);
    let engine = Arc::clone(&engine);
    let text = tauri::async_runtime::spawn_blocking(move || {
        engine.transcribe_rescue(&model, &wav, prompt.as_deref())
    })
    .await
    .map_err(|_| unavailable())?
    .ok_or_else(unavailable)?;
    sessions.rescue_question(session_id, sequence, Some(&question))?;
    if text.trim().is_empty() {
        return Err(ProviderError::new(
            ProviderErrorCode::InvalidOutput,
            "No speech was recognized yet. Say a few words and try Stuck again.",
        ));
    }
    Ok(text)
}
fn header(request: &tauri::ipc::Request<'_>, name: &str) -> Result<u64, ProviderError> {
    request
        .headers()
        .get(name)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.parse().ok())
        .filter(|value| *value > 0)
        .ok_or_else(invalid)
}
fn invalid() -> ProviderError {
    ProviderError::new(
        ProviderErrorCode::InvalidRequest,
        "The rescue audio snapshot could not be read. Keep speaking and try Stuck again.",
    )
}
fn unavailable() -> ProviderError {
    ProviderError::new(
        ProviderErrorCode::Unavailable,
        "Speech recognition is busy or not ready. Wait briefly, keep speaking and retry Stuck.",
    )
}
