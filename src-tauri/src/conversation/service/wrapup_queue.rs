use super::SessionStore;
use crate::conversation::domain::WrapupEvent;
use crate::conversation::ports::{WrapupGenerator, WrapupNotifier};
use crate::providers::{ProviderError, WrapupResult};
use std::sync::{Arc, Condvar, Mutex};

struct Control {
    is_awake: bool,
    is_stopped: bool,
}
struct Shared {
    store: SessionStore,
    generate: Box<dyn WrapupGenerator>,
    notify: Box<dyn WrapupNotifier>,
    control: Mutex<Control>,
    wake: Condvar,
}

pub struct WrapupQueue {
    shared: Arc<Shared>,
}
impl WrapupQueue {
    pub fn start(
        store: SessionStore,
        generator: impl WrapupGenerator + 'static,
        notifier: impl WrapupNotifier + 'static,
    ) -> std::io::Result<Self> {
        let shared = Arc::new(Shared {
            store,
            generate: Box::new(generator),
            notify: Box::new(notifier),
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
                    self.generate.generate(&request)
                };
                match self
                    .store
                    .complete_session_wrapup(session_id, &request, result)
                {
                    Ok(true) => self.notify.notify(WrapupEvent { session_id }),
                    Ok(false) => {}
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
