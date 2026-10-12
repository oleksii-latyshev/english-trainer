use super::TranslationSettingsService;
use crate::core::IpcError;
use crate::translation::{NativeLanguageSettings, TranslationStatus};

#[tauri::command(rename_all = "snake_case")]
pub async fn get_translation_settings(
    service: tauri::State<'_, TranslationSettingsService>,
) -> Result<NativeLanguageSettings, IpcError> {
    let service = service.inner().clone();
    tauri::async_runtime::spawn_blocking(move || service.get())
        .await
        .map_err(IpcError::task_failed(
            "Could not read the translation settings.",
        ))?
        .map_err(IpcError::from)
}

#[tauri::command(rename_all = "snake_case")]
pub async fn save_translation_settings(
    service: tauri::State<'_, TranslationSettingsService>,
    settings: NativeLanguageSettings,
) -> Result<NativeLanguageSettings, IpcError> {
    let service = service.inner().clone();
    tauri::async_runtime::spawn_blocking(move || service.save(settings))
        .await
        .map_err(IpcError::task_failed(
            "Could not save the translation settings.",
        ))?
        .map_err(IpcError::from)
}

#[tauri::command(rename_all = "snake_case")]
pub async fn get_translation_status(
    service: tauri::State<'_, TranslationSettingsService>,
) -> Result<TranslationStatus, IpcError> {
    let service = service.inner().clone();
    tauri::async_runtime::spawn_blocking(move || service.status())
        .await
        .map_err(IpcError::task_failed(
            "Could not check translation availability. Please retry.",
        ))?
        .map_err(IpcError::from)
}

#[tauri::command(rename_all = "snake_case")]
pub async fn prepare_translation_languages(
    service: tauri::State<'_, TranslationSettingsService>,
) -> Result<TranslationStatus, IpcError> {
    let service = service.inner().clone();
    tauri::async_runtime::spawn_blocking(move || service.prepare())
        .await
        .map_err(IpcError::task_failed(
            "Could not prepare translation languages. Please retry.",
        ))?
        .map_err(IpcError::from)
}
