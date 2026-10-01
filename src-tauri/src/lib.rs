mod audio;
mod conversation;
mod learning;
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
async fn get_turn_feedback(
    question: String,
    transcript: String,
) -> Result<providers::TurnFeedback, providers::ProviderError> {
    tauri::async_runtime::spawn_blocking(move || {
        providers::evaluate_turn_feedback(&providers::FeedbackRequest {
            question,
            transcript,
        })
    })
    .await
    .map_err(|_| {
        providers::ProviderError::new(
            providers::ProviderErrorCode::ProcessFailed,
            "The coaching task failed. Please retry.",
        )
    })?
}

#[tauri::command]
fn save_practice_feedback(
    sessions: tauri::State<'_, conversation::SessionStore>,
    session_id: u64,
    sequence: usize,
    transcript: String,
    feedback: providers::TurnFeedback,
) -> Result<(), providers::ProviderError> {
    sessions.save_feedback(session_id, sequence, &transcript, &feedback)
}

#[tauri::command]
fn retry_practice_turn(
    sessions: tauri::State<'_, conversation::SessionStore>,
    session_id: u64,
    sequence: usize,
    transcript: String,
) -> Result<providers::AttemptComparison, providers::ProviderError> {
    sessions.retry_turn(session_id, sequence, transcript)
}

#[tauri::command]
fn start_practice_session(
    sessions: tauri::State<'_, conversation::SessionStore>,
    mode: Option<conversation::SessionMode>,
) -> Result<conversation::PracticeSession, providers::ProviderError> {
    sessions.start_session(mode)
}

#[tauri::command]
fn save_coach_answer(
    sessions: tauri::State<'_, conversation::SessionStore>,
    session_id: u64,
    transcript: String,
) -> Result<conversation::SavedCoachState, providers::ProviderError> {
    sessions.save_coach_answer(session_id, transcript)
}

#[tauri::command]
async fn continue_coach_turn(
    sessions: tauri::State<'_, conversation::SessionStore>,
    session_id: u64,
    sequence: usize,
) -> Result<providers::ConversationTurn, providers::ProviderError> {
    let sessions = sessions.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        sessions.continue_turn(session_id, sequence, providers::generate_conversation_turn)
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
fn get_daily_recall_plan(
    sessions: tauri::State<'_, conversation::SessionStore>,
    session_id: u64,
) -> Result<conversation::DailyRecallPlan, providers::ProviderError> {
    sessions.daily_recall_plan(session_id)
}

#[tauri::command]
fn submit_daily_recall(
    sessions: tauri::State<'_, conversation::SessionStore>,
    session_id: u64,
    phrase_id: u64,
    transcript: String,
) -> Result<conversation::SpokenRecallResult, providers::ProviderError> {
    sessions.submit_daily_recall(session_id, phrase_id, transcript)
}

#[tauri::command]
fn get_active_practice_session(
    sessions: tauri::State<'_, conversation::SessionStore>,
) -> Result<Option<conversation::PracticeSession>, providers::ProviderError> {
    sessions.get_active()
}

#[tauri::command]
fn get_question_scaffold(question: String) -> conversation::QuestionScaffold {
    conversation::question_scaffold(&question)
}

#[tauri::command(rename_all = "snake_case")]
fn save_phrase_card(
    sessions: tauri::State<'_, conversation::SessionStore>,
    phrase: String,
    meaning_or_note: Option<String>,
    session_id: Option<u64>,
    sequence: Option<usize>,
) -> Result<learning::PhraseCardRecord, providers::ProviderError> {
    sessions.save_phrase(
        phrase,
        meaning_or_note.unwrap_or_default(),
        session_id,
        sequence,
    )
}

#[tauri::command(rename_all = "snake_case")]
fn get_learning_memory(
    sessions: tauri::State<'_, conversation::SessionStore>,
) -> Result<learning::LearningMemoryView, providers::ProviderError> {
    sessions.get_learning_memory()
}

#[tauri::command(rename_all = "snake_case")]
fn submit_learning_review(
    sessions: tauri::State<'_, conversation::SessionStore>,
    item_type: learning::LearningItemType,
    item_id: u64,
    response: learning::ReviewResponse,
) -> Result<learning::ReviewResult, providers::ProviderError> {
    sessions.submit_review(item_type, item_id, response)
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
            get_turn_feedback,
            save_practice_feedback,
            retry_practice_turn,
            start_practice_session,
            send_practice_turn,
            save_coach_answer,
            continue_coach_turn,
            finish_practice_session,
            get_daily_recall_plan,
            submit_daily_recall,
            get_active_practice_session,
            get_question_scaffold,
            save_phrase_card,
            get_learning_memory,
            submit_learning_review,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
