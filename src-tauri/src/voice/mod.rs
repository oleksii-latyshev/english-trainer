//! Local speech inference is independent of the conversation/session locks.
mod process;
#[cfg(test)]
mod tests;
mod wave;

use process::Running;
use serde::Serialize;
use std::{
    path::PathBuf,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    },
    time::Duration,
};
use ts_rs::TS;

#[derive(Debug, Serialize, PartialEq, TS)]
#[serde(rename_all = "snake_case")]
#[ts(export)]
pub enum VoiceErrorCode {
    Unavailable,
    Busy,
    InvalidInput,
    Timeout,
    ProcessFailed,
}
#[derive(Debug, Serialize, TS)]
#[ts(export)]
pub struct VoiceError {
    pub code: VoiceErrorCode,
    pub message: String,
}
impl VoiceError {
    fn new(code: VoiceErrorCode) -> Self {
        Self {
            code,
            message: "Local voice could not play. Use the system voice or try again.".into(),
        }
    }
}

#[derive(Clone)]
pub struct VoiceEngine {
    directory: Option<PathBuf>,
    running: Arc<Mutex<Option<Running>>>,
    ready: Arc<AtomicBool>,
}
impl VoiceEngine {
    pub fn new(directory: Option<PathBuf>) -> Self {
        Self {
            directory,
            running: Arc::new(Mutex::new(None)),
            ready: Arc::new(AtomicBool::new(false)),
        }
    }
    pub fn prewarm(&self) -> Result<bool, VoiceError> {
        let mut slot = self.running.lock().unwrap_or_else(|p| p.into_inner());
        if self.ready.load(Ordering::Acquire) {
            return Ok(true);
        }
        let directory = self
            .directory
            .as_ref()
            .filter(|p| p.join("speech").is_file());
        let Some(directory) = directory else {
            return Ok(false);
        };
        let mut running = Running::spawn(directory)?;
        running.request("Hi!", 0, 1.0, Duration::from_secs(3))?;
        *slot = Some(running);
        self.ready.store(true, Ordering::Release);
        Ok(true)
    }
    pub fn synthesize(&self, text: &str, voice_id: u32, speed: f32) -> Result<Vec<u8>, VoiceError> {
        validate(text, voice_id, speed)?;
        let mut slot = self
            .running
            .try_lock()
            .map_err(|_| VoiceError::new(VoiceErrorCode::Busy))?;
        let Some(running) = slot.as_mut() else {
            return Err(VoiceError::new(VoiceErrorCode::Unavailable));
        };
        let result = running
            .request(text, voice_id, speed, Duration::from_millis(750))
            .and_then(wave::trim_padding);
        if result.is_err() {
            self.ready.store(false, Ordering::Release);
            *slot = None; // Drop kills a stalled/crashed helper and joins its stdout reader.
        }
        result
    }
}
fn validate(text: &str, voice_id: u32, speed: f32) -> Result<(), VoiceError> {
    if text.trim().is_empty()
        || text.len() > 4096
        || text.contains('\0')
        || voice_id > 9
        || !speed.is_finite()
        || !(0.85..=1.2).contains(&speed)
    {
        return Err(VoiceError::new(VoiceErrorCode::InvalidInput));
    }
    Ok(())
}

#[tauri::command]
pub async fn prewarm_natural_voice(
    engine: tauri::State<'_, VoiceEngine>,
) -> Result<bool, VoiceError> {
    let engine = engine.inner().clone();
    tauri::async_runtime::spawn_blocking(move || engine.prewarm())
        .await
        .map_err(|_| VoiceError::new(VoiceErrorCode::ProcessFailed))?
}
#[tauri::command(rename_all = "snake_case")]
pub async fn synthesize_natural_voice(
    engine: tauri::State<'_, VoiceEngine>,
    text: String,
    voice_id: u32,
    speed: f32,
) -> Result<tauri::ipc::Response, VoiceError> {
    let engine = engine.inner().clone();
    tauri::async_runtime::spawn_blocking(move || engine.synthesize(&text, voice_id, speed))
        .await
        .map_err(|_| VoiceError::new(VoiceErrorCode::ProcessFailed))?
        .map(tauri::ipc::Response::new)
}
