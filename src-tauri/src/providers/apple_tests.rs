use super::*;
use crate::providers::{AgyModel, AiSettings, ConversationProvider};
use std::{fs, os::unix::fs::PermissionsExt, path::Path};

fn context() -> ConversationContext {
    ConversationContext {
        opening_question: String::new(),
        recent_turns: Vec::new(),
        latest_transcript: "Hello".into(),
        learning_targets: Vec::new(),
    }
}

fn script(directory: &Path, body: &str) -> PathBuf {
    let binary = directory.join("fake-apple");
    fs::write(&binary, format!("#!/bin/sh\n{body}\n")).unwrap();
    fs::set_permissions(&binary, fs::Permissions::from_mode(0o700)).unwrap();
    binary
}

const SERVE: &str = r#"while IFS= read -r line; do
  id=$(printf '%s' "$line" | sed 's/^{"id":\([0-9]*\),.*/\1/')
  printf '{"id":%s,"type":"delta","text":"Nice. "}\n' "$id"
  printf '{"id":%s,"type":"delta","text":"What happened next?"}\n' "$id"
  printf '{"id":%s,"type":"done"}\n' "$id"
done"#;

fn settings() -> AiSettings {
    AiSettings {
        provider: ConversationProvider::Apple,
        agy_model: AgyModel::FlashHigh,
    }
}

#[test]
fn one_helper_serves_streamed_replies_for_several_requests() {
    let dir = crate::providers::agy::runner::ScratchDirectory::new().unwrap();
    let helper = AppleHelper::new(Some(script(dir.path(), SERVE)));
    for _ in 0..2 {
        let mut deltas = Vec::new();
        let turn = crate::providers::generate_configured_turn(
            &context(),
            &settings(),
            &helper,
            &mut |text| deltas.push(text.to_string()),
        )
        .unwrap();
        assert_eq!(deltas, ["Nice. ", "What happened next?"]);
        assert_eq!(turn.spoken_reply, "Nice.");
        assert_eq!(turn.question.as_deref(), Some("What happened next?"));
        assert!(turn.first_token_ms.is_some());
    }
}

#[test]
fn helper_errors_keep_their_typed_code_and_never_fall_back() {
    let dir = crate::providers::agy::runner::ScratchDirectory::new().unwrap();
    let helper = AppleHelper::new(Some(script(
        dir.path(),
        r#"while IFS= read -r line; do
  id=$(printf '%s' "$line" | sed 's/^{"id":\([0-9]*\),.*/\1/')
  printf '{"id":%s,"type":"error","code":"unavailable","message":"Model not ready"}\n' "$id"
done"#,
    )));
    let error = helper.generate_turn(&context(), &mut |_| {}).unwrap_err();
    assert_eq!(error.code, ProviderErrorCode::Unavailable);
    assert_eq!(error.message, "Model not ready");
}

#[test]
fn a_helper_that_died_is_restarted_once() {
    let dir = crate::providers::agy::runner::ScratchDirectory::new().unwrap();
    let marker = dir.path().join("started-once");
    let helper = AppleHelper::new(Some(script(
        dir.path(),
        &format!(
            "if [ ! -e '{marker}' ]; then touch '{marker}'; exit 1; fi\n{SERVE}",
            marker = marker.display()
        ),
    )));
    let turn = helper.generate_turn(&context(), &mut |_| {}).unwrap();
    assert_eq!(turn.question.as_deref(), Some("What happened next?"));
}

#[test]
fn a_helper_that_keeps_dying_reports_a_typed_failure() {
    let dir = crate::providers::agy::runner::ScratchDirectory::new().unwrap();
    let helper = AppleHelper::new(Some(script(dir.path(), "exit 1")));
    let error = helper.generate_turn(&context(), &mut |_| {}).unwrap_err();
    assert_eq!(error.code, ProviderErrorCode::ProcessFailed);
}

#[test]
fn missing_helper_is_unavailable() {
    let helper = AppleHelper::new(Some(PathBuf::from("/nonexistent/apple-conversation")));
    assert_eq!(
        helper.prewarm().unwrap_err().code,
        ProviderErrorCode::Unavailable
    );
    assert_eq!(
        AppleHelper::new(None)
            .generate_turn(&context(), &mut |_| {})
            .unwrap_err()
            .code,
        ProviderErrorCode::Unavailable
    );
}
