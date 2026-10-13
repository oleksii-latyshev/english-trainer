mod ai_settings;
mod api_usage;
mod conversation;
mod core;
mod dock_icon;
mod gemini_key;
mod learning;
mod persistence;
mod personal_profile;
mod providers;
mod setup;
mod speaking_activity;
mod speech_recognition;
mod translation;
mod translation_settings;
mod voice;

pub use conversation::{
    FinishedPracticeSession, InputSource, PracticeMode, PracticePhase, PracticeSession,
    SessionStore, StartPracticeOptions,
};
pub use providers::{ConversationContext, ConversationTurn, ProviderError};

use tauri::{Emitter, Manager};

fn apple_binary(app: &tauri::App) -> Option<std::path::PathBuf> {
    app.path()
        .resource_dir()
        .ok()
        .map(|path| path.join("binaries/apple-conversation"))
}

fn apple_translation_binary(app: &tauri::App) -> Option<std::path::PathBuf> {
    app.path()
        .resource_dir()
        .ok()
        .map(|path| path.join("binaries/apple-translation"))
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

fn saved_ai_settings(
    service: &ai_settings::AiSettingsService,
) -> Result<ai_settings::AiSettings, providers::ProviderError> {
    service
        .get()
        .map_err(|error| providers::ProviderError::from(core::IpcError::from(error)))
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
async fn generate_follow_up(
    ai_settings: tauri::State<'_, ai_settings::AiSettingsService>,
    apple: tauri::State<'_, providers::AppleHelper>,
    transcript: String,
    on_reply: tauri::ipc::Channel<providers::ReplyStreamEvent>,
) -> Result<providers::ConversationTurn, providers::ProviderError> {
    let settings = saved_ai_settings(&ai_settings)?;
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
    options: Option<conversation::StartPracticeOptions>,
) -> Result<conversation::PracticeSession, providers::ProviderError> {
    sessions.start_practice_session(options)
}

#[tauri::command]
async fn start_mistake_practice(
    sessions: tauri::State<'_, conversation::SessionStore>,
) -> Result<conversation::PracticeSession, providers::ProviderError> {
    let sessions = sessions.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        sessions.start_mistake_practice(providers::agy::mistake_practice::generate)
    })
    .await
    .map_err(conversation_task_failed(
        "The mistake practice task failed. Please retry.",
    ))?
}

#[tauri::command]
fn set_practice_clock(
    sessions: tauri::State<'_, conversation::SessionStore>,
    session_id: u64,
    running: bool,
) -> Result<conversation::PracticeSession, providers::ProviderError> {
    sessions.set_practice_clock(session_id, running)
}

#[tauri::command]
fn transition_practice_phase(
    sessions: tauri::State<'_, conversation::SessionStore>,
    coaching: tauri::State<'_, conversation::CoachingQueue>,
    session_id: u64,
    phase: conversation::PracticePhase,
) -> Result<conversation::PracticeSession, providers::ProviderError> {
    let session = sessions.transition_practice_phase(session_id, phase)?;
    if phase.is_review() {
        coaching.flush(session_id);
    }
    Ok(session)
}

// Tauri injects each managed state as its own argument, so the count is the command's contract.
#[allow(clippy::too_many_arguments)]
#[tauri::command]
async fn send_practice_turn(
    sessions: tauri::State<'_, conversation::SessionStore>,
    coaching: tauri::State<'_, conversation::CoachingQueue>,
    ai_settings: tauri::State<'_, ai_settings::AiSettingsService>,
    apple: tauri::State<'_, providers::AppleHelper>,
    session_id: u64,
    transcript: String,
    input_source: Option<conversation::InputSource>,
    answer_duration_ms: Option<u64>,
    on_reply: tauri::ipc::Channel<providers::ReplyStreamEvent>,
) -> Result<providers::ConversationTurn, providers::ProviderError> {
    let settings = saved_ai_settings(&ai_settings)?;
    let apple = apple.inner().clone();
    let sessions = sessions.inner().clone();
    let turn = tauri::async_runtime::spawn_blocking(move || {
        let mut forward = forward_deltas(on_reply);
        sessions.send_turn_cancellable(
            session_id,
            transcript,
            input_source.unwrap_or_default(),
            answer_duration_ms,
            |context, cancelled| {
                providers::generate_configured_turn_cancellable(
                    context,
                    &settings,
                    &apple,
                    &mut forward,
                    cancelled,
                )
            },
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
fn cancel_practice_reply(
    sessions: tauri::State<'_, conversation::SessionStore>,
    session_id: u64,
) -> Result<bool, providers::ProviderError> {
    sessions.cancel_pending_reply(session_id)
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
    wrapup: tauri::State<'_, conversation::WrapupQueue>,
    session_id: u64,
) -> Result<conversation::FinishedPracticeSession, providers::ProviderError> {
    let summary = sessions.finish(session_id)?;
    coaching.flush(session_id);
    wrapup.wake();
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
fn retry_session_wrapup(
    wrapup: tauri::State<'_, conversation::WrapupQueue>,
    session_id: u64,
) -> Result<(), providers::ProviderError> {
    wrapup.retry(session_id)
}

#[tauri::command]
fn save_wrapup_phrases(
    sessions: tauri::State<'_, conversation::SessionStore>,
    session_id: u64,
    phrases: Vec<String>,
) -> Result<conversation::SavedWrapupPhrases, providers::ProviderError> {
    sessions.save_wrapup_phrases(session_id, &phrases)
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

#[tauri::command(rename_all = "snake_case")]
async fn rescue_answer(
    sessions: tauri::State<'_, conversation::SessionStore>,
    session_id: u64,
    sequence: usize,
    request: providers::RescueRequest,
) -> Result<providers::RescueResponse, providers::ProviderError> {
    let store = sessions.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        store.rescue_answer(session_id, sequence, &request, providers::generate_rescue)
    })
    .await
    .map_err(|_| {
        providers::ProviderError::new(
            providers::ProviderErrorCode::ProcessFailed,
            "Could not prepare rescue help. Keep speaking and try Stuck again.",
        )
    })?
}

#[tauri::command(rename_all = "snake_case")]
async fn prefetch_answer_plan(
    sessions: tauri::State<'_, conversation::SessionStore>,
    session_id: u64,
    sequence: usize,
    question: String,
    retry: Option<bool>,
) -> Result<providers::AnswerPlan, providers::ProviderError> {
    let store = sessions.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        store.answer_plan(
            session_id,
            sequence,
            &question,
            retry.unwrap_or(false),
            providers::generate_answer_plan,
        )
    })
    .await
    .map_err(|_| {
        providers::ProviderError::new(
            providers::ProviderErrorCode::ProcessFailed,
            "Could not prepare this answer plan. Retry help or keep speaking.",
        )
    })?
}

#[tauri::command]
fn get_question_scaffold(question: String) -> conversation::QuestionScaffold {
    conversation::question_scaffold(&question)
}

#[tauri::command(rename_all = "snake_case")]
fn start_memory_review(
    sessions: tauri::State<'_, conversation::SessionStore>,
    warmup: Option<bool>,
) -> Result<Option<learning::MemoryReviewRun>, providers::ProviderError> {
    if warmup.unwrap_or(false) {
        sessions.start_memory_warmup()
    } else {
        sessions.start_memory_review()
    }
}

#[tauri::command(rename_all = "snake_case")]
async fn prepare_review_material(
    sessions: tauri::State<'_, conversation::SessionStore>,
    run_id: u64,
    retry: Option<bool>,
) -> Result<conversation::ReviewMaterials, providers::ProviderError> {
    let store = sessions.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        store.prepare_review_material(
            run_id,
            retry.unwrap_or(false),
            providers::generate_review_material,
        )
    })
    .await
    .map_err(|_| {
        providers::ProviderError::new(
            providers::ProviderErrorCode::ProcessFailed,
            "Could not prepare review situations. Please retry.",
        )
    })?
}

#[tauri::command(rename_all = "snake_case")]
fn get_review_material(
    sessions: tauri::State<'_, conversation::SessionStore>,
    run_id: u64,
) -> Result<conversation::ReviewMaterials, providers::ProviderError> {
    sessions.get_review_material(run_id)
}

#[tauri::command(rename_all = "snake_case")]
fn reveal_review_phrase(
    sessions: tauri::State<'_, conversation::SessionStore>,
    run_id: u64,
    position: usize,
) -> Result<conversation::ReviewMaterials, providers::ProviderError> {
    sessions.reveal_review_phrase(run_id, position)
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let app_data = app.path().app_data_dir()?;
            std::fs::create_dir_all(&app_data)?;
            let key_service =
                gemini_key::KeyService::new(gemini_key::EncryptedFileStore::in_folder(&app_data));
            gemini_key::install(key_service.clone());
            app.manage(key_service);
            let apple_helper = providers::AppleHelper::new(apple_binary(app));
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
            let handle = app.handle().clone();
            app.manage(
                conversation::WrapupQueue::start(
                    sessions.clone(),
                    providers::generate_session_wrapup,
                    move |event| {
                        let _ = handle.emit("wrapup-updated", event);
                    },
                )
                .map_err(|_| {
                    std::io::Error::other(
                        "Could not start session phrase preparation. Restart the app.",
                    )
                })?,
            );
            app.manage(ai_settings::AiSettingsService::new(
                ai_settings::SessionSettingsStore::new(sessions.clone()),
                ai_settings::AppleProviderWarmup::new(apple_helper.clone()),
            ));
            let usage_service = api_usage::ApiUsageService::new(api_usage::SessionUsageStore::new(
                sessions.clone(),
            ));
            api_usage::start_recording(usage_service.clone());
            app.manage(usage_service);
            app.manage(learning::LearningService::new(
                learning::SessionLearningStore::new(sessions.clone()),
            ));
            app.manage(speaking_activity::SpeakingActivityService::new(
                speaking_activity::SessionActivityStore::new(sessions.clone()),
            ));
            app.manage(personal_profile::PersonalProfileService::new(
                personal_profile::SessionProfileStore::new(sessions.clone()),
            ));
            let translation = translation::TranslationService::new(apple_translation_binary(app));
            app.manage(translation_settings::TranslationSettingsService::new(
                translation_settings::SessionLanguageStore::new(sessions.clone()),
                translation_settings::AppleLanguageAvailability::new(translation.clone()),
            ));
            app.manage(translation);
            let speech_store = std::sync::Arc::new(speech_recognition::SessionSpeechStore::new(
                sessions.clone(),
            ));
            app.manage(speech_recognition::SpeechRecognitionService::new(
                speech_recognition::SpeechRecognitionPorts {
                    engine: std::sync::Arc::new(speech_recognition::WhisperEngine::new(Some(
                        app_data.join("whisper-server.pid"),
                    ))),
                    one_off: std::sync::Arc::new(speech_recognition::CliTranscriber),
                    settings: speech_store.clone(),
                    glossary: speech_store.clone(),
                    conversation: speech_store,
                    models: std::sync::Arc::new(speech_recognition::ModelFiles::new(
                        app_data.clone(),
                    )),
                    recordings: std::sync::Arc::new(speech_recognition::KeptRecordingFiles::new(
                        app_data.clone(),
                    )),
                    speech_check: std::sync::Arc::new(speech_recognition::SpeechCheckFiles::new(
                        &app_data,
                    )),
                },
            ));
            app.manage(sessions);
            app.manage(apple_helper);
            let voice_directory = app
                .path()
                .resource_dir()
                .ok()
                .map(|p| p.join("binaries/natural-voice"));
            app.manage(voice::VoiceService::new(voice::SupertonicEngine::new(
                voice_directory,
            )));
            Ok(())
        })
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            voice::commands::prewarm_natural_voice,
            voice::commands::synthesize_natural_voice,
            speech_recognition::commands::transcribe_audio,
            speech_recognition::commands::transcribe_partial,
            speech_recognition::commands::transcribe_rescue,
            speech_recognition::commands::get_speech_settings,
            speech_recognition::commands::save_speech_model,
            speech_recognition::commands::save_live_transcript,
            speech_recognition::commands::warm_speech_engine,
            speech_recognition::commands::get_speech_engine_status,
            speech_recognition::commands::save_keep_raw_audio,
            speech_recognition::commands::list_speech_models,
            speech_recognition::commands::get_glossary,
            speech_recognition::commands::save_glossary,
            speech_recognition::commands::get_kept_recordings,
            speech_recognition::commands::delete_kept_recordings,
            speech_recognition::commands::get_speech_check,
            speech_recognition::commands::save_speech_check_recording,
            speech_recognition::commands::delete_speech_check_recordings,
            speech_recognition::commands::run_speech_check,
            translation_settings::commands::get_translation_settings,
            translation_settings::commands::save_translation_settings,
            translation_settings::commands::get_translation_status,
            translation_settings::commands::prepare_translation_languages,
            translation::commands::translate_word,
            setup::commands::get_setup_diagnostics,
            ai_settings::commands::get_ai_settings,
            set_dock_icon,
            api_usage::commands::get_api_usage,
            speaking_activity::commands::get_speaking_activity,
            ai_settings::commands::save_ai_settings,
            ai_settings::commands::prewarm_conversation_provider,
            gemini_key::commands::get_gemini_key_status,
            gemini_key::commands::save_gemini_api_key,
            gemini_key::commands::delete_gemini_api_key,
            generate_follow_up,
            retry_practice_turn,
            start_practice_session,
            start_mistake_practice,
            set_practice_clock,
            transition_practice_phase,
            personal_profile::commands::get_personal_profile,
            personal_profile::commands::save_personal_profile,
            send_practice_turn,
            cancel_practice_reply,
            get_practice_dialogue,
            finish_practice_session,
            get_session_wrapup,
            retry_session_wrapup,
            save_wrapup_phrases,
            retry_answer_coaching,
            get_daily_recall_plan,
            submit_daily_recall,
            get_active_practice_session,
            get_question_scaffold,
            prefetch_answer_plan,
            rescue_answer,
            get_guided_answer,
            record_answer_help_used,
            learning::commands::save_phrase_card,
            learning::commands::delete_phrase_card,
            learning::commands::delete_mistake,
            learning::commands::archive_learning_item,
            learning::commands::get_learning_memory,
            learning::commands::view_learning_memory,
            start_memory_review,
            get_memory_review,
            prepare_review_material,
            get_review_material,
            reveal_review_phrase,
            submit_memory_recall,
            skip_memory_review_item,
            finish_memory_review,
            review_practice_memory_usage,
            get_practice_memory_usage,
            learning::commands::get_memory_usage_evidence,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            // The model server is a child process; it must not outlive the app.
            if let tauri::RunEvent::Exit = event {
                if let Some(sessions) = app.try_state::<conversation::SessionStore>() {
                    if let Err(error) = sessions.checkpoint_on_exit() {
                        eprintln!(
                            "Could not checkpoint the practice session clock on exit: {error:?}"
                        );
                    }
                }
                if let Some(speech) =
                    app.try_state::<speech_recognition::SpeechRecognitionService>()
                {
                    speech.shutdown();
                }
            }
        });
}
