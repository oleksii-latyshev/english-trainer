use super::super::{ProviderError, ProviderErrorCode};
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

pub(super) struct CliOptions {
    pub timeout: Duration,
    pub model: Option<&'static str>,
}

impl From<Duration> for CliOptions {
    fn from(timeout: Duration) -> Self {
        Self {
            timeout,
            model: None,
        }
    }
}

pub(super) fn run_cli(
    binary: &Path,
    working_directory: &Path,
    schema_path: &Path,
    log_path: &Path,
    prompt: &str,
    options: impl Into<CliOptions>,
) -> Result<String, ProviderError> {
    let options = options.into();
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
        "40s",
        "--log-file",
        log_path.to_string_lossy().as_ref(),
    ]);
    if let Some(model) = options.model {
        // These verified model IDs already encode effort. An extra low override conflicts with Flash High.
        command.args(["--model", model]);
    }
    run_process(&mut command, working_directory, options.timeout)
}

pub(crate) fn run_process(
    command: &mut Command,
    working_directory: &Path,
    timeout: Duration,
) -> Result<String, ProviderError> {
    let stdout_path = working_directory.join("provider-output.json");
    let stdout_file = fs::File::create(&stdout_path).map_err(|_| {
        ProviderError::new(
            ProviderErrorCode::ProcessFailed,
            "Could not prepare provider output storage.",
        )
    })?;
    let mut child = command.stdout(Stdio::from(stdout_file))
        .stderr(Stdio::null())
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
