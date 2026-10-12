use super::{PersonalProfile, PersonalProfileService};
use crate::core::IpcError;

#[tauri::command]
pub async fn get_personal_profile(
    service: tauri::State<'_, PersonalProfileService>,
) -> Result<PersonalProfile, IpcError> {
    let service = service.inner().clone();
    tauri::async_runtime::spawn_blocking(move || service.get())
        .await
        .map_err(IpcError::task_failed("Could not read your profile."))?
        .map_err(IpcError::from)
}

#[tauri::command]
pub async fn save_personal_profile(
    service: tauri::State<'_, PersonalProfileService>,
    profile: PersonalProfile,
) -> Result<PersonalProfile, IpcError> {
    let service = service.inner().clone();
    tauri::async_runtime::spawn_blocking(move || service.save(profile))
        .await
        .map_err(IpcError::task_failed("Could not save your profile."))?
        .map_err(IpcError::from)
}
