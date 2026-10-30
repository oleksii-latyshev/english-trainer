use super::domain::practice::{ExerciseView, InputKind, RunKind, RunView};
use super::domain::rules::RuleKey;
use super::domain::view::{MistakeDetail, MistakeGroups, RuleCardView};
use super::{MistakesService, PracticeService};
use crate::core::IpcError;

#[tauri::command]
pub async fn list_mistake_groups(
    service: tauri::State<'_, MistakesService>,
) -> Result<MistakeGroups, IpcError> {
    let service = service.inner().clone();
    tauri::async_runtime::spawn_blocking(move || service.groups())
        .await
        .map_err(IpcError::task_failed("Could not read your mistakes."))?
        .map_err(IpcError::from)
}

#[tauri::command]
pub async fn get_mistake(
    service: tauri::State<'_, MistakesService>,
    id: u64,
) -> Result<MistakeDetail, IpcError> {
    let service = service.inner().clone();
    tauri::async_runtime::spawn_blocking(move || service.mistake(id))
        .await
        .map_err(IpcError::task_failed("Could not read that mistake."))?
        .map_err(IpcError::from)
}

#[tauri::command]
pub async fn get_rule_card(
    service: tauri::State<'_, MistakesService>,
    rule_key: RuleKey,
) -> Result<RuleCardView, IpcError> {
    let service = service.inner().clone();
    tauri::async_runtime::spawn_blocking(move || service.rule_card(rule_key))
        .await
        .map_err(IpcError::task_failed("Could not read that rule."))?
        .map_err(IpcError::from)
}

#[tauri::command]
pub async fn archive_mistake(
    service: tauri::State<'_, MistakesService>,
    id: u64,
) -> Result<(), IpcError> {
    let service = service.inner().clone();
    tauri::async_runtime::spawn_blocking(move || service.archive(id))
        .await
        .map_err(IpcError::task_failed("Could not archive that mistake."))?
        .map_err(IpcError::from)
}

#[tauri::command]
pub async fn retry_mistake_lesson(
    service: tauri::State<'_, MistakesService>,
    id: u64,
) -> Result<(), IpcError> {
    let service = service.inner().clone();
    tauri::async_runtime::spawn_blocking(move || service.retry_lesson(id))
        .await
        .map_err(IpcError::task_failed("Could not retry that lesson."))?
        .map_err(IpcError::from)
}

fn spawn_check(service: PracticeService, attempt_id: u64) {
    drop(tauri::async_runtime::spawn_blocking(move || {
        if let Err(error) = service.run_check(attempt_id) {
            crate::diagnostics::log(
                "mistakes",
                format_args!("Mistake check {attempt_id} did not finish: {error}"),
            );
        }
    }));
}

#[tauri::command]
pub async fn start_mistake_run(
    service: tauri::State<'_, PracticeService>,
    kind: RunKind,
    id: Option<u64>,
    rule_key: Option<RuleKey>,
) -> Result<RunView, IpcError> {
    let service = service.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        service.start(PracticeService::target(kind, id, rule_key)?)
    })
    .await
    .map_err(IpcError::task_failed("Could not start the practice."))?
    .map_err(IpcError::from)
}

#[tauri::command]
pub async fn get_mistake_run(
    service: tauri::State<'_, PracticeService>,
    run_id: u64,
) -> Result<RunView, IpcError> {
    let service = service.inner().clone();
    tauri::async_runtime::spawn_blocking(move || service.run(run_id))
        .await
        .map_err(IpcError::task_failed("Could not read the practice."))?
        .map_err(IpcError::from)
}

#[tauri::command]
pub async fn answer_mistake_step(
    service: tauri::State<'_, PracticeService>,
    run_id: u64,
    position: u32,
    answer: String,
    input: InputKind,
) -> Result<ExerciseView, IpcError> {
    let service = service.inner().clone();
    let background = service.clone();
    let answered = tauri::async_runtime::spawn_blocking(move || {
        service.answer(run_id, position, &answer, input)
    })
    .await
    .map_err(IpcError::task_failed("Could not save your answer."))?
    .map_err(IpcError::from)?;
    if let Some(attempt_id) = answered.check {
        spawn_check(background, attempt_id);
    }
    Ok(answered.exercise)
}

#[tauri::command]
pub async fn check_mistake_answer(
    service: tauri::State<'_, PracticeService>,
    run_id: u64,
    position: u32,
) -> Result<ExerciseView, IpcError> {
    let service = service.inner().clone();
    let background = service.clone();
    let answered =
        tauri::async_runtime::spawn_blocking(move || service.request_check(run_id, position))
            .await
            .map_err(IpcError::task_failed("Could not start the check."))?
            .map_err(IpcError::from)?;
    if let Some(attempt_id) = answered.check {
        spawn_check(background, attempt_id);
    }
    Ok(answered.exercise)
}

#[tauri::command]
pub async fn retry_mistake_check(
    service: tauri::State<'_, PracticeService>,
    attempt_id: u64,
) -> Result<(), IpcError> {
    let service = service.inner().clone();
    let background = service.clone();
    let id = tauri::async_runtime::spawn_blocking(move || service.retry_check(attempt_id))
        .await
        .map_err(IpcError::task_failed("Could not retry the check."))?
        .map_err(IpcError::from)?;
    if let Some(id) = id {
        spawn_check(background, id);
    }
    Ok(())
}

#[tauri::command]
pub async fn finish_mistake_run(
    service: tauri::State<'_, PracticeService>,
    run_id: u64,
) -> Result<RunView, IpcError> {
    let service = service.inner().clone();
    tauri::async_runtime::spawn_blocking(move || service.finish(run_id))
        .await
        .map_err(IpcError::task_failed("Could not finish the practice."))?
        .map_err(IpcError::from)
}
