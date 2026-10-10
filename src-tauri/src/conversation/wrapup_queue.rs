use super::SessionStore;
use crate::providers::{ProviderError, WrapupRequest, WrapupResult};
use serde::Serialize;
use std::sync::{Arc, Condvar, Mutex};

#[derive(Debug, Clone, Copy, Serialize)]
pub struct WrapupEvent {
    pub session_id: u64,
}

type Generate = dyn Fn(&WrapupRequest) -> Result<WrapupResult, ProviderError> + Send + Sync;
type Notify = dyn Fn(WrapupEvent) + Send + Sync;
struct Control {
    is_awake: bool,
    is_stopped: bool,
}
struct Shared {
    store: SessionStore,
    generate: Box<Generate>,
    notify: Box<Notify>,
    control: Mutex<Control>,
    wake: Condvar,
}

/// One worker consumes durable finished-session jobs; generation never owns a session lock.
pub struct WrapupQueue {
    shared: Arc<Shared>,
}
impl WrapupQueue {
    pub fn start(
        store: SessionStore,
        generate: impl Fn(&WrapupRequest) -> Result<WrapupResult, ProviderError> + Send + Sync + 'static,
        notify: impl Fn(WrapupEvent) + Send + Sync + 'static,
    ) -> std::io::Result<Self> {
        let shared = Arc::new(Shared {
            store,
            generate: Box::new(generate),
            notify: Box::new(notify),
            control: Mutex::new(Control {
                is_awake: true,
                is_stopped: false,
            }),
            wake: Condvar::new(),
        });
        let worker = shared.clone();
        std::thread::Builder::new()
            .name("session-wrapup".into())
            .spawn(move || worker.run())?;
        Ok(Self { shared })
    }

    pub fn wake(&self) {
        self.shared
            .control
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .is_awake = true;
        self.shared.wake.notify_one();
    }

    pub fn retry(&self, session_id: u64) -> Result<(), ProviderError> {
        self.shared.store.retry_session_wrapup(session_id)?;
        self.wake();
        Ok(())
    }
}

impl Shared {
    fn run(&self) {
        loop {
            let mut control = self
                .control
                .lock()
                .unwrap_or_else(|error| error.into_inner());
            while !control.is_awake && !control.is_stopped {
                control = self
                    .wake
                    .wait(control)
                    .unwrap_or_else(|error| error.into_inner());
            }
            if control.is_stopped {
                return;
            }
            control.is_awake = false;
            drop(control);
            loop {
                if self
                    .control
                    .lock()
                    .unwrap_or_else(|error| error.into_inner())
                    .is_stopped
                {
                    return;
                }
                let job = match self.store.next_wrapup_request() {
                    Ok(Some(job)) => job,
                    Ok(None) => break,
                    Err(_) => {
                        eprintln!(
                            "Could not read pending session phrases; the next wake will retry."
                        );
                        break;
                    }
                };
                let (session_id, request) = job;
                let result = if request.answers.is_empty() {
                    Ok(WrapupResult {
                        phrases: Vec::new(),
                    })
                } else {
                    (self.generate)(&request)
                };
                match self
                    .store
                    .complete_session_wrapup(session_id, &request, result)
                {
                    Ok(true) => (self.notify)(WrapupEvent { session_id }),
                    Ok(false) => {} // Deleted jobs cannot be revived by a late provider result.
                    Err(_) => {
                        eprintln!("Could not save session phrases; the next wake will retry.");
                        break;
                    }
                }
            }
        }
    }
}

impl Drop for WrapupQueue {
    fn drop(&mut self) {
        self.shared
            .control
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .is_stopped = true;
        self.shared.wake.notify_one();
    }
}

#[cfg(test)]
#[path = "wrapup_queue_tests.rs"]
mod tests;
