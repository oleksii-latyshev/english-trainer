use super::{TextExplanation, TextTranslation, TranslationRequest, TranslationService};
use crate::conversation::SessionStore;
use crate::core::IpcError;

#[tauri::command(rename_all = "snake_case")]
pub(crate) async fn translate_text(
    sessions: tauri::State<'_, SessionStore>,
    translation: tauri::State<'_, TranslationService>,
    request: TranslationRequest,
) -> Result<TextTranslation, IpcError> {
    let prepared = sessions.prepare_translation_lookup(request)?;
    let translation = translation.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        translation.translate(&prepared.request, &prepared.native_language)
    })
    .await
    .map_err(IpcError::task_failed(
        "The translation task failed. Please retry.",
    ))?
    .map_err(IpcError::from)
}

#[tauri::command(rename_all = "snake_case")]
pub(crate) async fn explain_text(
    sessions: tauri::State<'_, SessionStore>,
    translation: tauri::State<'_, TranslationService>,
    request: TranslationRequest,
) -> Result<TextExplanation, IpcError> {
    let prepared = sessions.prepare_explanation_lookup(request)?;
    let translation = translation.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        translation.explain(&prepared.request, &prepared.native_language)
    })
    .await
    .map_err(IpcError::task_failed(
        "The explanation task failed. Please retry.",
    ))?
    .map_err(IpcError::from)
}
