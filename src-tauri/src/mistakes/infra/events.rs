use crate::mistakes::domain::view::MistakesUpdated;
use crate::mistakes::ports::MistakesNotifier;
use tauri::{AppHandle, Emitter};

pub struct TauriMistakesNotifier {
    handle: AppHandle,
}

impl TauriMistakesNotifier {
    pub fn new(handle: AppHandle) -> Self {
        Self { handle }
    }
}

impl MistakesNotifier for TauriMistakesNotifier {
    fn updated(&self, lessons_ready: usize) {
        let event = MistakesUpdated {
            lessons_ready: u32::try_from(lessons_ready).unwrap_or(u32::MAX),
        };
        ignore_closed_window(self.handle.emit("mistakes-updated", event));
    }
}

fn ignore_closed_window(result: tauri::Result<()>) {
    drop(result);
}
