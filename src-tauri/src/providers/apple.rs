//! Apple Foundation Models adapter: one long-lived helper process per app run,
//! speaking JSON lines over stdin/stdout.

use super::{
    agy::conversation::validate_context,
    plain_prompt,
    race::{Event, Leg},
    reply_text::plain_turn,
    ConversationContext, ConversationTurn, ProviderError, ProviderErrorCode,
};
use serde::{Deserialize, Serialize};
use std::{
    io::{BufRead, BufReader, Write},
    path::PathBuf,
    process::{Child, ChildStdin, Command, Stdio},
    sync::{
        mpsc::{self, Receiver, RecvTimeoutError},
        Arc, Mutex, MutexGuard,
    },
    thread,
    time::{Duration, Instant},
};

const REQUEST_TIMEOUT: Duration = Duration::from_secs(20);

#[derive(Serialize)]
struct HelperRequest<'a> {
    id: u64,
    instructions: &'a str,
    prompt: &'a str,
}

#[derive(Deserialize)]
struct HelperEvent {
    id: u64,
    #[serde(flatten)]
    kind: EventKind,
}

#[derive(Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
enum EventKind {
    Delta {
        text: String,
    },
    Done,
    Error {
        code: ProviderErrorCode,
        message: String,
    },
}

struct Running {
    child: Child,
    stdin: ChildStdin,
    events: Receiver<HelperEvent>,
    next_id: u64,
}

impl Drop for Running {
    fn drop(&mut self) {
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}

/// Handle to the lazily started helper; cheap to clone, one request at a time.
#[derive(Clone)]
pub struct AppleHelper {
    binary: Option<PathBuf>,
    running: Arc<Mutex<Option<Running>>>,
}

impl AppleHelper {
    pub fn new(binary: Option<PathBuf>) -> Self {
        Self {
            binary,
            running: Arc::new(Mutex::new(None)),
        }
    }

    pub fn prewarm(&self) -> Result<(), ProviderError> {
        let mut running = self.lock();
        if running.is_none() {
            *running = Some(self.spawn()?);
        }
        Ok(())
    }

    pub(super) fn generate_turn(
        &self,
        context: &ConversationContext,
        on_delta: &mut dyn FnMut(&str),
    ) -> Result<ConversationTurn, ProviderError> {
        plain_turn(&self.stream_reply(context, on_delta)?)
    }

    /// The on-device reply as a race leg, used when the chosen cloud provider stalls.
    pub(super) fn backup_leg(&self, context: ConversationContext) -> Leg {
        let helper = self.clone();
        Box::new(move |emit| {
            // A leg that lost the race still finishes its short reply; the helper stays usable.
            let finished = helper.stream_reply(&context, &mut |text| {
                emit(Event::Delta(text.to_string()));
            });
            emit(match finished {
                Ok(_) => Event::Done,
                Err(error) => Event::Failed {
                    error,
                    is_retryable: false,
                },
            });
        })
    }

    fn stream_reply(
        &self,
        context: &ConversationContext,
        on_delta: &mut dyn FnMut(&str),
    ) -> Result<String, ProviderError> {
        validate_context(context)?;
        let instructions = plain_prompt::instructions(context);
        let prompt = plain_prompt::transcript_prompt(context);
        let mut running = self.lock();
        for attempt in 0..2 {
            if running.is_none() {
                *running = Some(self.spawn()?);
            }
            let helper = running.as_mut().expect("helper was just started");
            match helper.request(&instructions, &prompt, on_delta) {
                Ok(text) => return Ok(text),
                Err(Failure::Died) if attempt == 0 => *running = None,
                Err(Failure::Died) => return Err(died_error()),
                Err(Failure::Reported(error)) => return Err(error),
                Err(Failure::TimedOut) => {
                    *running = None;
                    return Err(ProviderError::new(
                        ProviderErrorCode::Timeout,
                        "Apple took too long to answer. Retry or choose Gemini in Settings.",
                    ));
                }
            }
        }
        Err(died_error())
    }

    fn lock(&self) -> MutexGuard<'_, Option<Running>> {
        self.running
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
    }

    fn spawn(&self) -> Result<Running, ProviderError> {
        let binary = self
            .binary
            .as_ref()
            .filter(|binary| binary.is_file())
            .ok_or_else(|| {
                ProviderError::new(
                    ProviderErrorCode::Unavailable,
                    "The bundled Apple conversation helper was not found. Reinstall the app or choose Gemini.",
                )
            })?;
        let mut child = Command::new(binary)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .spawn()
            .map_err(|_| {
                ProviderError::new(
                    ProviderErrorCode::ProcessFailed,
                    "Could not start the Apple conversation helper. Retry or choose Gemini.",
                )
            })?;
        let (Some(stdin), Some(stdout)) = (child.stdin.take(), child.stdout.take()) else {
            let _ = child.kill();
            return Err(died_error());
        };
        let (sender, events) = mpsc::channel();
        thread::spawn(move || {
            for line in BufReader::new(stdout).lines().map_while(Result::ok) {
                // Unparseable lines are ignored; a request then ends by timeout or exit.
                if let Ok(event) = serde_json::from_str::<HelperEvent>(&line) {
                    if sender.send(event).is_err() {
                        break;
                    }
                }
            }
        });
        Ok(Running {
            child,
            stdin,
            events,
            next_id: 1,
        })
    }
}

enum Failure {
    Died,
    TimedOut,
    Reported(ProviderError),
}

fn died_error() -> ProviderError {
    ProviderError::new(
        ProviderErrorCode::ProcessFailed,
        "The Apple conversation helper stopped unexpectedly. Retry or choose Gemini.",
    )
}

impl Running {
    fn request(
        &mut self,
        instructions: &str,
        prompt: &str,
        on_delta: &mut dyn FnMut(&str),
    ) -> Result<String, Failure> {
        let id = self.next_id;
        self.next_id += 1;
        let mut line = serde_json::to_string(&HelperRequest {
            id,
            instructions,
            prompt,
        })
        .map_err(|_| Failure::Died)?;
        line.push('\n');
        self.stdin
            .write_all(line.as_bytes())
            .and_then(|()| self.stdin.flush())
            .map_err(|_| Failure::Died)?;

        let deadline = Instant::now() + REQUEST_TIMEOUT;
        let mut reply = String::new();
        loop {
            let remaining = deadline.saturating_duration_since(Instant::now());
            let event = match self.events.recv_timeout(remaining) {
                Ok(event) => event,
                Err(RecvTimeoutError::Timeout) => return Err(Failure::TimedOut),
                Err(RecvTimeoutError::Disconnected) if reply.is_empty() => {
                    return Err(Failure::Died)
                }
                Err(RecvTimeoutError::Disconnected) => return Err(Failure::Reported(died_error())),
            };
            if event.id != id {
                continue;
            }
            match event.kind {
                EventKind::Delta { text } => {
                    on_delta(&text);
                    reply.push_str(&text);
                }
                EventKind::Done => return Ok(reply),
                EventKind::Error { code, message } => {
                    return Err(Failure::Reported(ProviderError::new(code, message)))
                }
            }
        }
    }
}

#[cfg(all(test, unix))]
#[path = "apple_tests.rs"]
mod tests;
