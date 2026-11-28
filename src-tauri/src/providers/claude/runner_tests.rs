use super::super::agy::test_support::TestDirectory;
#[cfg(unix)]
use super::super::agy::test_support::{recorded_calls, recording_cli};
use super::super::{CoachingAnswer, ProviderErrorCode};
use super::coaching::coach_answers_with;
use super::runner::{find_binary, parse_envelope, run_json, CLAUDE_MODEL};
use serde_json::json;
use std::{fs, time::Duration};

const SUCCESS: &str = r#"{"type":"result","subtype":"success","is_error":false,"duration_ms":1800,"result":"","structured_output":{"answers":[]},"total_cost_usd":0.01}"#;

fn claude_file() -> &'static str {
    if cfg!(windows) {
        "claude.exe"
    } else {
        "claude"
    }
}

fn code(output: &str) -> ProviderErrorCode {
    parse_envelope(output).unwrap_err().code
}

#[test]
fn a_successful_envelope_yields_the_structured_object() {
    assert_eq!(parse_envelope(SUCCESS).unwrap(), json!({ "answers": [] }));
}

#[test]
fn not_logged_in_is_unauthorized() {
    let output = r#"{"is_error":true,"result":"Not logged in · Please run /login"}"#;
    assert_eq!(code(output), ProviderErrorCode::Unauthorized);
}

#[test]
fn a_used_up_quota_is_a_rate_limit() {
    for text in [
        "You've hit your limit · resets 3pm",
        "Claude AI usage limit reached|1760000000",
        "API Error: 429 rate_limit_error",
    ] {
        let output = json!({ "is_error": true, "result": text }).to_string();
        assert_eq!(code(&output), ProviderErrorCode::RateLimited, "{text}");
    }
}

#[test]
fn any_other_error_envelope_is_a_failed_process() {
    let output = r#"{"is_error":true,"result":"Something broke"}"#;
    assert_eq!(code(output), ProviderErrorCode::ProcessFailed);
}

#[test]
fn text_that_is_not_json_is_invalid_output() {
    assert_eq!(code("warming up"), ProviderErrorCode::InvalidOutput);
}

#[test]
fn a_reply_without_structured_output_is_invalid_output() {
    for output in [
        r#"{"is_error":false,"result":"{\"answers\":[]}"}"#,
        r#"{"is_error":false,"structured_output":null}"#,
    ] {
        assert_eq!(code(output), ProviderErrorCode::InvalidOutput);
    }
}

#[test]
#[cfg(unix)]
fn the_call_is_pinned_to_sonnet_keeps_the_login_and_passes_the_schema() {
    let dir = TestDirectory::new();
    let cli = recording_cli(&dir, &format!("printf '%s' '{SUCCESS}'"));

    run_json(&cli, "Task", r#"{"type":"object"}"#, Duration::from_secs(5)).unwrap();

    let call = &recorded_calls(&dir)[0];
    let position = |flag: &str| call.iter().position(|argument| argument == flag).unwrap();
    assert_eq!(call[position("--model") + 1], CLAUDE_MODEL);
    assert_eq!(call[position("--json-schema") + 1], r#"{"type":"object"}"#);
    assert_eq!(call[position("--tools") + 1], "");
    assert_eq!(call.last().unwrap(), "Task");
    for flag in ["-p", "--no-session-persistence", "--strict-mcp-config"] {
        assert!(call.contains(&flag.to_string()), "{flag}");
    }
    assert!(!call.contains(&"--bare".to_string()));
}

#[test]
#[cfg(unix)]
fn a_failing_exit_with_an_error_envelope_keeps_its_meaning() {
    let dir = TestDirectory::new();
    let cli = recording_cli(
        &dir,
        r#"printf '%s' '{"is_error":true,"result":"Not logged in · Please run /login"}'; exit 1"#,
    );
    let error = run_json(&cli, "Task", "{}", Duration::from_secs(5)).unwrap_err();
    assert_eq!(error.code, ProviderErrorCode::Unauthorized);
}

#[test]
#[cfg(unix)]
fn a_failing_exit_with_only_stderr_is_classified_from_it() {
    let dir = TestDirectory::new();
    let cli = recording_cli(&dir, "echo 'usage limit reached' >&2; exit 1");
    let error = run_json(&cli, "Task", "{}", Duration::from_secs(5)).unwrap_err();
    assert_eq!(error.code, ProviderErrorCode::RateLimited);
}

#[test]
#[cfg(unix)]
fn a_call_that_outlasts_its_deadline_times_out() {
    let dir = TestDirectory::new();
    let cli = recording_cli(&dir, "sleep 5");
    let error = run_json(&cli, "Task", "{}", Duration::from_millis(200)).unwrap_err();
    assert_eq!(error.code, ProviderErrorCode::Timeout);
}

#[test]
fn a_missing_binary_is_unavailable() {
    let error = run_json(
        std::path::Path::new("/nonexistent/claude"),
        "Task",
        "{}",
        Duration::from_secs(1),
    )
    .unwrap_err();
    assert_eq!(error.code, ProviderErrorCode::Unavailable);
}

#[test]
#[cfg(unix)]
fn coaching_validates_the_structured_answers_like_the_legacy_provider() {
    let dir = TestDirectory::new();
    let envelope = r#"{"is_error":false,"structured_output":{"answers":[{"n":1,"mistakes":[{"original":"He go home","improved":"He goes home","explanation":"After he the verb takes -s.","category":"grammar"}],"rewrite":"He goes home."},{"n":7,"mistakes":[],"rewrite":"Not asked."}]}}"#;
    let cli = recording_cli(&dir, &format!("printf '%s' '{envelope}'"));
    let answers = [CoachingAnswer {
        sequence: 1,
        question: "What did he do?".into(),
        transcript: "He go home".into(),
        habits: Vec::new(),
    }];

    let coached = coach_answers_with(&cli, &answers).unwrap();

    assert_eq!(coached.len(), 1);
    assert_eq!(
        coached[0].feedback.focus_feedback[0].improved,
        "He goes home"
    );
}

#[test]
fn an_unreadable_coaching_payload_is_invalid_output() {
    let dir = TestDirectory::new();
    let cli = recording_cli(
        &dir,
        r#"printf '%s' '{"is_error":false,"structured_output":{"unexpected":1}}'"#,
    );
    let answers = [CoachingAnswer {
        sequence: 1,
        question: "Q".into(),
        transcript: "He go home".into(),
        habits: Vec::new(),
    }];
    let error = coach_answers_with(&cli, &answers).unwrap_err();
    assert_eq!(error.code, ProviderErrorCode::InvalidOutput);
}

#[test]
fn the_configured_binary_wins_and_must_exist() {
    let dir = TestDirectory::new();
    let configured = dir.path().join("my-claude");
    fs::write(&configured, "").unwrap();
    let elsewhere = dir.path().join("bin");
    fs::create_dir(&elsewhere).unwrap();
    fs::write(elsewhere.join(claude_file()), "").unwrap();

    let found = find_binary(
        Some(configured.clone().into_os_string()),
        Some(elsewhere.clone().into_os_string()),
        None,
    );
    assert_eq!(found, Some(configured));

    let missing = find_binary(
        Some(dir.path().join("absent").into_os_string()),
        Some(elsewhere.into_os_string()),
        None,
    );
    assert_eq!(missing, None);
}

#[test]
fn the_path_is_searched_before_the_fixed_install_folders() {
    let dir = TestDirectory::new();
    let on_path = dir.path().join("bin");
    fs::create_dir(&on_path).unwrap();
    fs::write(on_path.join(claude_file()), "").unwrap();
    let home = dir.path().join("home");
    let install = home.join(".local").join("bin");
    fs::create_dir_all(&install).unwrap();
    fs::write(install.join(claude_file()), "").unwrap();

    let found = find_binary(None, Some(on_path.clone().into_os_string()), Some(home));
    assert_eq!(found, Some(on_path.join(claude_file())));
}

#[test]
fn the_home_install_folder_is_used_when_the_path_is_minimal() {
    let dir = TestDirectory::new();
    let home = dir.path().join("home");
    let install = home.join(".local").join("bin");
    fs::create_dir_all(&install).unwrap();
    fs::write(install.join(claude_file()), "").unwrap();

    let found = find_binary(None, Some(std::ffi::OsString::new()), Some(home.clone()));
    assert_eq!(found, Some(install.join(claude_file())));
}
