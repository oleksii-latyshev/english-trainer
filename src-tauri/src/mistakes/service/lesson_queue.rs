use super::lesson_worker::{BatchOutcome, LessonWorker};
use crate::mistakes::ports::LessonKick;
use std::sync::{Arc, Condvar, Mutex, MutexGuard};
use std::thread;
use std::time::{Duration, Instant};

pub const QUOTA_PAUSE: Duration = Duration::from_secs(30 * 60);

struct Control {
    is_kicked: bool,
    paused_until: Option<Instant>,
    is_shut_down: bool,
}

struct Shared {
    worker: LessonWorker,
    quota_pause: Duration,
    control: Mutex<Control>,
    wake: Condvar,
}

pub struct LessonQueue {
    shared: Arc<Shared>,
}

impl LessonQueue {
    pub fn start(worker: LessonWorker, quota_pause: Duration) -> std::io::Result<Self> {
        let shared = Arc::new(Shared {
            worker,
            quota_pause,
            control: Mutex::new(Control {
                is_kicked: true,
                paused_until: None,
                is_shut_down: false,
            }),
            wake: Condvar::new(),
        });
        let running = shared.clone();
        thread::Builder::new()
            .name("mistake-lessons".into())
            .spawn(move || running.run())?;
        Ok(Self { shared })
    }

    pub fn kicker(&self) -> Arc<dyn LessonKick> {
        self.shared.clone()
    }
}

impl LessonKick for LessonQueue {
    fn kick(&self) {
        self.shared.kick();
    }
}

impl Drop for LessonQueue {
    fn drop(&mut self) {
        self.shared.control().is_shut_down = true;
        self.shared.wake.notify_all();
    }
}

impl LessonKick for Shared {
    fn kick(&self) {
        self.control().is_kicked = true;
        self.wake.notify_all();
    }
}

impl Shared {
    fn control(&self) -> MutexGuard<'_, Control> {
        self.control
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
    }

    fn run(&self) {
        while self.wait_for_work() {
            match self.worker.run_batch() {
                Ok(BatchOutcome::Processed) => self.control().is_kicked = true,
                Ok(BatchOutcome::Idle) => {}
                Ok(BatchOutcome::QuotaPaused) => {
                    let mut control = self.control();
                    control.paused_until = Some(Instant::now() + self.quota_pause);
                    control.is_kicked = true;
                }
                Err(error) => crate::diagnostics::log(
                    "mistakes",
                    format_args!("Could not prepare mistake lessons: {error}"),
                ),
            }
        }
    }

    fn wait_for_work(&self) -> bool {
        let mut control = self.control();
        loop {
            if control.is_shut_down {
                return false;
            }
            let now = Instant::now();
            if let Some(until) = control.paused_until {
                if now < until {
                    control = self
                        .wake
                        .wait_timeout(control, until - now)
                        .unwrap_or_else(|poisoned| poisoned.into_inner())
                        .0;
                    continue;
                }
                control.paused_until = None;
            }
            if control.is_kicked {
                control.is_kicked = false;
                return true;
            }
            control = self
                .wake
                .wait(control)
                .unwrap_or_else(|poisoned| poisoned.into_inner());
        }
    }
}
