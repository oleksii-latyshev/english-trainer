use super::*;
use std::{
    sync::atomic::{AtomicU64, Ordering},
    time::{SystemTime, UNIX_EPOCH},
};

static NEXT_TEMP: AtomicU64 = AtomicU64::new(0);

struct TempDir(PathBuf);

impl TempDir {
    fn new() -> Self {
        let stamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos();
        let path = std::env::temp_dir().join(format!(
            "english-trainer-setup-{}-{stamp}-{}",
            std::process::id(),
            NEXT_TEMP.fetch_add(1, Ordering::Relaxed)
        ));
        fs::create_dir(&path).unwrap();
        Self(path)
    }

    fn path(&self) -> &Path {
        &self.0
    }
}

impl Drop for TempDir {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.0);
    }
}

fn set_mode(path: &Path, mode: u32) {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(path, fs::Permissions::from_mode(mode)).unwrap();
    }
    #[cfg(not(unix))]
    let _ = (path, mode);
}

#[test]
fn reports_missing_and_non_file_components() {
    let temp = TempDir::new();
    let missing = temp.path().join("missing");
    assert!(matches!(check_cli(None).status, ComponentStatus::Missing));
    assert!(matches!(
        check_cli(Some(missing.clone())).status,
        ComponentStatus::Missing
    ));
    assert!(matches!(
        check_model(&missing).status,
        ComponentStatus::Missing
    ));
    assert!(matches!(
        check_model(temp.path()).status,
        ComponentStatus::Missing
    ));
}

#[test]
fn reports_empty_and_unreadable_models() {
    let temp = TempDir::new();
    let empty = temp.path().join("empty.bin");
    fs::write(&empty, []).unwrap();
    assert!(matches!(
        check_model(&empty).status,
        ComponentStatus::Unreadable
    ));

    let unreadable = temp.path().join("unreadable.bin");
    fs::write(&unreadable, b"model").unwrap();
    set_mode(&unreadable, 0);
    assert!(matches!(
        check_model(&unreadable).status,
        ComponentStatus::Unreadable
    ));
}

#[test]
fn reports_non_executable_and_available_cli_files() {
    let temp = TempDir::new();
    let cli = temp.path().join("cli");
    fs::write(&cli, b"#!/bin/sh\n").unwrap();
    set_mode(&cli, 0o600);
    assert!(matches!(
        check_cli(Some(cli.clone())).status,
        ComponentStatus::Unreadable
    ));

    set_mode(&cli, 0o700);
    assert!(matches!(
        check_cli(Some(cli)).status,
        ComponentStatus::Available
    ));
}

fn idle_server() -> crate::audio::ServerStatus {
    crate::audio::ServerStatus {
        state: crate::audio::ServerState::NotRunning,
        failure: None,
    }
}

#[test]
fn the_server_line_says_when_one_off_runs_are_used() {
    let missing = check_server(None, &idle_server());
    assert!(matches!(missing.status, ComponentStatus::Missing));
    assert!(missing.message.contains("one-off whisper-cli runs"));

    let temp = TempDir::new();
    let server = temp.path().join("whisper-server");
    fs::write(&server, b"#!/bin/sh\n").unwrap();
    set_mode(&server, 0o700);
    let failed = crate::audio::ServerStatus {
        state: crate::audio::ServerState::NotRunning,
        failure: Some("the model did not load".into()),
    };
    let message = check_server(Some(server.clone()), &failed).message;
    assert!(message.contains("the model did not load"));
    assert!(message.contains("one-off whisper-cli runs"));

    let ready = crate::audio::ServerStatus {
        state: crate::audio::ServerState::Ready,
        failure: None,
    };
    let check = check_server(Some(server), &ready);
    assert!(matches!(check.status, ComponentStatus::Available));
    assert_eq!(check.message, "Running with the model kept loaded.");
}

#[test]
fn serializes_diagnostics_with_snake_case_statuses() {
    let temp = TempDir::new();
    let data = temp.path().join("data");
    let diagnostics = SetupDiagnostics {
        agy_default_model: None,
        whisper_cli: check_cli(None),
        whisper_model: check_model(&data.join("model.bin")),
        whisper_server: check_server(None, &idle_server()),
        agy_cli: check_cli(None),
        database_path: data
            .join("english-trainer.sqlite3")
            .to_string_lossy()
            .into_owned(),
    };
    let json = serde_json::to_value(diagnostics).unwrap();
    assert_eq!(json["whisper_cli"]["status"], "missing");
    assert_eq!(json["whisper_cli"]["path"], serde_json::Value::Null);
    assert_eq!(
        json["database_path"],
        data.join("english-trainer.sqlite3")
            .to_string_lossy()
            .as_ref()
    );
}

#[test]
fn cli_default_model_metadata_is_bounded_and_never_returns_other_settings() {
    let dir = crate::providers::agy::runner::ScratchDirectory::new().unwrap();
    let path = dir.path().join("settings.json");
    fs::write(
        &path,
        r#"{"model":"Claude Sonnet 4.6 (Thinking)","other":"not exposed"}"#,
    )
    .unwrap();
    assert_eq!(
        read_agy_default_model(&path).as_deref(),
        Some("Claude Sonnet 4.6 (Thinking)")
    );
    fs::write(&path, r#"{"model":7}"#).unwrap();
    assert!(read_agy_default_model(&path).is_none());
    fs::write(&path, "x".repeat(65_537)).unwrap();
    assert!(read_agy_default_model(&path).is_none());
}
