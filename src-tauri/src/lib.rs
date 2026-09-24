mod audio;
mod conversation;
mod persistence;
mod providers;

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

#[tauri::command]
async fn generate_follow_up(
    transcript: String,
) -> Result<providers::ConversationTurn, providers::ProviderError> {
    tauri::async_runtime::spawn_blocking(move || providers::generate_follow_up(transcript))
        .await
        .map_err(|_| {
            providers::ProviderError::new(
                providers::ProviderErrorCode::ProcessFailed,
                "The conversation task failed. Please try again.",
            )
        })?
}

#[tauri::command]
fn start_practice_session(
    sessions: tauri::State<'_, conversation::SessionStore>,
) -> Result<conversation::PracticeSession, providers::ProviderError> {
    sessions.start()
}

#[tauri::command]
async fn send_practice_turn(
    sessions: tauri::State<'_, conversation::SessionStore>,
    session_id: u64,
    transcript: String,
) -> Result<providers::ConversationTurn, providers::ProviderError> {
    let sessions = sessions.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        sessions.send_turn(
            session_id,
            transcript,
            providers::generate_conversation_turn,
        )
    })
    .await
    .map_err(|_| {
        providers::ProviderError::new(
            providers::ProviderErrorCode::ProcessFailed,
            "The conversation task failed. Please retry.",
        )
    })?
}

#[tauri::command]
fn finish_practice_session(
    sessions: tauri::State<'_, conversation::SessionStore>,
    session_id: u64,
) -> Result<conversation::FinishedPracticeSession, providers::ProviderError> {
    sessions.finish(session_id)
}

#[tauri::command]
fn get_active_practice_session(
    sessions: tauri::State<'_, conversation::SessionStore>,
) -> Option<conversation::PracticeSession> {
    sessions.get_active()
}

#[tauri::command]
fn get_question_scaffold(question: String) -> conversation::QuestionScaffold {
    conversation::question_scaffold(&question)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let app_data = app.path().app_data_dir()?;
            std::fs::create_dir_all(&app_data)?;
            let database_path = app_data.join("english-trainer.sqlite3");
            let sessions = conversation::SessionStore::open(&database_path).map_err(|error| {
                std::io::Error::other(format!(
                    "Could not initialize local practice history at {}: {error}",
                    database_path.display()
                ))
            })?;
            app.manage(sessions);
            Ok(())
        })
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            transcribe_audio,
            generate_follow_up,
            start_practice_session,
            send_practice_turn,
            finish_practice_session,
            get_active_practice_session,
            get_question_scaffold
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
