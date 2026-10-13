use crate::setup::domain::{ComponentCheck, ComponentStatus};
use crate::speech_recognition::ServerStatus;
use std::{fs, path::Path, path::PathBuf};

pub fn read_agy_default_model(path: &Path) -> Option<String> {
    use std::io::Read;
    let mut bytes = Vec::new();
    fs::File::open(path)
        .ok()?
        .take(65_537)
        .read_to_end(&mut bytes)
        .ok()?;
    if bytes.len() > 65_536 {
        return None;
    }
    let settings: serde_json::Value = serde_json::from_slice(&bytes).ok()?;
    let model = settings.get("model")?.as_str()?.trim();
    if model.is_empty() || model.chars().count() > 120 || model.chars().any(char::is_control) {
        return None;
    }
    Some(model.to_string())
}

pub fn check_cli(path: Option<PathBuf>) -> ComponentCheck {
    let Some(path) = path else {
        return ComponentCheck {
            status: ComponentStatus::Missing,
            path: None,
            message:
                "CLI was not found in its configured location, PATH, or standard install paths."
                    .into(),
        };
    };
    let displayed_path = path.to_string_lossy().into_owned();
    let metadata = match fs::metadata(&path) {
        Ok(metadata) if metadata.is_file() => metadata,
        Ok(_) => {
            return check_result(
                ComponentStatus::Missing,
                displayed_path,
                "Configured CLI path is not a regular file.",
            )
        }
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            return check_result(
                ComponentStatus::Missing,
                displayed_path,
                "CLI file was not found at the configured path.",
            )
        }
        Err(_) => {
            return check_result(
                ComponentStatus::Unreadable,
                displayed_path,
                "CLI file metadata could not be read.",
            )
        }
    };
    if !has_read_permission(&path, &metadata) {
        return check_result(
            ComponentStatus::Unreadable,
            displayed_path,
            "CLI file is not readable. Check its permissions.",
        );
    }
    if !has_execute_permission(&metadata) {
        return check_result(
            ComponentStatus::Unreadable,
            displayed_path,
            "CLI file is not executable. Check its permissions.",
        );
    }
    check_result(
        ComponentStatus::Available,
        displayed_path,
        "Readable executable file found; CLI authentication and runtime behavior were not tested.",
    )
}

pub fn check_server(path: Option<PathBuf>, server: &ServerStatus) -> ComponentCheck {
    use crate::speech_recognition::ServerState;
    let mut check = check_cli(path);
    check.message = match (&check.status, &server.failure, server.state) {
        (ComponentStatus::Missing, _, _) => "whisper-server was not found, so answers are transcribed by one-off whisper-cli runs, which reload the model every time. Install whisper.cpp with Homebrew to keep it loaded.".into(),
        (ComponentStatus::Unreadable, _, _) => "whisper-server cannot be run, so answers are transcribed by one-off whisper-cli runs. Check its permissions.".into(),
        (_, Some(reason), _) => format!("whisper-server could not be used ({reason}); answers are transcribed by one-off whisper-cli runs."),
        (_, None, ServerState::Ready) => "Running with the model kept loaded.".into(),
        (_, None, ServerState::Loading) => "Loading the model.".into(),
        (_, None, ServerState::NotRunning) => "Found; it starts when a practice session opens or with the first answer.".into(),
    };
    check
}

pub fn check_model(path: &Path) -> ComponentCheck {
    let displayed_path = path.to_string_lossy().into_owned();
    let metadata = match fs::metadata(path) {
        Ok(metadata) if metadata.is_file() => metadata,
        Ok(_) => {
            return check_result(
                ComponentStatus::Missing,
                displayed_path,
                "Whisper model path is not a regular file.",
            )
        }
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            return check_result(
                ComponentStatus::Missing,
                displayed_path,
                "Whisper model file was not found.",
            )
        }
        Err(_) => {
            return check_result(
                ComponentStatus::Unreadable,
                displayed_path,
                "Whisper model file metadata could not be read.",
            )
        }
    };
    if metadata.len() == 0 {
        return check_result(
            ComponentStatus::Unreadable,
            displayed_path,
            "Whisper model file is empty.",
        );
    }
    if !has_read_permission(path, &metadata) {
        return check_result(
            ComponentStatus::Unreadable,
            displayed_path,
            "Whisper model is not readable. Check its permissions.",
        );
    }
    check_result(
        ComponentStatus::Available,
        displayed_path,
        "Readable non-empty model file found; transcription was not tested.",
    )
}

fn check_result(status: ComponentStatus, path: String, message: &str) -> ComponentCheck {
    ComponentCheck {
        status,
        path: Some(path),
        message: message.into(),
    }
}

fn has_read_permission(path: &Path, metadata: &fs::Metadata) -> bool {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        metadata.permissions().mode() & 0o444 != 0 && fs::File::open(path).is_ok()
    }
    #[cfg(not(unix))]
    {
        fs::File::open(path).is_ok()
    }
}

fn has_execute_permission(metadata: &fs::Metadata) -> bool {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        metadata.permissions().mode() & 0o111 != 0
    }
    #[cfg(not(unix))]
    {
        true
    }
}
