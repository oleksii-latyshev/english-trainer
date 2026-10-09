use super::domain::{TranslationError, TranslationErrorCode, TranslationRequest};
use serde::Serialize;
use std::io::{Read, Write};
use std::process::{Child, Command, Stdio};
use std::time::{Duration, Instant};

const MAX_STDIN_BYTES: usize = 2 * 1024;
const MAX_STDOUT_BYTES: usize = 16 * 1024;

pub(super) struct HelperOperation<'a> {
    pub(super) operation: &'a str,
    pub(super) native_language: &'a str,
    pub(super) request: Option<&'a TranslationRequest>,
    pub(super) timeout: Duration,
}

#[derive(Serialize)]
struct HelperRequest<'a> {
    operation: &'a str,
    native_language: &'a str,
    word: &'a str,
    context: &'a str,
}

pub(super) fn run_helper(
    binary: &std::path::Path,
    operation: HelperOperation<'_>,
) -> Result<serde_json::Value, TranslationError> {
    let input = serde_json::to_vec(&HelperRequest {
        operation: operation.operation,
        native_language: operation.native_language,
        word: operation
            .request
            .map(|request| request.word.as_str())
            .unwrap_or_default(),
        context: operation
            .request
            .map(|request| request.context.as_str())
            .unwrap_or_default(),
    })
    .map_err(|_| invalid_output())?;
    if input.len() > MAX_STDIN_BYTES {
        return Err(TranslationError::invalid_request());
    }

    let child = Command::new(binary)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|_| process_failed())?;
    let mut child = ReapOnDrop::new(child);
    let stdout = child.child.stdout.take().ok_or_else(process_failed)?;
    let (sender, receiver) = std::sync::mpsc::channel();
    let _reader = std::thread::spawn(move || {
        let mut output = Vec::new();
        let mut capped = stdout.take((MAX_STDOUT_BYTES + 1) as u64);
        let result = capped.read_to_end(&mut output).map(|_| output);
        let _ = sender.send(result);
    });
    let mut input_pipe = child.child.stdin.take().ok_or_else(process_failed)?;
    input_pipe.write_all(&input).map_err(|_| process_failed())?;
    drop(input_pipe);

    let deadline = Instant::now() + operation.timeout;
    loop {
        match receiver.try_recv() {
            Ok(Ok(output)) => {
                if output.len() > MAX_STDOUT_BYTES {
                    child.terminate();
                    return Err(invalid_output());
                }
                return wait_for_exit(&mut child, output, deadline);
            }
            Ok(Err(_)) | Err(std::sync::mpsc::TryRecvError::Disconnected) => {
                child.terminate();
                return Err(process_failed());
            }
            Err(std::sync::mpsc::TryRecvError::Empty) => {}
        }
        match child.try_wait() {
            Ok(Some(status)) => {
                if !status.success() {
                    return Err(process_failed());
                }
                let remaining = deadline.saturating_duration_since(Instant::now());
                let output = receiver
                    .recv_timeout(remaining.min(Duration::from_millis(100)))
                    .map_err(|_| invalid_output())?
                    .map_err(|_| process_failed())?;
                if output.len() > MAX_STDOUT_BYTES {
                    return Err(invalid_output());
                }
                return serde_json::from_slice(&output).map_err(|_| invalid_output());
            }
            Ok(None) if Instant::now() < deadline => {
                std::thread::sleep(Duration::from_millis(20));
            }
            Ok(None) => {
                child.terminate();
                return Err(TranslationError::new(
                    TranslationErrorCode::Timeout,
                    "Word translation took too long. Please try again.",
                ));
            }
            Err(_) => {
                child.terminate();
                return Err(process_failed());
            }
        }
    }
}

struct ReapOnDrop {
    child: Child,
    reaped: bool,
}

impl ReapOnDrop {
    fn new(child: Child) -> Self {
        Self {
            child,
            reaped: false,
        }
    }

    fn try_wait(&mut self) -> std::io::Result<Option<std::process::ExitStatus>> {
        let status = self.child.try_wait()?;
        self.reaped |= status.is_some();
        Ok(status)
    }

    fn terminate(&mut self) {
        if !self.reaped {
            let _ = self.child.kill();
            let _ = self.child.wait();
            self.reaped = true;
        }
    }
}

impl Drop for ReapOnDrop {
    fn drop(&mut self) {
        self.terminate();
    }
}

fn wait_for_exit(
    child: &mut ReapOnDrop,
    output: Vec<u8>,
    deadline: Instant,
) -> Result<serde_json::Value, TranslationError> {
    loop {
        match child.try_wait() {
            Ok(Some(status)) if status.success() => {
                return serde_json::from_slice(&output).map_err(|_| invalid_output());
            }
            Ok(Some(_)) => return Err(process_failed()),
            Ok(None) if Instant::now() < deadline => {
                std::thread::sleep(Duration::from_millis(20));
            }
            Ok(None) => {
                child.terminate();
                return Err(TranslationError::new(
                    TranslationErrorCode::Timeout,
                    "Word translation took too long. Please try again.",
                ));
            }
            Err(_) => return Err(process_failed()),
        }
    }
}

fn invalid_output() -> TranslationError {
    TranslationError::new(
        TranslationErrorCode::InvalidOutput,
        "The translation helper returned invalid data. Please retry.",
    )
}

fn process_failed() -> TranslationError {
    TranslationError::new(
        TranslationErrorCode::ProcessFailed,
        "The translation helper failed to complete the request. Please retry.",
    )
}
