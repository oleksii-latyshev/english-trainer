use super::domain::{TranslationError, TranslationErrorCode};
use super::helper_process::{invalid_output, process_failed, HelperRequest, ReapOnDrop};
use std::io::{BufRead, BufReader, Read, Write};
use std::path::PathBuf;
use std::process::{ChildStdin, Command, Stdio};
use std::sync::mpsc::{Receiver, RecvTimeoutError};
use std::sync::{Arc, Mutex, PoisonError};
use std::time::Duration;

const MAX_LINE_BYTES: usize = 16 * 1024;

type Line = Result<Vec<u8>, ()>;

struct RunningHelper {
    child: ReapOnDrop,
    input: ChildStdin,
    lines: Receiver<Line>,
}

#[derive(Clone)]
pub(super) struct WarmWorker {
    binary: Option<PathBuf>,
    role: &'static str,
    running: Arc<Mutex<Option<RunningHelper>>>,
}

impl WarmWorker {
    pub(super) fn new(binary: Option<PathBuf>, role: &'static str) -> Self {
        Self {
            binary,
            role,
            running: Arc::new(Mutex::new(None)),
        }
    }

    pub(super) fn start(&self) -> Result<(), TranslationError> {
        let mut running = self.lock();
        self.ensure_running(&mut running)
    }

    pub(super) fn call(
        &self,
        request: &HelperRequest<'_>,
        timeout: Duration,
    ) -> Result<serde_json::Value, TranslationError> {
        let mut line = serde_json::to_vec(request).map_err(|_| invalid_output())?;
        line.push(b'\n');
        let mut running = self.lock();
        self.ensure_running(&mut running)?;
        let helper = running.as_mut().ok_or_else(process_failed)?;
        let outcome = helper.exchange(&line, timeout);
        if outcome.is_err() {
            *running = None;
        }
        outcome
    }

    fn lock(&self) -> std::sync::MutexGuard<'_, Option<RunningHelper>> {
        self.running.lock().unwrap_or_else(PoisonError::into_inner)
    }

    fn ensure_running(&self, running: &mut Option<RunningHelper>) -> Result<(), TranslationError> {
        if !running.as_mut().is_some_and(RunningHelper::is_alive) {
            *running = Some(self.spawn()?);
        }
        Ok(())
    }

    fn spawn(&self) -> Result<RunningHelper, TranslationError> {
        let binary = self.binary.as_ref().ok_or_else(|| {
            TranslationError::new(
                TranslationErrorCode::Unavailable,
                "The bundled translation helper is unavailable. Reinstall the app and try again.",
            )
        })?;
        if !binary.is_file() {
            return Err(TranslationError::new(
                TranslationErrorCode::Unavailable,
                "The bundled translation helper is missing. Reinstall the app and try again.",
            ));
        }
        let child = Command::new(binary)
            .args(["serve", self.role])
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .spawn()
            .map_err(|_| process_failed())?;
        let mut child = ReapOnDrop::new(child);
        let input = child.child.stdin.take().ok_or_else(process_failed)?;
        let stdout = child.child.stdout.take().ok_or_else(process_failed)?;
        let (sender, lines) = std::sync::mpsc::channel();
        std::thread::spawn(move || {
            let mut reader = BufReader::new(stdout);
            loop {
                let line = read_capped_line(&mut reader);
                let is_last = line.is_err();
                if sender.send(line).is_err() || is_last {
                    break;
                }
            }
        });
        Ok(RunningHelper {
            child,
            input,
            lines,
        })
    }
}

impl RunningHelper {
    fn is_alive(&mut self) -> bool {
        matches!(self.child.try_wait(), Ok(None))
    }

    fn exchange(
        &mut self,
        line: &[u8],
        timeout: Duration,
    ) -> Result<serde_json::Value, TranslationError> {
        discard_unread_lines(&self.lines);
        self.input
            .write_all(line)
            .and_then(|_| self.input.flush())
            .map_err(|_| process_failed())?;
        match self.lines.recv_timeout(timeout) {
            Ok(Ok(answer)) => serde_json::from_slice(&answer).map_err(|_| invalid_output()),
            Ok(Err(())) | Err(RecvTimeoutError::Disconnected) => Err(process_failed()),
            Err(RecvTimeoutError::Timeout) => Err(TranslationError::new(
                TranslationErrorCode::Timeout,
                "Translation took too long. Please try again.",
            )),
        }
    }
}

fn discard_unread_lines(lines: &Receiver<Line>) {
    while lines.try_recv().is_ok() {}
}

fn read_capped_line(reader: &mut impl BufRead) -> Line {
    let mut line = Vec::new();
    let read = reader
        .by_ref()
        .take((MAX_LINE_BYTES + 1) as u64)
        .read_until(b'\n', &mut line)
        .map_err(|_| ())?;
    if read == 0 || line.len() > MAX_LINE_BYTES || line.last() != Some(&b'\n') {
        return Err(());
    }
    Ok(line)
}
