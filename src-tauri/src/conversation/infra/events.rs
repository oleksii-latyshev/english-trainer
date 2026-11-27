use crate::conversation::service::coaching_queue::CoachingEvent;
use tauri::{AppHandle, Emitter};

pub fn coaching_notifier(handle: AppHandle) -> impl Fn(CoachingEvent) + Send + Sync + 'static {
    move |event| ignore_closed_window(handle.emit("coaching-updated", event))
}

fn ignore_closed_window(result: tauri::Result<()>) {
    drop(result);
}
