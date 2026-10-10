//! IPC commands of speech recognition: transcription, models, the speech check, the glossary and
//! the answers kept on request.
use super::{
    answer_prompt,
    glossary::normalize_terms,
    is_light_model,
    kept::{self, KeptRecordings},
    models::{is_model_file_name, list_models, model_path, SpeechModel},
    require_binary,
    speech_check::{self, SpeechCheckProgress, SpeechCheckResults, SpeechCheckStatus},
    ServerState, SpeechEngine, SpeechSettings, Transcript, TranscriptionError,
    TranscriptionErrorCode,
};
use crate::conversation::SessionStore;
use crate::providers::{ProviderError, ProviderErrorCode};
use serde::Serialize;
use std::{
    path::PathBuf,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    },
};
use tauri::Manager;

fn app_data(app: &tauri::AppHandle) -> Result<PathBuf, TranscriptionError> {
    app.path().app_data_dir().map_err(|_| {
        TranscriptionError::new(
            TranscriptionErrorCode::IoFailure,
            "Cannot locate application data directory. Please restart the app and retry.",
        )
    })
}

fn provider_app_data(app: &tauri::AppHandle) -> Result<PathBuf, ProviderError> {
    app.path().app_data_dir().map_err(|_| {
        ProviderError::new(
            ProviderErrorCode::ProcessFailed,
            "Cannot locate application data directory. Please restart the app and retry.",
        )
    })
}

fn task_failed() -> TranscriptionError {
    TranscriptionError::new(
        TranscriptionErrorCode::EngineFailed,
        "Local transcription task failed. Please retry.",
    )
}

fn raw_body<'a>(request: &'a tauri::ipc::Request<'_>) -> Result<&'a [u8], TranscriptionError> {
    match request.body() {
        tauri::ipc::InvokeBody::Raw(bytes) => Ok(bytes),
        _ => Err(TranscriptionError::new(
            TranscriptionErrorCode::InvalidAudio,
            "Expected raw WAV audio bytes. Please record again.",
        )),
    }
}

fn settings_unreadable() -> TranscriptionError {
    TranscriptionError::new(
        TranscriptionErrorCode::IoFailure,
        "Cannot read the speech settings. Please restart the app and retry.",
    )
}

/// What Whisper is told before it hears the answer being recorded now: the question, names from
/// the last answers, and the glossary. A glossary that cannot be read costs accuracy, not the turn.
pub(super) fn prompt_for_current_answer(sessions: &SessionStore) -> Option<String> {
    let glossary = sessions.effective_glossary_terms().unwrap_or_default();
    let context = sessions.answer_context().unwrap_or_default();
    answer_prompt(&glossary, &context)
}

#[tauri::command]
pub(crate) async fn transcribe_audio(
    app: tauri::AppHandle,
    sessions: tauri::State<'_, SessionStore>,
    engine: tauri::State<'_, Arc<SpeechEngine>>,
    request: tauri::ipc::Request<'_>,
) -> Result<Transcript, TranscriptionError> {
    let wav = raw_body(&request)?.to_vec();
    let app_data = app_data(&app)?;
    let settings = sessions
        .speech_settings()
        .map_err(|_| settings_unreadable())?
        .resolved(&app_data);
    let prompt = prompt_for_current_answer(&sessions);
    let slot = sessions.next_turn_slot();
    let engine = Arc::clone(&engine);
    tauri::async_runtime::spawn_blocking(move || {
        if settings.keep_raw_audio {
            // Keeping is the learner's extra, so a full disk must not block the conversation.
            if let Err(error) = kept::keep(&app_data, slot, &wav) {
                eprintln!("Could not keep the recording: {error}");
            }
        }
        engine.transcribe(
            wav,
            &model_path(&app_data, &settings.model_file),
            prompt.as_deref(),
        )
    })
    .await
    .map_err(|_| task_failed())?
}

/// The words heard so far in the recording in progress (the WAV is the raw body), for the live
/// transcript. `None` means no update this time; the answer is still transcribed in full.
#[tauri::command]
pub(crate) async fn transcribe_partial(
    app: tauri::AppHandle,
    sessions: tauri::State<'_, SessionStore>,
    engine: tauri::State<'_, Arc<SpeechEngine>>,
    request: tauri::ipc::Request<'_>,
) -> Result<Option<String>, TranscriptionError> {
    let app_data = app_data(&app)?;
    let settings = sessions
        .speech_settings()
        .map_err(|_| settings_unreadable())?
        .resolved(&app_data);
    if !settings.live_transcript || !is_light_model(&settings.model_file) {
        return Ok(None);
    }
    let wav = raw_body(&request)?.to_vec();
    let prompt = prompt_for_current_answer(&sessions);
    let engine = Arc::clone(&engine);
    tauri::async_runtime::spawn_blocking(move || {
        engine.transcribe_partial(
            &model_path(&app_data, &settings.model_file),
            &wav,
            prompt.as_deref(),
        )
    })
    .await
    .map_err(|_| task_failed())
}

fn resolved_settings(
    app: &tauri::AppHandle,
    settings: SpeechSettings,
) -> Result<SpeechSettings, ProviderError> {
    Ok(settings.resolved(&provider_app_data(app)?))
}

#[tauri::command]
pub(crate) fn get_speech_settings(
    app: tauri::AppHandle,
    sessions: tauri::State<'_, SessionStore>,
) -> Result<SpeechSettings, ProviderError> {
    resolved_settings(&app, sessions.speech_settings()?)
}

/// Loads the chosen model in the background so the first answer does not wait for it.
fn warm_in_background(
    app: &tauri::AppHandle,
    engine: &Arc<SpeechEngine>,
    settings: &SpeechSettings,
) -> Result<(), ProviderError> {
    let model = model_path(&provider_app_data(app)?, &settings.model_file);
    let engine = Arc::clone(engine);
    tauri::async_runtime::spawn_blocking(move || engine.warm(&model));
    Ok(())
}

#[tauri::command(rename_all = "snake_case")]
pub(crate) fn save_speech_model(
    app: tauri::AppHandle,
    sessions: tauri::State<'_, SessionStore>,
    engine: tauri::State<'_, Arc<SpeechEngine>>,
    model_file: String,
) -> Result<SpeechSettings, ProviderError> {
    if !is_model_file_name(&model_file) {
        return Err(ProviderError::new(
            ProviderErrorCode::InvalidRequest,
            "That is not a Whisper model file name. Choose a model from the list.",
        ));
    }
    let settings = resolved_settings(
        &app,
        sessions.update_speech_settings(|settings| settings.model_file = model_file)?,
    )?;
    warm_in_background(&app, &engine, &settings)?;
    Ok(settings)
}

#[tauri::command(rename_all = "snake_case")]
pub(crate) fn save_live_transcript(
    app: tauri::AppHandle,
    sessions: tauri::State<'_, SessionStore>,
    live_transcript: bool,
) -> Result<SpeechSettings, ProviderError> {
    resolved_settings(
        &app,
        sessions.update_speech_settings(|settings| settings.live_transcript = live_transcript)?,
    )
}

/// Loads the model when a practice session opens; the status says how it went.
#[tauri::command]
pub(crate) fn warm_speech_engine(
    app: tauri::AppHandle,
    sessions: tauri::State<'_, SessionStore>,
    engine: tauri::State<'_, Arc<SpeechEngine>>,
) -> Result<(), ProviderError> {
    let settings = resolved_settings(&app, sessions.speech_settings()?)?;
    warm_in_background(&app, &engine, &settings)
}

#[derive(Debug, Serialize)]
pub(crate) struct SpeechEngineStatus {
    pub server: ServerState,
    /// Why the model is not kept loaded, when starting it failed.
    pub failure: Option<String>,
    /// The live transcript is switched on and the chosen model is small enough for it.
    pub is_live_transcript_available: bool,
}

#[tauri::command]
pub(crate) fn get_speech_engine_status(
    app: tauri::AppHandle,
    sessions: tauri::State<'_, SessionStore>,
    engine: tauri::State<'_, Arc<SpeechEngine>>,
) -> Result<SpeechEngineStatus, ProviderError> {
    let settings = resolved_settings(&app, sessions.speech_settings()?)?;
    let status = engine.server_status();
    Ok(SpeechEngineStatus {
        server: status.state,
        failure: status.failure,
        is_live_transcript_available: settings.live_transcript
            && is_light_model(&settings.model_file),
    })
}

#[tauri::command(rename_all = "snake_case")]
pub(crate) fn save_keep_raw_audio(
    sessions: tauri::State<'_, SessionStore>,
    keep_raw_audio: bool,
) -> Result<SpeechSettings, ProviderError> {
    sessions.update_speech_settings(|settings| settings.keep_raw_audio = keep_raw_audio)
}

#[derive(Debug, Serialize)]
pub(crate) struct SpeechModels {
    pub models: Vec<SpeechModel>,
    /// Set when `ENG_TRAINER_WHISPER_MODEL` pins a model; the choice in Settings is then ignored.
    pub override_path: Option<String>,
}

#[tauri::command]
pub(crate) fn list_speech_models(app: tauri::AppHandle) -> Result<SpeechModels, ProviderError> {
    Ok(SpeechModels {
        models: list_models(&provider_app_data(&app)?),
        override_path: std::env::var_os("ENG_TRAINER_WHISPER_MODEL")
            .map(|path| path.to_string_lossy().into_owned()),
    })
}

#[tauri::command]
pub(crate) fn get_glossary(
    sessions: tauri::State<'_, SessionStore>,
) -> Result<Vec<String>, ProviderError> {
    sessions.glossary_terms()
}

#[tauri::command]
pub(crate) fn save_glossary(
    sessions: tauri::State<'_, SessionStore>,
    terms: Vec<String>,
) -> Result<Vec<String>, ProviderError> {
    let terms = normalize_terms(&terms)
        .map_err(|error| ProviderError::new(ProviderErrorCode::InvalidRequest, error.message()))?;
    sessions.save_glossary_terms(terms)
}

#[tauri::command]
pub(crate) fn get_kept_recordings(
    app: tauri::AppHandle,
) -> Result<KeptRecordings, TranscriptionError> {
    kept::summary(&app_data(&app)?).map_err(|_| {
        TranscriptionError::new(
            TranscriptionErrorCode::IoFailure,
            "Cannot read the kept recordings. Please retry.",
        )
    })
}

#[tauri::command]
pub(crate) async fn delete_kept_recordings(
    app: tauri::AppHandle,
) -> Result<KeptRecordings, TranscriptionError> {
    let app_data = app_data(&app)?;
    tauri::async_runtime::spawn_blocking(move || {
        kept::delete_all(&app_data).map_err(|_| {
            TranscriptionError::new(
                TranscriptionErrorCode::IoFailure,
                "Cannot delete the kept recordings. Close anything using them, then retry.",
            )
        })?;
        kept::summary(&app_data).map_err(|_| task_failed())
    })
    .await
    .map_err(|_| task_failed())?
}

#[tauri::command]
pub(crate) fn get_speech_check(
    app: tauri::AppHandle,
) -> Result<SpeechCheckStatus, TranscriptionError> {
    Ok(speech_check::status(&app_data(&app)?))
}

/// The WAV is the raw body; the sentence number (1-based) is the `x-sentence-index` header.
#[tauri::command]
pub(crate) fn save_speech_check_recording(
    app: tauri::AppHandle,
    request: tauri::ipc::Request<'_>,
) -> Result<SpeechCheckStatus, TranscriptionError> {
    let index = request
        .headers()
        .get("x-sentence-index")
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.parse::<u32>().ok())
        .ok_or_else(|| {
            TranscriptionError::new(
                TranscriptionErrorCode::InvalidAudio,
                "The recording did not say which sentence it belongs to. Please record again.",
            )
        })?;
    let app_data = app_data(&app)?;
    speech_check::save_recording(&app_data, index, raw_body(&request)?)?;
    Ok(speech_check::status(&app_data))
}

#[tauri::command]
pub(crate) fn delete_speech_check_recordings(
    app: tauri::AppHandle,
) -> Result<SpeechCheckStatus, TranscriptionError> {
    let app_data = app_data(&app)?;
    speech_check::delete_all(&app_data)?;
    Ok(speech_check::status(&app_data))
}

static MEASURING: AtomicBool = AtomicBool::new(false);

struct MeasuringGuard;

impl MeasuringGuard {
    fn acquire() -> Option<Self> {
        (!MEASURING.swap(true, Ordering::AcqRel)).then_some(Self)
    }
}

impl Drop for MeasuringGuard {
    fn drop(&mut self) {
        MEASURING.store(false, Ordering::Release);
    }
}

/// Measures the named models (every installed one when the UI sends all of them) on the speech
/// check, off the UI thread. `on_progress` reports each recording before it is transcribed.
#[tauri::command(rename_all = "snake_case")]
pub(crate) async fn run_speech_check(
    app: tauri::AppHandle,
    sessions: tauri::State<'_, SessionStore>,
    model_files: Vec<String>,
    include_prompt: bool,
    on_progress: tauri::ipc::Channel<SpeechCheckProgress>,
) -> Result<SpeechCheckResults, TranscriptionError> {
    let app_data = app_data(&app)?;
    let terms = sessions.glossary_terms().map_err(|_| {
        TranscriptionError::new(
            TranscriptionErrorCode::IoFailure,
            "Cannot read the glossary. Please restart the app and retry.",
        )
    })?;
    let binary = require_binary()?;
    let Some(guard) = MeasuringGuard::acquire() else {
        return Err(TranscriptionError::new(
            TranscriptionErrorCode::Busy,
            "A measurement is already running. Wait for it to finish.",
        ));
    };
    tauri::async_runtime::spawn_blocking(move || {
        let _guard = guard;
        speech_check::run(
            &binary,
            &app_data,
            &model_files,
            &terms,
            include_prompt,
            |step| {
                // A closed window needs no progress; the measurement still finishes and is saved.
                let _ = on_progress.send(step);
            },
        )
    })
    .await
    .map_err(|_| task_failed())?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_one_measurement_runs_at_a_time() {
        let first = MeasuringGuard::acquire().expect("free at first");
        assert!(MeasuringGuard::acquire().is_none());
        drop(first);
        assert!(MeasuringGuard::acquire().is_some());
    }
}
