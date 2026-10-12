use super::{TranslationError, TranslationRequest, TranslationResult, TranslationService};
use crate::conversation::SessionStore;

#[tauri::command(rename_all = "snake_case")]
pub(crate) async fn translate_word(
    sessions: tauri::State<'_, SessionStore>,
    translation: tauri::State<'_, TranslationService>,
    request: TranslationRequest,
) -> Result<TranslationResult, TranslationError> {
    let prepared = sessions.prepare_translation_lookup(request)?;
    let translation = translation.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        translation.translate(&prepared.request, &prepared.native_language)
    })
    .await
    .map_err(|_| {
        TranslationError::new(
            super::TranslationErrorCode::ProcessFailed,
            "The translation task failed. Please retry.",
        )
    })?
}
