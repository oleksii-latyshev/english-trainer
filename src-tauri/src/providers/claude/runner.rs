use super::super::agy::runner::{execute, read_head, ScratchDirectory};
use super::super::{ProviderError, ProviderErrorCode};
use crate::api_usage::{self, UsageSource};
use serde::Deserialize;
use serde_json::Value;
use std::{
    ffi::OsString,
    path::{Path, PathBuf},
    process::Command,
    time::Duration,
};

/// The Claude model every background call runs on. Never optional: a call without `--model` would
/// run on whatever the CLI is configured with.
pub(crate) const CLAUDE_MODEL: &str = "sonnet";
const QUOTA_MARKERS: [&str; 7] = [
    "usage limit",
    "hit your limit",
    "limit reached",
    "rate limit",
    "rate_limit",
    "quota",
    "429",
];
const SIGN_IN_MARKERS: [&str; 4] = [
    "not logged in",
    "/login",
    "invalid api key",
    "authentication",
];
const MAX_LIMIT_NOTE_CHARS: usize = 200;

#[derive(Deserialize)]
struct Envelope {
    #[serde(default)]
    is_error: bool,
    #[serde(default)]
    result: Option<String>,
    #[serde(default)]
    structured_output: Option<Value>,
}

pub(crate) fn resolve_binary() -> Option<PathBuf> {
    find_binary(
        std::env::var_os("ENG_TRAINER_CLAUDE_BIN"),
        std::env::var_os("PATH"),
        crate::platform::home_dir(),
    )
}

/// A GUI app started from Finder has a minimal PATH, so the usual install folders are tried too.
pub(crate) fn find_binary(
    configured: Option<OsString>,
    path: Option<OsString>,
    home: Option<PathBuf>,
) -> Option<PathBuf> {
    if let Some(configured) = configured {
        let configured = PathBuf::from(configured);
        return configured.is_file().then_some(configured);
    }
    let fallback_dirs = home
        .map(|home| crate::platform::user_install_dirs(&home))
        .unwrap_or_default()
        .into_iter()
        .chain(crate::platform::system_install_dirs());
    crate::platform::find_tool("claude", path, fallback_dirs)
}

pub(crate) fn unavailable() -> ProviderError {
    ProviderError::new(
        ProviderErrorCode::Unavailable,
        "Claude Code was not found. Install it or set ENG_TRAINER_CLAUDE_BIN to its executable.",
    )
}

pub(crate) fn resolve_or_unavailable() -> Result<PathBuf, ProviderError> {
    resolve_binary().ok_or_else(unavailable)
}

/// The error for a used-up Claude quota; coaching pauses on it instead of retrying.
pub(crate) fn quota_error() -> ProviderError {
    ProviderError::new(
        ProviderErrorCode::RateLimited,
        "Claude has run out of quota for now. Coaching is paused; talking is not affected.",
    )
}

/// Runs one call that must answer in `schema` and returns the validated object. The working
/// directory is a fresh scratch folder, so the CLI sees no project and no memory of earlier calls.
pub(crate) fn run_json(
    binary: &Path,
    prompt: &str,
    schema: &str,
    timeout: Duration,
) -> Result<Value, ProviderError> {
    let workspace = ScratchDirectory::new().map_err(|_| {
        ProviderError::new(
            ProviderErrorCode::ProcessFailed,
            "Could not create a temporary workspace.",
        )
    })?;
    // `--bare` would skip the subscription sign-in, so the call would never be logged in.
    let mut command = Command::new(binary);
    command.current_dir(workspace.path()).args([
        "-p",
        "--model",
        CLAUDE_MODEL,
        "--no-session-persistence",
        "--tools",
        "",
        "--strict-mcp-config",
        "--setting-sources",
        "",
        "--disable-slash-commands",
        "--output-format",
        "json",
        "--json-schema",
        schema,
        "--",
        prompt,
    ]);
    api_usage::record_request(UsageSource::Claude, CLAUDE_MODEL);
    let finished = execute(&mut command, workspace.path(), timeout)?;
    let stdout = read_head(&finished.stdout);
    if finished.success {
        return parse_envelope(&stdout);
    }
    match parse_envelope(&stdout) {
        Err(error) if error.code != ProviderErrorCode::InvalidOutput => Err(error),
        _ => Err(failure(&format!(
            "{stdout}\n{}",
            read_head(&finished.stderr)
        ))),
    }
}

/// Reads the `--output-format json` envelope: the schema-validated object, or why there is none.
pub(crate) fn parse_envelope(output: &str) -> Result<Value, ProviderError> {
    let envelope: Envelope = serde_json::from_str(output).map_err(|_| invalid_output())?;
    if envelope.is_error {
        return Err(failure(envelope.result.as_deref().unwrap_or_default()));
    }
    match envelope.structured_output {
        Some(Value::Null) | None => Err(invalid_output()),
        Some(value) => Ok(value),
    }
}

fn failure(text: &str) -> ProviderError {
    let lowered = text.to_ascii_lowercase();
    if SIGN_IN_MARKERS
        .iter()
        .any(|marker| lowered.contains(marker))
    {
        return ProviderError::new(
            ProviderErrorCode::Unauthorized,
            "Claude Code is not signed in. Run `claude` once and sign in with /login.",
        );
    }
    if QUOTA_MARKERS.iter().any(|marker| lowered.contains(marker)) {
        record_quota_limit(text);
        return quota_error();
    }
    ProviderError::new(
        ProviderErrorCode::ProcessFailed,
        "Claude Code could not respond. Check that it is installed and signed in, then retry.",
    )
}

fn record_quota_limit(text: &str) {
    let note: String = text
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .chars()
        .take(MAX_LIMIT_NOTE_CHARS)
        .collect();
    api_usage::record_limit(UsageSource::Claude, CLAUDE_MODEL, note, None);
}

pub(crate) fn invalid_output() -> ProviderError {
    ProviderError::new(
        ProviderErrorCode::InvalidOutput,
        "The background provider returned output that could not be read.",
    )
}

/// Words a feature's own error for the reader, keeping the code the caller reacts to.
pub(crate) fn for_feature(error: ProviderError, feature: &str, retry: &str) -> ProviderError {
    let message = match error.code {
        ProviderErrorCode::Unavailable | ProviderErrorCode::Unauthorized => format!(
            "{feature} could not start. Check that Claude Code is installed and signed in, then try again."
        ),
        ProviderErrorCode::Timeout => format!("{feature} took too long. {retry}"),
        ProviderErrorCode::RateLimited => format!(
            "{feature} is temporarily unavailable because the AI limit was reached. {retry}"
        ),
        _ => format!("{feature} is temporarily unavailable. {retry}"),
    };
    ProviderError::new(error.code, message)
}
