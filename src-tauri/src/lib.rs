mod ai_settings;
mod api_usage;
mod conversation;
mod core;
mod dock_icon;
mod eva_growth;
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

pub use conversation::ports::ReplyEngine;
pub use conversation::{
    FinishedPracticeSession, InputSource, PracticeMode, PracticePhase, PracticeSession,
    SessionStore, StartPracticeOptions,
};
pub use providers::{ConversationContext, ConversationTurn, ProviderError};

use tauri::Manager;

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

fn warm_up_translation(
    translation: translation::TranslationService,
    sessions: conversation::SessionStore,
) {
    std::thread::spawn(move || {
        if let Ok(settings) = sessions.translation_settings() {
            translation.warm_up(&settings.native_language);
        }
    });
}

#[tauri::command]
fn set_dock_icon(app: tauri::AppHandle, icon: dock_icon::DockIcon) -> Result<(), core::IpcError> {
    dock_icon::apply(&app, icon).map_err(|_| {
        core::IpcError::new(
            core::IpcErrorCode::ProcessFailed,
            "Could not change the Dock icon. Please retry.",
        )
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
#[allow(
    clippy::expect_used,
    reason = "the app cannot start when the Tauri builder fails, so aborting is the only outcome"
)]
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
            app.manage(
                conversation::CoachingQueue::start(
                    sessions.clone(),
                    providers::coach_answers,
                    conversation::IDLE_FLUSH,
                    conversation::QUOTA_PAUSE,
                    conversation::infra::events::coaching_notifier(handle),
                )
                .map_err(|error| {
                    eprintln!("Could not start the coaching worker thread: {error}");
                    std::io::Error::other("Could not start answer coaching. Restart the app.")
                })?,
            );
            let handle = app.handle().clone();
            app.manage(
                conversation::WrapupQueue::start(
                    sessions.clone(),
                    providers::generate_session_wrapup,
                    conversation::infra::events::wrapup_notifier(handle),
                )
                .map_err(|error| {
                    eprintln!("Could not start the wrap-up worker thread: {error}");
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
            app.manage(learning::ReviewService::new(
                learning::SessionLearningStore::new(sessions.clone()),
            ));
            app.manage(learning::UsageReviewService::new(
                learning::SessionLearningStore::new(sessions.clone()),
            ));
            app.manage(speaking_activity::SpeakingActivityService::new(
                speaking_activity::SessionActivityStore::new(sessions.clone()),
            ));
            app.manage(eva_growth::EvaGrowthService::new(
                eva_growth::SessionGrowthStore::new(sessions.clone()),
            ));
            app.manage(personal_profile::PersonalProfileService::new(
                personal_profile::SessionProfileStore::new(sessions.clone()),
            ));
            let translation = translation::TranslationService::new(apple_translation_binary(app));
            app.manage(translation_settings::TranslationSettingsService::new(
                translation_settings::SessionLanguageStore::new(sessions.clone()),
                translation_settings::AppleLanguageAvailability::new(translation.clone()),
            ));
            warm_up_translation(translation.clone(), sessions.clone());
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
            translation::commands::translate_text,
            translation::commands::explain_text,
            setup::commands::get_setup_diagnostics,
            ai_settings::commands::get_ai_settings,
            set_dock_icon,
            api_usage::commands::get_api_usage,
            speaking_activity::commands::get_speaking_activity,
            eva_growth::commands::get_eva_growth,
            ai_settings::commands::save_ai_settings,
            ai_settings::commands::prewarm_conversation_provider,
            gemini_key::commands::get_gemini_key_status,
            gemini_key::commands::save_gemini_api_key,
            gemini_key::commands::delete_gemini_api_key,
            conversation::commands::generate_follow_up,
            conversation::commands::retry_practice_turn,
            conversation::commands::start_practice_session,
            conversation::commands::start_mistake_practice,
            conversation::commands::set_practice_clock,
            conversation::commands::transition_practice_phase,
            personal_profile::commands::get_personal_profile,
            personal_profile::commands::save_personal_profile,
            conversation::commands::send_practice_turn,
            conversation::commands::cancel_practice_reply,
            conversation::commands::get_practice_dialogue,
            conversation::commands::finish_practice_session,
            conversation::commands::get_session_wrapup,
            conversation::commands::retry_session_wrapup,
            conversation::commands::save_wrapup_phrases,
            conversation::commands::retry_answer_coaching,
            conversation::commands::get_daily_recall_plan,
            conversation::commands::submit_daily_recall,
            conversation::commands::get_active_practice_session,
            conversation::commands::prefetch_answer_plan,
            conversation::commands::rescue_answer,
            conversation::commands::record_answer_help_used,
            learning::commands::save_phrase_card,
            learning::commands::delete_phrase_card,
            learning::commands::delete_mistake,
            learning::commands::archive_learning_item,
            learning::commands::get_learning_memory,
            learning::commands::view_learning_memory,
            learning::review_commands::start_memory_review,
            learning::review_commands::get_memory_review,
            learning::review_commands::prepare_review_material,
            learning::review_commands::get_review_material,
            learning::review_commands::reveal_review_phrase,
            learning::review_commands::submit_memory_recall,
            learning::review_commands::skip_memory_review_item,
            learning::review_commands::finish_memory_review,
            learning::usage_commands::review_practice_memory_usage,
            learning::usage_commands::get_practice_memory_usage,
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
