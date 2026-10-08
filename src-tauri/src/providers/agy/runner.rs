use super::super::{ProviderError, ProviderErrorCode};
use crate::api_usage::{self, UsageSource};
use serde::Deserialize;
use serde_json::Value;
use std::{
    fs, io,
    path::{Path, PathBuf},
    process::{Command, Stdio},
    sync::atomic::{AtomicU64, Ordering},
    thread,
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};

pub(crate) const TIMEOUT: Duration = Duration::from_secs(45);
/// The Gemini model every Antigravity call runs on. Without `--model` agy falls back to its own
/// default, which is a Claude model and spends the learner's Claude quota.
pub(crate) const AGY_DEFAULT_MODEL: &str = "gemini-3.8-flash-medium";
/// Output markers that mean the Antigravity quota is used up, so retrying right away cannot help.
const QUOTA_MARKERS: [&str; 3] = ["RESOURCE_EXHAUSTED", "429", "quota"];
const MAX_OUTPUT_BYTES: u64 = 64 * 1024;
static TEMP_SEQUENCE: AtomicU64 = AtomicU64::new(0);

#[derive(Deserialize)]
pub(super) struct AgyEnvelope {
    pub status: String,
    pub structured_output: Value,
}

pub(super) fn resolve_binary() -> Option<PathBuf> {
    if let Some(configured) = std::env::var_os("ENG_TRAINER_AGY_BIN") {
        let path = PathBuf::from(configured);
        return path.is_file().then_some(path);
    }
    let candidates = [
        PathBuf::from("/opt/homebrew/bin/agy"),
        PathBuf::from("/usr/local/bin/agy"),
        std::env::var_os("HOME")
            .map(PathBuf::from)
            .unwrap_or_default()
            .join(".local/bin/agy"),
    ];
    std::env::var_os("PATH")
        .and_then(|paths| {
            std::env::split_paths(&paths)
                .map(|directory| directory.join("agy"))
                .find(|path| path.is_file())
        })
        .or_else(|| candidates.into_iter().find(|path| path.is_file()))
}

/// How one Antigravity call runs. The model is required, never optional: a call without one would
/// run on agy's own default model.
pub(super) struct CliOptions {
    pub timeout: Duration,
    pub model: &'static str,
}

impl CliOptions {
    pub(super) fn gemini(timeout: Duration) -> Self {
        Self {
            timeout,
            model: AGY_DEFAULT_MODEL,
        }
    }
}

pub(super) fn run_cli(
    binary: &Path,
    working_directory: &Path,
    schema_path: &Path,
    log_path: &Path,
    prompt: &str,
    options: CliOptions,
) -> Result<String, ProviderError> {
    // agy stops waiting on its own a little before the process deadline so it can answer cleanly.
    let print_timeout = format!("{}s", options.timeout.as_secs().saturating_sub(5).max(1));
    let mut command = Command::new(binary);
    command.current_dir(working_directory).args([
        "--print",
        prompt,
        "--json-schema",
        schema_path.to_string_lossy().as_ref(),
        "--output-format",
        "json",
        "--disable-slash-commands",
        "--sandbox",
        "--print-timeout",
        print_timeout.as_str(),
        "--log-file",
        log_path.to_string_lossy().as_ref(),
        // These verified model IDs already encode effort. An extra low override conflicts with Flash High.
        "--model",
        options.model,
    ]);
    api_usage::record_request(UsageSource::Antigravity, options.model);
    run_process(
        &mut command,
        working_directory,
        options.timeout,
        options.model,
    )
}

pub(crate) fn run_process(
    command: &mut Command,
    working_directory: &Path,
    timeout: Duration,
    model: &str,
) -> Result<String, ProviderError> {
    let stdout_path = working_directory.join("provider-output.json");
    let stdout_file = fs::File::create(&stdout_path).map_err(|_| {
        ProviderError::new(
            ProviderErrorCode::ProcessFailed,
            "Could not prepare provider output storage.",
        )
    })?;
    // stderr is kept (bounded) only to recognise an exhausted quota.
    let stderr_path = working_directory.join("provider-error.txt");
    let stderr_file = fs::File::create(&stderr_path).map_err(|_| {
        ProviderError::new(
            ProviderErrorCode::ProcessFailed,
            "Could not prepare provider output storage.",
        )
    })?;
    let mut child = command.stdout(Stdio::from(stdout_file))
        .stderr(Stdio::from(stderr_file))
        .spawn()
        .map_err(|error| {
            let code = if error.kind() == io::ErrorKind::NotFound {
                ProviderErrorCode::Unavailable
            } else {
                ProviderErrorCode::ProcessFailed
            };
            ProviderError::new(
                code,
                "Could not start the conversation provider. Check its installation and permissions.",
            )
        })?;
    let deadline = Instant::now() + timeout;
    let status = loop {
        match child.try_wait() {
            Ok(Some(status)) => break status,
            Ok(None) if Instant::now() < deadline => thread::sleep(Duration::from_millis(50)),
            Ok(None) => {
                let _ = child.kill();
                let _ = child.wait();
                return Err(ProviderError::new(
                    ProviderErrorCode::Timeout,
                    "The conversation provider timed out. Please retry.",
                ));
            }
            Err(_) => {
                let _ = child.kill();
                let _ = child.wait();
                return Err(ProviderError::new(
                    ProviderErrorCode::ProcessFailed,
                    "Could not wait for the conversation provider. Please retry.",
                ));
            }
        }
    };
    if !status.success() {
        let (stderr, stdout) = (read_head(&stderr_path), read_head(&stdout_path));
        if let Some(text) = [stderr, stdout].iter().find(|text| mentions_quota(text)) {
            record_quota_limit(model, text);
            return Err(quota_error());
        }
        return Err(ProviderError::new(
            ProviderErrorCode::ProcessFailed,
            "The AI provider could not respond. Check the selected model and Antigravity sign-in in Settings, then retry.",
        ));
    }
    let output_size = fs::metadata(&stdout_path)
        .map(|metadata| metadata.len())
        .map_err(|_| {
            ProviderError::new(
                ProviderErrorCode::ProcessFailed,
                "Could not read provider output.",
            )
        })?;
    if output_size > MAX_OUTPUT_BYTES {
        return Err(ProviderError::new(
            ProviderErrorCode::InvalidOutput,
            "The conversation provider returned an oversized response.",
        ));
    }
    let output = fs::read(stdout_path).map_err(|_| {
        ProviderError::new(
            ProviderErrorCode::ProcessFailed,
            "Could not read provider output.",
        )
    })?;
    String::from_utf8(output).map_err(|_| {
        ProviderError::new(
            ProviderErrorCode::InvalidOutput,
            "The conversation provider returned output that was not valid UTF-8.",
        )
    })
}

/// The error for a used-up Antigravity quota; coaching pauses on it instead of retrying.
pub(crate) fn quota_error() -> ProviderError {
    ProviderError::new(
        ProviderErrorCode::RateLimited,
        "Antigravity has run out of quota for now. Coaching is paused; talking is not affected.",
    )
}

/// The bounded head of a file, empty when it cannot be read.
fn read_head(path: &Path) -> String {
    use std::io::Read;
    let mut text = Vec::new();
    let Ok(file) = fs::File::open(path) else {
        return String::new();
    };
    if file.take(16 * 1024).read_to_end(&mut text).is_err() {
        return String::new();
    }
    String::from_utf8_lossy(&text).into_owned()
}

/// Notes a used-up quota in the usage log.
pub(crate) fn record_quota_limit(model: &str, text: &str) {
    api_usage::record(api_usage::antigravity_limit_event(
        model,
        text,
        api_usage::now_ms(),
    ));
}

pub(crate) fn mentions_quota(text: &str) -> bool {
    let lowered = text.to_ascii_lowercase();
    QUOTA_MARKERS
        .iter()
        .any(|marker| lowered.contains(&marker.to_ascii_lowercase()))
}

pub(crate) struct ScratchDirectory(PathBuf);

impl ScratchDirectory {
    pub(crate) fn new() -> io::Result<Self> {
        for _ in 0..10 {
            let timestamp = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_nanos();
            let sequence = TEMP_SEQUENCE.fetch_add(1, Ordering::Relaxed);
            let path = std::env::temp_dir().join(format!(
                "eng-trainer-agy-{}-{timestamp}-{sequence}",
                std::process::id()
            ));
            #[cfg(unix)]
            let result = {
                use std::os::unix::fs::DirBuilderExt;
                let mut builder = fs::DirBuilder::new();
                builder.mode(0o700);
                builder.create(&path)
            };
            #[cfg(not(unix))]
            let result = fs::create_dir(&path);
            match result {
                Ok(()) => return Ok(Self(path)),
                Err(error) if error.kind() == io::ErrorKind::AlreadyExists => continue,
                Err(error) => return Err(error),
            }
        }
        Err(io::Error::new(
            io::ErrorKind::AlreadyExists,
            "temporary directory collision",
        ))
    }

    pub(crate) fn path(&self) -> &Path {
        &self.0
    }
}

impl Drop for ScratchDirectory {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.0);
    }
}
