use super::infra::providers::{AgyMistakeQuestions, ConfiguredReplyEngine};
use super::ports::ReplyEngine;
use super::{
    CoachingQueue, FinishedPracticeSession, InputSource, PracticeDialogue, PracticePhase,
    PracticeSession, QuestionScaffold, SavedWrapupPhrases, SessionStore, StartPracticeOptions,
    WrapupQueue,
};
use crate::ai_settings::{AiSettings, AiSettingsService};
use crate::core::IpcError;
use crate::learning::recall::{DailyRecallPlan, SpokenRecallResult};
use crate::providers::{
    self, AnswerPlan, AppleHelper, AttemptComparison, ConversationContext, ConversationTurn,
    GuidedAnswer, ReplyStreamEvent, RescueRequest, RescueResponse,
};
use std::sync::atomic::AtomicBool;
use std::sync::Arc;
use tauri::ipc::Channel;

const TURN_TASK_FAILED: &str = "The conversation task failed. Please retry.";

async fn blocking<T, E>(
    sessions: tauri::State<'_, SessionStore>,
    failure: &'static str,
    work: impl FnOnce(SessionStore) -> Result<T, E> + Send + 'static,
) -> Result<T, IpcError>
where
    T: Send + 'static,
    E: Into<IpcError> + Send + 'static,
{
    let sessions = sessions.inner().clone();
    tauri::async_runtime::spawn_blocking(move || work(sessions))
        .await
        .map_err(IpcError::task_failed(failure))?
        .map_err(Into::into)
}

fn saved_ai_settings(service: &AiSettingsService) -> Result<AiSettings, IpcError> {
    service.get().map_err(IpcError::from)
}

#[tauri::command]
pub async fn generate_follow_up(
    ai_settings: tauri::State<'_, AiSettingsService>,
    apple: tauri::State<'_, AppleHelper>,
    transcript: String,
    on_reply: Channel<ReplyStreamEvent>,
) -> Result<ConversationTurn, IpcError> {
    let settings = saved_ai_settings(&ai_settings)?;
    let apple = apple.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let context = ConversationContext {
            opening_question: String::new(),
            recent_turns: Vec::new(),
            latest_transcript: transcript,
            learning_targets: Vec::new(),
            ..Default::default()
        };
        ConfiguredReplyEngine::new(settings, apple, on_reply)
            .generate(&context, Arc::new(AtomicBool::new(false)))
    })
    .await
    .map_err(IpcError::task_failed(
        "The conversation task failed. Please try again.",
    ))?
    .map_err(IpcError::from)
}

#[tauri::command]
pub async fn retry_practice_turn(
    sessions: tauri::State<'_, SessionStore>,
    session_id: u64,
    sequence: usize,
    transcript: String,
) -> Result<AttemptComparison, IpcError> {
    blocking(sessions, TURN_TASK_FAILED, move |store| {
        store.retry_turn(session_id, sequence, transcript)
    })
    .await
}

#[tauri::command]
pub async fn start_practice_session(
    sessions: tauri::State<'_, SessionStore>,
    options: Option<StartPracticeOptions>,
) -> Result<PracticeSession, IpcError> {
    blocking(
        sessions,
        "Could not start the practice session. Please retry.",
        move |store| store.start_practice_session(options),
    )
    .await
}

#[tauri::command]
pub async fn start_mistake_practice(
    sessions: tauri::State<'_, SessionStore>,
) -> Result<PracticeSession, IpcError> {
    blocking(
        sessions,
        "The mistake practice task failed. Please retry.",
        |store| store.start_mistake_practice_with_source(&mut AgyMistakeQuestions),
    )
    .await
}

#[tauri::command]
pub async fn set_practice_clock(
    sessions: tauri::State<'_, SessionStore>,
    session_id: u64,
    running: bool,
) -> Result<PracticeSession, IpcError> {
    blocking(
        sessions,
        "Could not update the practice timer. Please retry.",
        move |store| store.set_practice_clock(session_id, running),
    )
    .await
}

#[tauri::command]
pub async fn transition_practice_phase(
    sessions: tauri::State<'_, SessionStore>,
    coaching: tauri::State<'_, CoachingQueue>,
    session_id: u64,
    phase: PracticePhase,
) -> Result<PracticeSession, IpcError> {
    let session = blocking(
        sessions,
        "Could not change the practice stage. Please retry.",
        move |store| store.transition_practice_phase(session_id, phase),
    )
    .await?;
    if phase.is_review() {
        coaching.flush(session_id);
    }
    Ok(session)
}

#[allow(clippy::too_many_arguments)]
#[tauri::command]
pub async fn send_practice_turn(
    sessions: tauri::State<'_, SessionStore>,
    coaching: tauri::State<'_, CoachingQueue>,
    ai_settings: tauri::State<'_, AiSettingsService>,
    apple: tauri::State<'_, AppleHelper>,
    session_id: u64,
    transcript: String,
    input_source: Option<InputSource>,
    answer_duration_ms: Option<u64>,
    on_reply: Channel<ReplyStreamEvent>,
) -> Result<ConversationTurn, IpcError> {
    let settings = saved_ai_settings(&ai_settings)?;
    let apple = apple.inner().clone();
    let turn = blocking(sessions, TURN_TASK_FAILED, move |store| {
        let mut engine = ConfiguredReplyEngine::new(settings, apple, on_reply);
        store.send_turn_with_engine(
            session_id,
            transcript,
            input_source.unwrap_or_default(),
            answer_duration_ms,
            &mut engine,
        )
    })
    .await?;
    coaching.answer_saved(session_id);
    Ok(turn)
}

#[tauri::command]
pub async fn cancel_practice_reply(
    sessions: tauri::State<'_, SessionStore>,
    session_id: u64,
) -> Result<bool, IpcError> {
    blocking(sessions, TURN_TASK_FAILED, move |store| {
        store.cancel_pending_reply(session_id)
    })
    .await
}

#[tauri::command]
pub async fn get_practice_dialogue(
    sessions: tauri::State<'_, SessionStore>,
    session_id: u64,
) -> Result<PracticeDialogue, IpcError> {
    blocking(
        sessions,
        "Could not load the conversation. Please retry.",
        move |store| store.dialogue(session_id),
    )
    .await
}

#[tauri::command]
pub async fn finish_practice_session(
    sessions: tauri::State<'_, SessionStore>,
    coaching: tauri::State<'_, CoachingQueue>,
    wrapup: tauri::State<'_, WrapupQueue>,
    session_id: u64,
) -> Result<FinishedPracticeSession, IpcError> {
    let summary = blocking(
        sessions,
        "Could not finish the practice session. Please retry.",
        move |store| store.finish(session_id),
    )
    .await?;
    coaching.flush(session_id);
    wrapup.wake();
    Ok(summary)
}

#[tauri::command]
pub async fn get_session_wrapup(
    sessions: tauri::State<'_, SessionStore>,
    session_id: u64,
) -> Result<FinishedPracticeSession, IpcError> {
    blocking(
        sessions,
        "Could not load the wrap-up. Please retry.",
        move |store| store.session_wrapup(session_id),
    )
    .await
}

#[tauri::command]
pub fn retry_session_wrapup(
    wrapup: tauri::State<'_, WrapupQueue>,
    session_id: u64,
) -> Result<(), IpcError> {
    wrapup.retry(session_id).map_err(IpcError::from)
}

#[tauri::command]
pub async fn save_wrapup_phrases(
    sessions: tauri::State<'_, SessionStore>,
    session_id: u64,
    phrases: Vec<String>,
) -> Result<SavedWrapupPhrases, IpcError> {
    blocking(
        sessions,
        "Could not save the phrases. Please retry.",
        move |store| store.save_wrapup_phrases(session_id, &phrases),
    )
    .await
}

#[tauri::command]
pub fn retry_answer_coaching(
    coaching: tauri::State<'_, CoachingQueue>,
    session_id: u64,
    sequence: usize,
) -> Result<(), IpcError> {
    coaching.retry(session_id, sequence).map_err(IpcError::from)
}

#[tauri::command]
pub async fn get_daily_recall_plan(
    sessions: tauri::State<'_, SessionStore>,
    session_id: u64,
) -> Result<DailyRecallPlan, IpcError> {
    blocking(
        sessions,
        "Could not prepare phrase recall. Please retry.",
        move |store| store.daily_recall_plan(session_id),
    )
    .await
}

#[tauri::command]
pub async fn submit_daily_recall(
    sessions: tauri::State<'_, SessionStore>,
    session_id: u64,
    phrase_id: u64,
    transcript: String,
) -> Result<SpokenRecallResult, IpcError> {
    blocking(
        sessions,
        "Could not save the recall answer. Please retry.",
        move |store| store.submit_daily_recall(session_id, phrase_id, transcript),
    )
    .await
}

#[tauri::command]
pub async fn get_active_practice_session(
    sessions: tauri::State<'_, SessionStore>,
) -> Result<Option<PracticeSession>, IpcError> {
    blocking(
        sessions,
        "Could not load the practice session. Please retry.",
        |store| store.get_active(),
    )
    .await
}

#[tauri::command]
pub async fn record_answer_help_used(
    sessions: tauri::State<'_, SessionStore>,
    session_id: u64,
    sequence: usize,
) -> Result<(), IpcError> {
    blocking(
        sessions,
        "Could not record the help you used. Please retry.",
        move |store| store.record_answer_help_used(session_id, sequence),
    )
    .await
}

#[tauri::command]
pub async fn get_guided_answer(
    sessions: tauri::State<'_, SessionStore>,
    session_id: u64,
    sequence: usize,
    question: String,
) -> Result<GuidedAnswer, IpcError> {
    blocking(
        sessions,
        "Could not prepare an answer example. Please retry.",
        move |store| {
            store.guided_answer(
                session_id,
                sequence,
                &question,
                providers::generate_guided_answer,
            )
        },
    )
    .await
}

#[tauri::command(rename_all = "snake_case")]
pub async fn rescue_answer(
    sessions: tauri::State<'_, SessionStore>,
    session_id: u64,
    sequence: usize,
    request: RescueRequest,
) -> Result<RescueResponse, IpcError> {
    blocking(
        sessions,
        "Could not prepare rescue help. Keep speaking and try Stuck again.",
        move |store| {
            store.rescue_answer(session_id, sequence, &request, providers::generate_rescue)
        },
    )
    .await
}

#[tauri::command(rename_all = "snake_case")]
pub async fn prefetch_answer_plan(
    sessions: tauri::State<'_, SessionStore>,
    session_id: u64,
    sequence: usize,
    question: String,
    retry: Option<bool>,
) -> Result<AnswerPlan, IpcError> {
    blocking(
        sessions,
        "Could not prepare this answer plan. Retry help or keep speaking.",
        move |store| {
            store.answer_plan(
                session_id,
                sequence,
                &question,
                retry.unwrap_or(false),
                providers::generate_answer_plan,
            )
        },
    )
    .await
}

#[tauri::command]
pub fn get_question_scaffold(question: String) -> QuestionScaffold {
    super::question_scaffold(&question)
}
