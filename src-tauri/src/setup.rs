use serde::Serialize;
use std::{fs, path::Path, path::PathBuf};

#[derive(Debug, Clone, Serialize)]
pub(crate) struct SetupDiagnostics {
    pub whisper_cli: ComponentCheck,
    pub whisper_model: ComponentCheck,
    pub agy_cli: ComponentCheck,
    pub database_path: String,
}

#[derive(Debug, Clone, Serialize)]
pub(crate) struct ComponentCheck {
    pub status: ComponentStatus,
    pub path: Option<String>,
    pub message: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "snake_case")]
pub(crate) enum ComponentStatus {
    Available,
    Missing,
    Unreadable,
}

pub(crate) fn collect(app_data: &Path) -> SetupDiagnostics {
    let whisper_cli = check_cli(crate::audio::resolve_whisper_binary());
    let whisper_model = check_model(&crate::audio::model_path(app_data));
    let agy_cli = check_cli(crate::providers::resolve_agy_binary());
    SetupDiagnostics {
        whisper_cli,
        whisper_model,
        agy_cli,
        database_path: app_data
            .join("english-trainer.sqlite3")
            .to_string_lossy()
            .into_owned(),
    }
}

fn check_cli(path: Option<PathBuf>) -> ComponentCheck {
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

fn check_model(path: &Path) -> ComponentCheck {
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

#[cfg(test)]
#[path = "setup/tests.rs"]
mod tests;
