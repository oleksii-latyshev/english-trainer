use super::{
    domain::{
        KeptRecordings, SpeechCheckProgress, SpeechCheckResults, SpeechCheckStatus,
        SpeechEngineStatus, SpeechModels, SpeechSettings, Transcript,
    },
    error::SpeechRecognitionError,
    ports::PortResult,
    SpeechRecognitionService,
};
use crate::core::IpcError;

const TASK_FAILED: &str = "Local speech recognition task failed. Please retry.";

async fn blocking<T: Send + 'static>(
    work: impl FnOnce() -> PortResult<T> + Send + 'static,
) -> Result<T, IpcError> {
    tauri::async_runtime::spawn_blocking(work)
        .await
        .map_err(IpcError::task_failed(TASK_FAILED))?
        .map_err(IpcError::from)
}

fn raw_body(request: &tauri::ipc::Request<'_>) -> PortResult<Vec<u8>> {
    match request.body() {
        tauri::ipc::InvokeBody::Raw(bytes) => Ok(bytes.clone()),
        _ => Err(SpeechRecognitionError::expected_raw_audio()),
    }
}

fn positive_header(request: &tauri::ipc::Request<'_>, name: &str) -> Option<u64> {
    request
        .headers()
        .get(name)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.parse().ok())
        .filter(|value| *value > 0)
}

#[tauri::command]
pub async fn transcribe_audio(
    service: tauri::State<'_, SpeechRecognitionService>,
    request: tauri::ipc::Request<'_>,
) -> Result<Transcript, IpcError> {
    let service = service.inner().clone();
    let wav = raw_body(&request).map_err(IpcError::from)?;
    blocking(move || service.transcribe(wav)).await
}

#[tauri::command]
pub async fn transcribe_partial(
    service: tauri::State<'_, SpeechRecognitionService>,
    request: tauri::ipc::Request<'_>,
) -> Result<Option<String>, IpcError> {
    let service = service.inner().clone();
    let wav = raw_body(&request).map_err(IpcError::from)?;
    blocking(move || service.transcribe_partial(&wav)).await
}

#[tauri::command]
pub async fn transcribe_rescue(
    service: tauri::State<'_, SpeechRecognitionService>,
    request: tauri::ipc::Request<'_>,
) -> Result<String, IpcError> {
    let service = service.inner().clone();
    let invalid = || IpcError::from(SpeechRecognitionError::unreadable_rescue_snapshot());
    let session_id = positive_header(&request, "x-session-id").ok_or_else(invalid)?;
    let sequence = positive_header(&request, "x-answer-sequence")
        .and_then(|value| usize::try_from(value).ok())
        .ok_or_else(invalid)?;
    let wav = raw_body(&request).map_err(|_| invalid())?;
    blocking(move || service.transcribe_rescue(session_id, sequence, &wav)).await
}

#[tauri::command]
pub async fn get_speech_settings(
    service: tauri::State<'_, SpeechRecognitionService>,
) -> Result<SpeechSettings, IpcError> {
    let service = service.inner().clone();
    blocking(move || service.settings()).await
}

fn warm_in_background(service: SpeechRecognitionService) {
    tauri::async_runtime::spawn_blocking(move || service.warm());
}

#[tauri::command(rename_all = "snake_case")]
pub async fn save_speech_model(
    service: tauri::State<'_, SpeechRecognitionService>,
    model_file: String,
) -> Result<SpeechSettings, IpcError> {
    let service = service.inner().clone();
    let saving = service.clone();
    let settings = blocking(move || saving.save_model(model_file)).await?;
    warm_in_background(service);
    Ok(settings)
}

#[tauri::command(rename_all = "snake_case")]
pub async fn save_live_transcript(
    service: tauri::State<'_, SpeechRecognitionService>,
    live_transcript: bool,
) -> Result<SpeechSettings, IpcError> {
    let service = service.inner().clone();
    blocking(move || service.save_live_transcript(live_transcript)).await
}

#[tauri::command]
pub async fn warm_speech_engine(
    service: tauri::State<'_, SpeechRecognitionService>,
) -> Result<(), IpcError> {
    warm_in_background(service.inner().clone());
    Ok(())
}

#[tauri::command]
pub async fn get_speech_engine_status(
    service: tauri::State<'_, SpeechRecognitionService>,
) -> Result<SpeechEngineStatus, IpcError> {
    let service = service.inner().clone();
    blocking(move || service.engine_status()).await
}

#[tauri::command(rename_all = "snake_case")]
pub async fn save_keep_raw_audio(
    service: tauri::State<'_, SpeechRecognitionService>,
    keep_raw_audio: bool,
) -> Result<SpeechSettings, IpcError> {
    let service = service.inner().clone();
    blocking(move || service.save_keep_raw_audio(keep_raw_audio)).await
}

#[tauri::command]
pub async fn list_speech_models(
    service: tauri::State<'_, SpeechRecognitionService>,
) -> Result<SpeechModels, IpcError> {
    let service = service.inner().clone();
    blocking(move || Ok(service.models())).await
}

#[tauri::command]
pub async fn get_glossary(
    service: tauri::State<'_, SpeechRecognitionService>,
) -> Result<Vec<String>, IpcError> {
    let service = service.inner().clone();
    blocking(move || service.glossary()).await
}

#[tauri::command]
pub async fn save_glossary(
    service: tauri::State<'_, SpeechRecognitionService>,
    terms: Vec<String>,
) -> Result<Vec<String>, IpcError> {
    let service = service.inner().clone();
    blocking(move || service.save_glossary(&terms)).await
}

#[tauri::command]
pub async fn get_kept_recordings(
    service: tauri::State<'_, SpeechRecognitionService>,
) -> Result<KeptRecordings, IpcError> {
    let service = service.inner().clone();
    blocking(move || service.kept_recordings()).await
}

#[tauri::command]
pub async fn delete_kept_recordings(
    service: tauri::State<'_, SpeechRecognitionService>,
) -> Result<KeptRecordings, IpcError> {
    let service = service.inner().clone();
    blocking(move || service.delete_kept_recordings()).await
}

#[tauri::command]
pub async fn get_speech_check(
    service: tauri::State<'_, SpeechRecognitionService>,
) -> Result<SpeechCheckStatus, IpcError> {
    let service = service.inner().clone();
    blocking(move || Ok(service.speech_check())).await
}

#[tauri::command]
pub async fn save_speech_check_recording(
    service: tauri::State<'_, SpeechRecognitionService>,
    request: tauri::ipc::Request<'_>,
) -> Result<SpeechCheckStatus, IpcError> {
    let service = service.inner().clone();
    let index = positive_header(&request, "x-sentence-index")
        .and_then(|value| u32::try_from(value).ok())
        .ok_or_else(|| IpcError::from(SpeechRecognitionError::missing_sentence_number()))?;
    let wav = raw_body(&request).map_err(IpcError::from)?;
    blocking(move || service.save_speech_check_recording(index, &wav)).await
}

#[tauri::command]
pub async fn delete_speech_check_recordings(
    service: tauri::State<'_, SpeechRecognitionService>,
) -> Result<SpeechCheckStatus, IpcError> {
    let service = service.inner().clone();
    blocking(move || service.delete_speech_check_recordings()).await
}

#[tauri::command(rename_all = "snake_case")]
pub async fn run_speech_check(
    service: tauri::State<'_, SpeechRecognitionService>,
    model_files: Vec<String>,
    include_prompt: bool,
    on_progress: tauri::ipc::Channel<SpeechCheckProgress>,
) -> Result<SpeechCheckResults, IpcError> {
    let service = service.inner().clone();
    blocking(move || {
        service.run_speech_check(&model_files, include_prompt, |step| {
            report_progress(&on_progress, step)
        })
    })
    .await
}

fn report_progress(channel: &tauri::ipc::Channel<SpeechCheckProgress>, step: SpeechCheckProgress) {
    if channel.send(step).is_err() {
        eprintln!("The speech check window closed; the measurement still finishes.");
    }
}
