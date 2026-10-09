use super::{
    NativeLanguageSettings, TranslationError, TranslationRequest, TranslationResult,
    TranslationService, TranslationStatus,
};
use crate::conversation::SessionStore;

#[tauri::command(rename_all = "snake_case")]
pub(crate) fn get_translation_settings(
    sessions: tauri::State<'_, SessionStore>,
) -> Result<NativeLanguageSettings, TranslationError> {
    sessions.translation_settings()
}

#[tauri::command(rename_all = "snake_case")]
pub(crate) fn save_translation_settings(
    sessions: tauri::State<'_, SessionStore>,
    settings: NativeLanguageSettings,
) -> Result<NativeLanguageSettings, TranslationError> {
    sessions.save_translation_settings(settings)
}

#[tauri::command(rename_all = "snake_case")]
pub(crate) async fn get_translation_status(
    sessions: tauri::State<'_, SessionStore>,
    translation: tauri::State<'_, TranslationService>,
) -> Result<TranslationStatus, TranslationError> {
    let native_language = sessions.translation_settings()?.native_language;
    let translation = translation.inner().clone();
    tauri::async_runtime::spawn_blocking(move || translation.status(&native_language))
        .await
        .map_err(|_| {
            TranslationError::new(
                super::TranslationErrorCode::ProcessFailed,
                "Could not check translation availability. Please retry.",
            )
        })?
}

#[tauri::command(rename_all = "snake_case")]
pub(crate) async fn prepare_translation_languages(
    sessions: tauri::State<'_, SessionStore>,
    translation: tauri::State<'_, TranslationService>,
) -> Result<TranslationStatus, TranslationError> {
    let native_language = sessions.translation_settings()?.native_language;
    let translation = translation.inner().clone();
    tauri::async_runtime::spawn_blocking(move || translation.prepare(&native_language))
        .await
        .map_err(|_| {
            TranslationError::new(
                super::TranslationErrorCode::ProcessFailed,
                "Could not prepare translation languages. Please retry.",
            )
        })?
}

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
