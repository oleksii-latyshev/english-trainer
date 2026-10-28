use super::super::test_support::{recorded_calls, recording_cli, TestDirectory};
use super::*;

#[test]
fn a_structured_reply_is_returned_as_json() {
    let dir = TestDirectory::new();
    let cli = recording_cli(
        &dir,
        r#"printf '%s' '{"status":"SUCCESS","structured_output":{"lessons":[]}}'"#,
    );
    let value = run_background_json_with(&cli, "Task", "{}").unwrap();
    assert_eq!(value["lessons"], serde_json::json!([]));
}

#[test]
fn json_in_the_text_response_is_used_when_there_is_no_structured_output() {
    let dir = TestDirectory::new();
    let cli = recording_cli(
        &dir,
        r#"printf '%s' '{"status":"SUCCESS","response":"Here: {\"lessons\":[]} done"}'"#,
    );
    assert!(run_background_json_with(&cli, "Task", "{}").is_ok());
}

#[test]
fn the_call_is_pinned_to_a_gemini_model_and_sends_the_prompt() {
    let dir = TestDirectory::new();
    let cli = recording_cli(
        &dir,
        r#"printf '%s' '{"status":"SUCCESS","structured_output":{}}'"#,
    );
    run_background_json_with(&cli, "Prepare lessons", "{}").unwrap();
    let calls = recorded_calls(&dir);
    let call = &calls[0];
    let model = call.iter().position(|argument| argument == "--model");
    assert!(model.is_some_and(|index| call[index + 1].starts_with("gemini-")));
    assert!(call.iter().any(|argument| argument == "Prepare lessons"));
}

#[test]
fn a_quota_message_is_a_rate_limit() {
    let dir = TestDirectory::new();
    let cli = recording_cli(
        &dir,
        r#"printf '%s' '{"status":"ERROR","message":"RESOURCE_EXHAUSTED quota"}'"#,
    );
    let error = run_background_json_with(&cli, "Task", "{}").unwrap_err();
    assert_eq!(error.code, ProviderErrorCode::RateLimited);
}

#[test]
fn garbage_is_invalid_output() {
    let dir = TestDirectory::new();
    let cli = recording_cli(&dir, "printf '%s' 'not json'");
    let error = run_background_json_with(&cli, "Task", "{}").unwrap_err();
    assert_eq!(error.code, ProviderErrorCode::InvalidOutput);
}
