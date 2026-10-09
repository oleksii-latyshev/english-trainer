//! A `whisper-server` child process that keeps the Whisper model loaded between answers.
//!
//! Loading a model costs 0.4 to 0.7 s on every `whisper-cli` run; the server pays it once, so an
//! answer is transcribed in about 0.3 s (small.en, measured) and the live transcript can re-run
//! the model every second and a half. The server listens on 127.0.0.1 only, on a free port.
use super::{without_annotations, Transcript, TranscriptionError, TranscriptionErrorCode};
use serde::{Deserialize, Serialize};
use std::{
    fs,
    net::{Ipv4Addr, SocketAddr, TcpListener, TcpStream},
    path::{Path, PathBuf},
    process::{Child, Command, Stdio},
    sync::{
        atomic::{AtomicBool, AtomicU32, Ordering},
        Mutex, MutexGuard, OnceLock,
    },
    thread,
    time::{Duration, Instant},
};

const START_TIMEOUT: Duration = Duration::from_secs(20);
const FINAL_TIMEOUT: Duration = Duration::from_secs(120);
/// A live update that takes longer than this is already stale.
const PARTIAL_TIMEOUT: Duration = Duration::from_secs(5);
/// A server that stops twice without answering in between is not restarted again.
const MAX_DEATHS_WITHOUT_ANSWER: u32 = 2;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum ServerState {
    Ready,
    Loading,
    NotRunning,
}

#[derive(Debug, Clone, PartialEq, Eq)]
enum Phase {
    Idle,
    Loading,
    Ready,
    /// Could not be started or keeps stopping; one-off runs are used instead.
    Failed(String),
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ServerStatus {
    pub state: ServerState,
    /// Why the server is not used, when it could not be started.
    pub failure: Option<String>,
}

/// Why a request could not be served by the loaded model.
#[derive(Debug, PartialEq, Eq)]
pub enum ServerError {
    /// The server cannot be used; the caller falls back to one-off runs.
    Unavailable(String),
    /// The server answered, but the audio gave no usable text (silence, bad output).
    Failed(TranscriptionError),
}

struct Running {
    child: Child,
    port: u16,
    model: PathBuf,
}

#[derive(Default)]
struct Inner {
    running: Option<Running>,
    /// A model that failed to start or keeps dying, with the reason; changing the model or a new
    /// session (`retry`) gives it another chance.
    given_up: Option<(PathBuf, String)>,
}

pub struct WhisperServer {
    inner: Mutex<Inner>,
    /// Read without waiting for a start in progress, so Settings can show "Loading…".
    phase: Mutex<Phase>,
    deaths: AtomicU32,
    reaped: AtomicBool,
    /// Where the child's pid is noted, so a server left behind by a crashed app is stopped.
    pid_file: Option<PathBuf>,
}

fn lock<T>(mutex: &Mutex<T>) -> MutexGuard<'_, T> {
    mutex
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
}

impl WhisperServer {
    pub fn new(pid_file: Option<PathBuf>) -> Self {
        Self {
            inner: Mutex::new(Inner::default()),
            phase: Mutex::new(Phase::Idle),
            deaths: AtomicU32::new(0),
            reaped: AtomicBool::new(false),
            pid_file,
        }
    }

    pub fn status(&self) -> ServerStatus {
        // A start in progress holds the main lock; the phase says so without waiting for it.
        if let Ok(mut inner) = self.inner.try_lock() {
            let has_died = inner
                .running
                .as_mut()
                .is_some_and(|run| !matches!(run.child.try_wait(), Ok(None)));
            if has_died {
                *lock(&self.phase) = Phase::Idle;
            }
        }
        match &*lock(&self.phase) {
            Phase::Ready => ServerStatus {
                state: ServerState::Ready,
                failure: None,
            },
            Phase::Loading => ServerStatus {
                state: ServerState::Loading,
                failure: None,
            },
            Phase::Idle => ServerStatus {
                state: ServerState::NotRunning,
                failure: None,
            },
            Phase::Failed(reason) => ServerStatus {
                state: ServerState::NotRunning,
                failure: Some(reason.clone()),
            },
        }
    }

    /// The port of a server running `model` right now; never starts one and never waits for one.
    fn ready_port(&self, model: &Path) -> Option<u16> {
        let mut inner = self.inner.try_lock().ok()?;
        let run = inner.running.as_mut()?;
        (run.model == model && matches!(run.child.try_wait(), Ok(None))).then_some(run.port)
    }

    /// The port of a server running `model`: starts it, or restarts it when it has died or runs
    /// another model. `retry` forgets an earlier give-up (a session opening is a fresh chance).
    pub fn ensure(&self, binary: &Path, model: &Path, retry: bool) -> Result<u16, String> {
        let mut inner = lock(&self.inner);
        if retry {
            inner.given_up = None;
            self.deaths.store(0, Ordering::Release);
        }
        if let Some(run) = inner.running.as_mut() {
            let is_alive = matches!(run.child.try_wait(), Ok(None));
            if is_alive && run.model == model {
                return Ok(run.port);
            }
            let has_died = run.model == model;
            self.stop(&mut inner);
            if has_died {
                self.deaths.fetch_add(1, Ordering::AcqRel);
            }
        }
        if let Some((failed_model, reason)) = &inner.given_up {
            if failed_model == model {
                return Err(reason.clone());
            }
        }
        if self.deaths.load(Ordering::Acquire) >= MAX_DEATHS_WITHOUT_ANSWER {
            let reason = "whisper-server keeps stopping unexpectedly".to_string();
            return Err(self.give_up(&mut inner, model, reason));
        }
        *lock(&self.phase) = Phase::Loading;
        self.reap_leftover_once();
        match self.start(binary, model) {
            Ok(run) => {
                let port = run.port;
                inner.running = Some(run);
                *lock(&self.phase) = Phase::Ready;
                Ok(port)
            }
            Err(reason) => Err(self.give_up(&mut inner, model, reason)),
        }
    }

    fn give_up(&self, inner: &mut Inner, model: &Path, reason: String) -> String {
        inner.given_up = Some((model.to_path_buf(), reason.clone()));
        *lock(&self.phase) = Phase::Failed(reason.clone());
        reason
    }

    fn start(&self, binary: &Path, model: &Path) -> Result<Running, String> {
        let port = free_port().map_err(|error| format!("no free local port: {error}"))?;
        let mut child = Command::new(binary)
            .arg("-m")
            .arg(model)
            .args(["--host", "127.0.0.1", "--port"])
            .arg(port.to_string())
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .map_err(|error| format!("could not start {}: {error}", binary.display()))?;
        if let Some(path) = &self.pid_file {
            // Best effort: without the note a crashed app leaves its server to the next reboot.
            let _ = fs::write(path, child.id().to_string());
        }
        let address = SocketAddr::from((Ipv4Addr::LOCALHOST, port));
        let deadline = Instant::now() + START_TIMEOUT;
        loop {
            match child.try_wait() {
                Ok(None) => {}
                Ok(Some(status)) => {
                    self.forget_pid();
                    return Err(format!(
                        "whisper-server stopped while loading the model ({status})"
                    ));
                }
                Err(error) => {
                    let _ = child.kill();
                    let _ = child.wait();
                    self.forget_pid();
                    return Err(format!("could not watch whisper-server: {error}"));
                }
            }
            if TcpStream::connect_timeout(&address, Duration::from_millis(100)).is_ok() {
                return Ok(Running {
                    child,
                    port,
                    model: model.to_path_buf(),
                });
            }
            if Instant::now() >= deadline {
                let _ = child.kill();
                let _ = child.wait();
                self.forget_pid();
                return Err("whisper-server did not finish loading the model in time".into());
            }
            thread::sleep(Duration::from_millis(50));
        }
    }

    fn stop(&self, inner: &mut Inner) {
        if let Some(mut run) = inner.running.take() {
            // The process may already be gone, which is the goal.
            let _ = run.child.kill();
            let _ = run.child.wait();
            self.forget_pid();
        }
        let mut phase = lock(&self.phase);
        if !matches!(*phase, Phase::Failed(_)) {
            *phase = Phase::Idle;
        }
    }

    fn forget_pid(&self) {
        if let Some(path) = &self.pid_file {
            // A note that cannot be removed is overwritten by the next start.
            let _ = fs::remove_file(path);
        }
    }

    /// Stops the server. Called when the app exits, and on drop.
    pub fn shutdown(&self) {
        let mut inner = lock(&self.inner);
        self.stop(&mut inner);
    }

    /// A server the previous app run left behind (a crash skips the exit hook) still holds the
    /// model in memory; stop it once, before the first start of this run.
    fn reap_leftover_once(&self) {
        let Some(path) = &self.pid_file else { return };
        if self.reaped.swap(true, Ordering::AcqRel) {
            return;
        }
        let Some(pid) = fs::read_to_string(path)
            .ok()
            .and_then(|text| text.trim().parse::<u32>().ok())
        else {
            return;
        };
        let command = Command::new("ps")
            .args(["-p", &pid.to_string(), "-o", "command="])
            .output();
        let is_whisper_server = command
            .ok()
            .map(|output| String::from_utf8_lossy(&output.stdout).contains("whisper-server"))
            .unwrap_or(false);
        if is_whisper_server {
            // If it ended in the meantime there is nothing left to stop.
            let _ = Command::new("kill").arg(pid.to_string()).status();
        }
        let _ = fs::remove_file(path);
    }

    /// Transcribes a whole answer with the loaded model; restarts a dead server once.
    pub fn transcribe(
        &self,
        binary: &Path,
        model: &Path,
        wav: &[u8],
        prompt: Option<&str>,
        duration_ms: u64,
    ) -> Result<Transcript, ServerError> {
        let mut port = self
            .ensure(binary, model, false)
            .map_err(ServerError::Unavailable)?;
        let body = request(wav, prompt);
        let json = match post(port, &body, FINAL_TIMEOUT) {
            Ok(json) => json,
            Err(_) => {
                // The server died or hung up mid-request: one restart, then one-off runs.
                self.discard(port);
                port = self
                    .ensure(binary, model, false)
                    .map_err(ServerError::Unavailable)?;
                post(port, &body, FINAL_TIMEOUT).map_err(|reason| {
                    self.discard(port);
                    ServerError::Unavailable(reason)
                })?
            }
        };
        self.deaths.store(0, Ordering::Release);
        parse_server_output(&json, duration_ms).map_err(ServerError::Failed)
    }

    /// The text of the audio so far for the live transcript, only when the model is loaded and
    /// idle: it never starts a server and never waits for one. `None` skips this update.
    pub fn transcribe_partial(
        &self,
        model: &Path,
        wav: &[u8],
        prompt: Option<&str>,
    ) -> Option<String> {
        let port = self.ready_port(model)?;
        let json = post(port, &request(wav, prompt), PARTIAL_TIMEOUT).ok()?;
        match parse_server_output(&json, 0) {
            Ok(transcript) => Some(transcript.text),
            Err(error) if error.code == TranscriptionErrorCode::NoSpeech => Some(String::new()),
            Err(_) => None,
        }
    }

    /// Drops the server on `port` after a failed request so the next `ensure` starts a new one.
    fn discard(&self, port: u16) {
        let mut inner = lock(&self.inner);
        if inner.running.as_ref().is_some_and(|run| run.port == port) {
            self.stop(&mut inner);
            self.deaths.fetch_add(1, Ordering::AcqRel);
        }
    }

    #[cfg(test)]
    pub fn pid(&self) -> Option<u32> {
        lock(&self.inner).running.as_ref().map(|run| run.child.id())
    }

    #[cfg(test)]
    pub fn kill_child(&self) {
        let mut inner = lock(&self.inner);
        if let Some(run) = inner.running.as_mut() {
            let _ = run.child.kill();
            let _ = run.child.wait();
        }
    }
}

impl Drop for WhisperServer {
    fn drop(&mut self) {
        self.shutdown();
    }
}

fn free_port() -> std::io::Result<u16> {
    let listener = TcpListener::bind((Ipv4Addr::LOCALHOST, 0))?;
    Ok(listener.local_addr()?.port())
}

struct Request {
    content_type: String,
    body: Vec<u8>,
}

fn request(wav: &[u8], prompt: Option<&str>) -> Request {
    static NEXT: AtomicU32 = AtomicU32::new(0);
    let boundary = format!(
        "----english-trainer-{}-{}",
        std::process::id(),
        NEXT.fetch_add(1, Ordering::Relaxed)
    );
    Request {
        content_type: format!("multipart/form-data; boundary={boundary}"),
        body: multipart_body(&boundary, wav, prompt),
    }
}

/// The form `whisper-server`'s `/inference` reads: the audio as `file`, English, JSON back, and
/// the initial prompt when there is one.
pub(super) fn multipart_body(boundary: &str, wav: &[u8], prompt: Option<&str>) -> Vec<u8> {
    let mut body = Vec::with_capacity(wav.len() + 512);
    let mut text_field = |name: &str, value: &str| {
        body.extend_from_slice(
            format!("--{boundary}\r\nContent-Disposition: form-data; name=\"{name}\"\r\n\r\n{value}\r\n")
                .as_bytes(),
        );
    };
    if let Some(prompt) = prompt {
        text_field("prompt", prompt);
    }
    text_field("language", "en");
    text_field("response_format", "json");
    body.extend_from_slice(
        format!(
            "--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"answer.wav\"\r\nContent-Type: audio/wav\r\n\r\n"
        )
        .as_bytes(),
    );
    body.extend_from_slice(wav);
    body.extend_from_slice(format!("\r\n--{boundary}--\r\n").as_bytes());
    body
}

fn http_client() -> Result<&'static reqwest::blocking::Client, String> {
    static CLIENT: OnceLock<Option<reqwest::blocking::Client>> = OnceLock::new();
    CLIENT
        .get_or_init(|| {
            // The server is on this machine; a system proxy must not see the audio.
            reqwest::blocking::Client::builder().no_proxy().build().ok()
        })
        .as_ref()
        .ok_or_else(|| "the local HTTP client could not be created".to_string())
}

/// The response body, or why the server could not answer.
fn post(port: u16, request: &Request, timeout: Duration) -> Result<String, String> {
    let response = http_client()?
        .post(format!("http://127.0.0.1:{port}/inference"))
        .header(reqwest::header::CONTENT_TYPE, &request.content_type)
        .body(request.body.clone())
        .timeout(timeout)
        .send()
        .map_err(|error| format!("whisper-server did not answer: {error}"))?;
    let status = response.status();
    if !status.is_success() {
        return Err(format!("whisper-server answered with {status}"));
    }
    response
        .text()
        .map_err(|error| format!("whisper-server's answer could not be read: {error}"))
}

#[derive(Deserialize)]
struct ServerOutput {
    text: String,
}

pub(super) fn parse_server_output(
    json: &str,
    duration_ms: u64,
) -> Result<Transcript, TranscriptionError> {
    let output: ServerOutput = serde_json::from_str(json).map_err(|_| {
        TranscriptionError::new(
            TranscriptionErrorCode::InvalidOutput,
            "Whisper returned invalid transcription data. Please retry.",
        )
    })?;
    let text = without_annotations(&output.text);
    if text.is_empty() {
        return Err(TranscriptionError::new(
            TranscriptionErrorCode::NoSpeech,
            "No speech was recognized. Please record again.",
        ));
    }
    Ok(Transcript {
        text,
        language: "en".into(),
        duration_ms,
    })
}
