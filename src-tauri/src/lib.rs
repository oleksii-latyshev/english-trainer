mod api_usage;
mod audio;
mod conversation;
mod dock_icon;
mod learning;
mod persistence;
mod providers;
mod setup;

use tauri::{Emitter, Manager};

fn apple_binary(app: &tauri::App) -> Option<std::path::PathBuf> {
    app.path()
        .resource_dir()
        .ok()
        .map(|path| path.join("binaries/apple-conversation"))
}

/// Counts requests and limit errors on a thread of their own, so noting one never delays a reply.
fn start_usage_log(sessions: &conversation::SessionStore) {
    let (sender, receiver) = std::sync::mpsc::channel();
    api_usage::install(sender);
    let sessions = sessions.clone();
    std::thread::spawn(move || {
        for event in receiver {
            // Best effort: a count that cannot be saved is lost, and nothing else depends on it.
            let _ = sessions.record_api_usage(&event);
        }
    });
}

/// Delivers streamed reply text to the UI; a closed channel must not fail the turn.
fn forward_deltas(channel: tauri::ipc::Channel<providers::ReplyStreamEvent>) -> impl FnMut(&str) {
    move |text| {
        let _ = channel.send(providers::ReplyStreamEvent::Delta { text: text.into() });
    }
}

fn conversation_task_failed(
    message: &'static str,
) -> impl FnOnce(tauri::Error) -> providers::ProviderError {
    move |_| providers::ProviderError::new(providers::ProviderErrorCode::ProcessFailed, message)
}

#[tauri::command]
async fn prewarm_conversation_provider(
    sessions: tauri::State<'_, conversation::SessionStore>,
    apple: tauri::State<'_, providers::AppleHelper>,
) -> Result<(), providers::ProviderError> {
    let settings = sessions.ai_settings()?;
    let apple = apple.inner().clone();
    tauri::async_runtime::spawn_blocking(move || providers::prewarm_provider(&settings, &apple))
        .await
        .map_err(conversation_task_failed("Provider warm-up failed."))?
}

#[tauri::command]
async fn get_gemini_key_status() -> Result<providers::GeminiKeyStatus, providers::ProviderError> {
    tauri::async_runtime::spawn_blocking(providers::key_status)
        .await
        .map_err(conversation_task_failed(
            "Could not read the Gemini key status.",
        ))?
}

#[tauri::command]
async fn save_gemini_api_key(key: String) -> Result<(), providers::ProviderError> {
    tauri::async_runtime::spawn_blocking(move || providers::save_api_key(&key))
        .await
        .map_err(conversation_task_failed(
            "Could not save the Gemini API key.",
        ))?
}

#[tauri::command]
async fn delete_gemini_api_key() -> Result<(), providers::ProviderError> {
    tauri::async_runtime::spawn_blocking(providers::delete_api_key)
        .await
        .map_err(conversation_task_failed(
            "Could not remove the Gemini API key.",
        ))?
}

#[tauri::command]
fn get_api_usage(
    sessions: tauri::State<'_, conversation::SessionStore>,
) -> Result<api_usage::ApiUsageOverview, providers::ProviderError> {
    sessions.api_usage_overview()
}

#[tauri::command]
fn set_dock_icon(
    app: tauri::AppHandle,
    icon: dock_icon::DockIcon,
) -> Result<(), providers::ProviderError> {
    dock_icon::apply(&app, icon).map_err(|_| {
        providers::ProviderError::new(
            providers::ProviderErrorCode::ProcessFailed,
            "Could not change the Dock icon. Please retry.",
        )
    })
}

#[tauri::command]
fn get_ai_settings(
    sessions: tauri::State<'_, conversation::SessionStore>,
) -> Result<providers::AiSettings, providers::ProviderError> {
    sessions.ai_settings()
}

#[tauri::command]
fn save_ai_settings(
    sessions: tauri::State<'_, conversation::SessionStore>,
    settings: providers::AiSettings,
) -> Result<providers::AiSettings, providers::ProviderError> {
    sessions.save_ai_settings(settings)
}

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
async fn get_setup_diagnostics(
    app: tauri::AppHandle,
) -> Result<setup::SetupDiagnostics, providers::ProviderError> {
    let app_data = app.path().app_data_dir().map_err(|_| {
        providers::ProviderError::new(
            providers::ProviderErrorCode::ProcessFailed,
            "Cannot locate application data directory.",
        )
    })?;
    tauri::async_runtime::spawn_blocking(move || setup::collect(&app_data))
        .await
        .map_err(|_| {
            providers::ProviderError::new(
                providers::ProviderErrorCode::ProcessFailed,
                "Setup diagnostics task failed.",
            )
        })
}

#[tauri::command]
async fn generate_follow_up(
    sessions: tauri::State<'_, conversation::SessionStore>,
    apple: tauri::State<'_, providers::AppleHelper>,
    transcript: String,
    on_reply: tauri::ipc::Channel<providers::ReplyStreamEvent>,
) -> Result<providers::ConversationTurn, providers::ProviderError> {
    let settings = sessions.ai_settings()?;
    let apple = apple.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        providers::generate_configured_turn(
            &providers::ConversationContext {
                opening_question: String::new(),
                recent_turns: Vec::new(),
                latest_transcript: transcript,
                learning_targets: Vec::new(),
                ..Default::default()
            },
            &settings,
            &apple,
            &mut forward_deltas(on_reply),
        )
    })
    .await
    .map_err(conversation_task_failed(
        "The conversation task failed. Please try again.",
    ))?
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
) -> Result<conversation::PracticeSession, providers::ProviderError> {
    sessions.start_session()
}

// Tauri injects each managed state as its own argument, so the count is the command's contract.
#[allow(clippy::too_many_arguments)]
#[tauri::command]
async fn send_practice_turn(
    sessions: tauri::State<'_, conversation::SessionStore>,
    coaching: tauri::State<'_, conversation::CoachingQueue>,
    apple: tauri::State<'_, providers::AppleHelper>,
    session_id: u64,
    transcript: String,
    input_source: Option<conversation::InputSource>,
    answer_duration_ms: Option<u64>,
    on_reply: tauri::ipc::Channel<providers::ReplyStreamEvent>,
) -> Result<providers::ConversationTurn, providers::ProviderError> {
    let settings = sessions.ai_settings()?;
    let apple = apple.inner().clone();
    let sessions = sessions.inner().clone();
    let turn = tauri::async_runtime::spawn_blocking(move || {
        let mut forward = forward_deltas(on_reply);
        sessions.send_turn_with_source(
            session_id,
            transcript,
            input_source.unwrap_or_default(),
            answer_duration_ms,
            |context| providers::generate_configured_turn(context, &settings, &apple, &mut forward),
        )
    })
    .await
    .map_err(conversation_task_failed(
        "The conversation task failed. Please retry.",
    ))??;
    // The answer is saved: coaching joins its queue and runs in the background.
    coaching.answer_saved(session_id);
    Ok(turn)
}

#[tauri::command]
fn get_practice_dialogue(
    sessions: tauri::State<'_, conversation::SessionStore>,
    session_id: u64,
) -> Result<conversation::PracticeDialogue, providers::ProviderError> {
    sessions.dialogue(session_id)
}

#[tauri::command]
fn finish_practice_session(
    sessions: tauri::State<'_, conversation::SessionStore>,
    coaching: tauri::State<'_, conversation::CoachingQueue>,
    session_id: u64,
) -> Result<conversation::FinishedPracticeSession, providers::ProviderError> {
    let summary = sessions.finish(session_id)?;
    coaching.flush(session_id);
    Ok(summary)
}

#[tauri::command]
fn get_session_wrapup(
    sessions: tauri::State<'_, conversation::SessionStore>,
    session_id: u64,
) -> Result<conversation::FinishedPracticeSession, providers::ProviderError> {
    sessions.session_wrapup(session_id)
}

#[tauri::command]
fn retry_answer_coaching(
    coaching: tauri::State<'_, conversation::CoachingQueue>,
    session_id: u64,
    sequence: usize,
) -> Result<(), providers::ProviderError> {
    coaching.retry(session_id, sequence)
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
fn record_answer_help_used(
    sessions: tauri::State<'_, conversation::SessionStore>,
    session_id: u64,
    sequence: usize,
) -> Result<(), providers::ProviderError> {
    sessions.record_answer_help_used(session_id, sequence)
}

#[tauri::command]
async fn get_guided_answer(
    sessions: tauri::State<'_, conversation::SessionStore>,
    session_id: u64,
    sequence: usize,
    question: String,
) -> Result<providers::GuidedAnswer, providers::ProviderError> {
    let store = sessions.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        store.guided_answer(
            session_id,
            sequence,
            &question,
            providers::generate_guided_answer,
        )
    })
    .await
    .map_err(|_| {
        providers::ProviderError::new(
            providers::ProviderErrorCode::ProcessFailed,
            "Could not prepare an answer example. Please retry.",
        )
    })?
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
fn delete_phrase_card(
    sessions: tauri::State<'_, conversation::SessionStore>,
    phrase_id: u64,
) -> Result<bool, providers::ProviderError> {
    sessions.delete_phrase(phrase_id)
}

#[tauri::command(rename_all = "snake_case")]
fn delete_mistake(
    sessions: tauri::State<'_, conversation::SessionStore>,
    mistake_id: u64,
) -> Result<bool, providers::ProviderError> {
    sessions.delete_mistake(mistake_id)
}

#[tauri::command(rename_all = "snake_case")]
fn archive_learning_item(
    sessions: tauri::State<'_, conversation::SessionStore>,
    item_type: learning::LearningItemType,
    item_id: u64,
) -> Result<bool, providers::ProviderError> {
    sessions.archive_learning_item(item_type, item_id)
}

#[tauri::command(rename_all = "snake_case")]
fn get_learning_memory(
    sessions: tauri::State<'_, conversation::SessionStore>,
) -> Result<learning::LearningMemoryView, providers::ProviderError> {
    sessions.get_learning_memory()
}

#[tauri::command(rename_all = "snake_case")]
fn start_memory_review(
    sessions: tauri::State<'_, conversation::SessionStore>,
) -> Result<Option<learning::MemoryReviewRun>, providers::ProviderError> {
    sessions.start_memory_review()
}

#[tauri::command(rename_all = "snake_case")]
fn get_memory_review(
    sessions: tauri::State<'_, conversation::SessionStore>,
) -> Result<Option<learning::MemoryReviewRun>, providers::ProviderError> {
    sessions.get_memory_review()
}

#[tauri::command(rename_all = "snake_case")]
fn submit_memory_recall(
    sessions: tauri::State<'_, conversation::SessionStore>,
    run_id: u64,
    item_type: learning::LearningItemType,
    item_id: u64,
    transcript: String,
) -> Result<learning::MemoryRecallResult, providers::ProviderError> {
    sessions.submit_memory_recall(run_id, item_type, item_id, transcript)
}

#[tauri::command(rename_all = "snake_case")]
fn skip_memory_review_item(
    sessions: tauri::State<'_, conversation::SessionStore>,
    run_id: u64,
    item_type: learning::LearningItemType,
    item_id: u64,
) -> Result<learning::MemoryReviewRun, providers::ProviderError> {
    sessions.skip_memory_review_item(run_id, item_type, item_id)
}

#[tauri::command(rename_all = "snake_case")]
fn finish_memory_review(
    sessions: tauri::State<'_, conversation::SessionStore>,
    run_id: u64,
) -> Result<bool, providers::ProviderError> {
    sessions.finish_memory_review(run_id)
}

#[tauri::command(rename_all = "snake_case")]
async fn review_practice_memory_usage(
    sessions: tauri::State<'_, conversation::SessionStore>,
    session_id: u64,
    sequence: usize,
) -> Result<learning::TurnUsageAssessment, providers::ProviderError> {
    let sessions = sessions.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        sessions.review_memory_usage(session_id, sequence, providers::review_turn_usage)
    })
    .await
    .map_err(|_| {
        providers::ProviderError::new(
            providers::ProviderErrorCode::ProcessFailed,
            "The usage review task failed. Please retry.",
        )
    })?
}

#[tauri::command(rename_all = "snake_case")]
fn get_practice_memory_usage(
    sessions: tauri::State<'_, conversation::SessionStore>,
    session_id: u64,
    sequence: usize,
) -> Result<Option<learning::TurnUsageAssessment>, providers::ProviderError> {
    sessions.get_practice_memory_usage(session_id, sequence)
}

#[tauri::command(rename_all = "snake_case")]
fn get_memory_usage_evidence(
    sessions: tauri::State<'_, conversation::SessionStore>,
    item_type: learning::LearningItemType,
    item_id: u64,
) -> Result<learning::MemoryUsageEvidence, providers::ProviderError> {
    sessions.get_memory_usage_evidence(item_type, item_id)
}

#[tauri::command(rename_all = "snake_case")]
fn view_learning_memory(
    sessions: tauri::State<'_, conversation::SessionStore>,
) -> Result<learning::LearningMemoryView, providers::ProviderError> {
    sessions.view_learning_memory()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let app_data = app.path().app_data_dir()?;
            std::fs::create_dir_all(&app_data)?;
            providers::configure_key_store(&app_data);
            let database_path = app_data.join("english-trainer.sqlite3");
            let sessions = conversation::SessionStore::open(&database_path).map_err(|error| {
                std::io::Error::other(format!(
                    "Could not initialize local practice history at {}: {error}",
                    database_path.display()
                ))
            })?;
            let handle = app.handle().clone();
            app.manage(conversation::CoachingQueue::start(
                sessions.clone(),
                providers::coach_answers,
                conversation::IDLE_FLUSH,
                conversation::QUOTA_PAUSE,
                move |event| {
                    // A closed window needs no news; the answers stay saved.
                    let _ = handle.emit("coaching-updated", event);
                },
            ));
            start_usage_log(&sessions);
            app.manage(sessions);
            app.manage(providers::AppleHelper::new(apple_binary(app)));
            Ok(())
        })
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            transcribe_audio,
            get_setup_diagnostics,
            get_ai_settings,
            set_dock_icon,
            get_api_usage,
            save_ai_settings,
            prewarm_conversation_provider,
            get_gemini_key_status,
            save_gemini_api_key,
            delete_gemini_api_key,
            generate_follow_up,
            retry_practice_turn,
            start_practice_session,
            send_practice_turn,
            get_practice_dialogue,
            finish_practice_session,
            get_session_wrapup,
            retry_answer_coaching,
            get_daily_recall_plan,
            submit_daily_recall,
            get_active_practice_session,
            get_question_scaffold,
            get_guided_answer,
            record_answer_help_used,
            save_phrase_card,
            delete_phrase_card,
            delete_mistake,
            archive_learning_item,
            get_learning_memory,
            view_learning_memory,
            start_memory_review,
            get_memory_review,
            submit_memory_recall,
            skip_memory_review_item,
            finish_memory_review,
            review_practice_memory_usage,
            get_practice_memory_usage,
            get_memory_usage_evidence,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
