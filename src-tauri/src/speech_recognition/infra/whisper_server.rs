use super::best_effort::{
    ignore_already_removed, ignore_process_already_gone, ignore_unwritable_note,
};
use super::binaries::ServerBuild;
use crate::speech_recognition::{
    domain::{without_annotations, ServerState, ServerStatus, Transcript, WhisperBackend},
    error::SpeechRecognitionError,
};
use serde::Deserialize;
use std::{
    fs,
    io::{BufRead, BufReader},
    net::{Ipv4Addr, SocketAddr, TcpListener, TcpStream},
    path::{Path, PathBuf},
    process::{Child, Command, Stdio},
    sync::{
        atomic::{AtomicBool, AtomicU32, Ordering},
        Arc, Mutex, MutexGuard, OnceLock,
    },
    thread,
    time::{Duration, Instant},
};

const START_TIMEOUT: Duration = Duration::from_secs(20);
const FINAL_TIMEOUT: Duration = Duration::from_secs(120);
const PARTIAL_TIMEOUT: Duration = Duration::from_secs(5);
const MAX_DEATHS_WITHOUT_ANSWER: u32 = 2;
const CUDA_REPORT_GRACE: Duration = Duration::from_millis(200);

#[derive(Debug, Clone, PartialEq, Eq)]
enum Phase {
    Idle,
    Loading,
    Ready(Option<WhisperBackend>),
    Failed(String),
}

#[derive(Debug, PartialEq, Eq)]
pub enum ServerError {
    Unavailable(String),
    Failed(SpeechRecognitionError),
}

struct Running {
    child: Child,
    port: u16,
    model: PathBuf,
    backend: Option<WhisperBackend>,
}

#[derive(Default)]
struct Inner {
    running: Option<Running>,
    given_up: Option<(PathBuf, String)>,
}

pub struct WhisperServer {
    inner: Mutex<Inner>,
    phase: Mutex<Phase>,
    deaths: AtomicU32,
    reaped: AtomicBool,
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
            Phase::Ready(backend) => ServerStatus {
                state: ServerState::Ready,
                failure: None,
                backend: *backend,
            },
            Phase::Loading => ServerStatus {
                state: ServerState::Loading,
                failure: None,
                backend: None,
            },
            Phase::Idle => ServerStatus {
                state: ServerState::NotRunning,
                failure: None,
                backend: None,
            },
            Phase::Failed(reason) => ServerStatus {
                state: ServerState::NotRunning,
                failure: Some(reason.clone()),
                backend: None,
            },
        }
    }

    fn ready_port(&self, model: &Path) -> Option<u16> {
        let mut inner = self.inner.try_lock().ok()?;
        let run = inner.running.as_mut()?;
        (run.model == model && matches!(run.child.try_wait(), Ok(None))).then_some(run.port)
    }

    pub fn ensure(&self, builds: &[ServerBuild], model: &Path, retry: bool) -> Result<u16, String> {
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
        match self.start_first_working(builds, model) {
            Ok(run) => {
                let port = run.port;
                *lock(&self.phase) = Phase::Ready(run.backend);
                inner.running = Some(run);
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

    fn start_first_working(&self, builds: &[ServerBuild], model: &Path) -> Result<Running, String> {
        let mut last_reason = "whisper-server was not found".to_string();
        for build in builds {
            match self.start(build, model) {
                Ok(run) => return Ok(run),
                Err(reason) => {
                    crate::diagnostics::log(
                        "speech",
                        format_args!("{} is not used: {reason}", build.path.display()),
                    );
                    last_reason = reason;
                }
            }
        }
        Err(last_reason)
    }

    fn start(&self, build: &ServerBuild, model: &Path) -> Result<Running, String> {
        let binary = &build.path;
        let port = free_port().map_err(|error| format!("no free local port: {error}"))?;
        let watches_cuda = build.backend == Some(WhisperBackend::Cuda);
        let mut command = Command::new(binary);
        command
            .arg("-m")
            .arg(model)
            .args(["--host", "127.0.0.1", "--port"])
            .arg(port.to_string())
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(if watches_cuda {
                Stdio::piped()
            } else {
                Stdio::null()
            });
        let mut child = command
            .spawn()
            .map_err(|error| format!("could not start {}: {error}", binary.display()))?;
        let no_cuda_device = Arc::new(AtomicBool::new(false));
        if let Some(stderr) = child.stderr.take() {
            watch_for_missing_cuda_device(stderr, Arc::clone(&no_cuda_device));
        }
        if let Some(path) = &self.pid_file {
            ignore_unwritable_note(fs::write(path, child.id().to_string()));
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
                    stop_child(&mut child);
                    self.forget_pid();
                    return Err(format!("could not watch whisper-server: {error}"));
                }
            }
            if TcpStream::connect_timeout(&address, Duration::from_millis(100)).is_ok() {
                if watches_cuda {
                    thread::sleep(CUDA_REPORT_GRACE);
                    if no_cuda_device.load(Ordering::Acquire) {
                        stop_child(&mut child);
                        self.forget_pid();
                        return Err("whisper-server found no usable CUDA device".into());
                    }
                }
                return Ok(Running {
                    child,
                    port,
                    model: model.to_path_buf(),
                    backend: build.backend,
                });
            }
            if Instant::now() >= deadline {
                stop_child(&mut child);
                self.forget_pid();
                return Err("whisper-server did not finish loading the model in time".into());
            }
            thread::sleep(Duration::from_millis(50));
        }
    }

    fn stop(&self, inner: &mut Inner) {
        if let Some(mut run) = inner.running.take() {
            stop_child(&mut run.child);
            self.forget_pid();
        }
        let mut phase = lock(&self.phase);
        if !matches!(*phase, Phase::Failed(_)) {
            *phase = Phase::Idle;
        }
    }

    fn forget_pid(&self) {
        if let Some(path) = &self.pid_file {
            ignore_already_removed(fs::remove_file(path));
        }
    }

    pub fn shutdown(&self) {
        let mut inner = lock(&self.inner);
        self.stop(&mut inner);
    }

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
        let is_whisper_server = crate::platform::command_line_of(pid)
            .is_some_and(|command_line| command_line.contains("whisper-server"));
        if is_whisper_server {
            ignore_process_already_gone(crate::platform::terminate(pid));
        }
        ignore_already_removed(fs::remove_file(path));
    }

    pub fn transcribe(
        &self,
        builds: &[ServerBuild],
        model: &Path,
        wav: &[u8],
        prompt: Option<&str>,
        duration_ms: u64,
    ) -> Result<Transcript, ServerError> {
        let mut port = self
            .ensure(builds, model, false)
            .map_err(ServerError::Unavailable)?;
        let body = request(wav, prompt);
        let json = match post(port, &body, FINAL_TIMEOUT) {
            Ok(json) => json,
            Err(_) => {
                self.discard(port);
                port = self
                    .ensure(builds, model, false)
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

    pub fn transcribe_partial(
        &self,
        model: &Path,
        wav: &[u8],
        prompt: Option<&str>,
    ) -> Option<String> {
        self.transcribe_snapshot(model, wav, prompt, PARTIAL_TIMEOUT)
    }

    pub(super) fn transcribe_snapshot(
        &self,
        model: &Path,
        wav: &[u8],
        prompt: Option<&str>,
        timeout: Duration,
    ) -> Option<String> {
        let port = self.ready_port(model)?;
        let json = post(port, &request(wav, prompt), timeout).ok()?;
        match parse_server_output(&json, 0) {
            Ok(transcript) => Some(transcript.text),
            Err(SpeechRecognitionError::NoSpeech) => Some(String::new()),
            Err(_) => None,
        }
    }

    fn discard(&self, port: u16) {
        let mut inner = lock(&self.inner);
        if inner.running.as_ref().is_some_and(|run| run.port == port) {
            self.stop(&mut inner);
            self.deaths.fetch_add(1, Ordering::AcqRel);
        }
    }

    #[cfg(test)]
    #[cfg(unix)]
    pub fn pid(&self) -> Option<u32> {
        lock(&self.inner).running.as_ref().map(|run| run.child.id())
    }

    #[cfg(test)]
    #[cfg(unix)]
    pub fn kill_child(&self) {
        let mut inner = lock(&self.inner);
        if let Some(run) = inner.running.as_mut() {
            stop_child(&mut run.child);
        }
    }
}

impl Drop for WhisperServer {
    fn drop(&mut self) {
        self.shutdown();
    }
}

fn watch_for_missing_cuda_device(stderr: std::process::ChildStderr, flag: Arc<AtomicBool>) {
    thread::spawn(move || {
        for line in BufReader::new(stderr).lines().map_while(Result::ok) {
            if reports_missing_cuda_device(&line) {
                flag.store(true, Ordering::Release);
            }
        }
    });
}

pub(super) fn reports_missing_cuda_device(line: &str) -> bool {
    let line = line.to_ascii_lowercase();
    line.contains("no gpu found")
        || line.contains("failed to initialize cuda")
        || line.contains("no cuda-capable device")
        || line.contains("no cuda devices")
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
        .get_or_init(|| reqwest::blocking::Client::builder().no_proxy().build().ok())
        .as_ref()
        .ok_or_else(|| "the local HTTP client could not be created".to_string())
}

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
) -> Result<Transcript, SpeechRecognitionError> {
    let output: ServerOutput = serde_json::from_str(json).map_err(|_| {
        SpeechRecognitionError::InvalidOutput(
            "Whisper returned invalid transcription data. Please retry.".into(),
        )
    })?;
    let text = without_annotations(&output.text);
    if text.is_empty() {
        return Err(SpeechRecognitionError::NoSpeech);
    }
    Ok(Transcript::english(text, duration_ms))
}

fn stop_child(child: &mut Child) {
    ignore_process_already_gone(child.kill());
    ignore_process_already_gone(child.wait());
}
