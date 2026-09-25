use super::*;
use crate::providers::{ConversationContext, ConversationEngine, FocusCategory};
use std::{
    fs,
    path::PathBuf,
    sync::atomic::{AtomicU64, Ordering},
};

static TEST_SEQUENCE: AtomicU64 = AtomicU64::new(0);

fn context(transcript: &str) -> ConversationContext {
    ConversationContext {
        opening_question: "What happened recently?".into(),
        recent_turns: Vec::new(),
        latest_transcript: transcript.into(),
    }
}

fn feedback_request(transcript: &str) -> FeedbackRequest {
    FeedbackRequest {
        question: "What happened on your trip?".into(),
        transcript: transcript.into(),
    }
}

struct TestDirectory(PathBuf);

impl TestDirectory {
    fn new() -> Self {
        let id = TEST_SEQUENCE.fetch_add(1, Ordering::Relaxed);
        let path = std::env::temp_dir().join(format!(
            "eng-trainer-feedback-test-{}-{id}",
            std::process::id()
        ));
        fs::create_dir(&path).expect("create test directory");
        Self(path)
    }

    fn path(&self) -> &std::path::Path {
        &self.0
    }
}

impl Drop for TestDirectory {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.0);
    }
}

#[cfg(unix)]
fn fake_cli(dir: &TestDirectory, body: &str) -> PathBuf {
    use std::os::unix::fs::PermissionsExt;
    let path = dir.path().join("fake-agy");
    fs::write(&path, format!("#!/bin/sh\n{body}\n")).expect("write fake CLI");
    fs::set_permissions(&path, fs::Permissions::from_mode(0o700))
        .expect("make fake CLI executable");
    path
}

#[test]
fn feedback_schema_and_validation_accept_coaching_and_empty_focus() {
    let output = r#"{"status":"SUCCESS","structured_output":{"focus_feedback":[{"category":"grammar","original":"I go yesterday.","improved":"I went yesterday.","explanation":"Use the past form for a finished event."}],"b2_rewrite":"Yesterday, I went to the city and had a relaxing afternoon."}}"#;
    let raw = parse_feedback_envelope(output).unwrap();
    let feedback = validate_feedback(raw, "I go yesterday.").unwrap();
    assert_eq!(feedback.focus_feedback.len(), 1);
    assert_eq!(feedback.focus_feedback[0].category, FocusCategory::Grammar);
    assert_eq!(
        feedback.b2_rewrite,
        "Yesterday, I went to the city and had a relaxing afternoon."
    );

    let output = r#"{"status":"SUCCESS","structured_output":{"focus_feedback":[],"b2_rewrite":"That was a clear and natural answer."}}"#;
    let feedback = validate_feedback(
        parse_feedback_envelope(output).unwrap(),
        "That was a clear and natural answer.",
    )
    .unwrap();
    assert!(feedback.focus_feedback.is_empty());
}

#[test]
fn feedback_request_and_model_output_are_bounded_and_plain_text() {
    assert_eq!(
        validate_feedback_request(&feedback_request(" \n"))
            .unwrap_err()
            .code,
        ProviderErrorCode::InvalidRequest
    );
    assert_eq!(
        validate_feedback_request(&feedback_request(
            &"x".repeat(MAX_FEEDBACK_TRANSCRIPT_CHARS + 1)
        ))
        .unwrap_err()
        .code,
        ProviderErrorCode::InvalidRequest
    );
    let mut request = feedback_request("Hello.");
    request.question = "x".repeat(141);
    assert_eq!(
        validate_feedback_request(&request).unwrap_err().code,
        ProviderErrorCode::InvalidRequest
    );
    assert!(validate_feedback_text("**do this**", 50).is_err());
    assert!(validate_feedback_text("{\"rewrite\":\"x\"}", 50).is_err());
    assert!(validate_feedback_text(&"x".repeat(301), 300).is_err());
    assert!(is_transcript_excerpt(
        "I go, yesterday!",
        "Well, I go yesterday."
    ));
    assert!(!is_transcript_excerpt(
        "I went yesterday",
        "I go yesterday."
    ));
}

#[cfg(unix)]
#[test]
fn feedback_fake_cli_returns_typed_result_and_removes_scratch_data() {
    let dir = TestDirectory::new();
    let scratch_marker = dir.path().join("feedback-scratch");
    let json = r#"{"status":"SUCCESS","structured_output":{"focus_feedback":[],"b2_rewrite":"That sounds like a memorable trip."}}"#;
    let script = format!(
        "pwd > '{}'\nprintf '%s' '{}'",
        scratch_marker.display(),
        json
    );
    let engine = AgyEngine {
        binary: fake_cli(&dir, &script),
    };
    let feedback = engine
        .evaluate_turn(&feedback_request("It was a nice trip."))
        .unwrap();
    assert!(feedback.focus_feedback.is_empty());
    let scratch = PathBuf::from(fs::read_to_string(scratch_marker).unwrap().trim());
    assert!(!scratch.exists(), "feedback scratch directory is removed");
}

#[cfg(unix)]
#[test]
fn malformed_feedback_retries_once_then_does_not_break_conversation_generation() {
    let dir = TestDirectory::new();
    let count = dir.path().join("feedback-attempts");
    let malformed = r#"{"status":"SUCCESS","structured_output":{"focus_feedback":[],"b2_rewrite":"{\"json\":true}"}}"#;
    let conversation = r#"{"status":"SUCCESS","structured_output":{"spoken_reply":"That sounds nice.","question":"What did you enjoy most?","session_phase":"active","is_complete":false}}"#;
    let script = format!(
        "case \"$2\" in *English\\ speaking\\ coach*) if [ -f '{}' ]; then echo retry >> '{}'; else touch '{}'; fi; printf '%s' '{}' ;; *) printf '%s' '{}' ;; esac",
        count.display(), count.display(), count.display(), malformed, conversation
    );
    let engine = AgyEngine {
        binary: fake_cli(&dir, &script),
    };
    let error = engine
        .evaluate_turn(&feedback_request("Hello there."))
        .unwrap_err();
    assert_eq!(error.code, ProviderErrorCode::InvalidOutput);
    assert_eq!(fs::read_to_string(count).unwrap(), "retry\n");

    let turn = engine
        .generate_turn(&context("I had a great day."))
        .unwrap();
    assert_eq!(turn.spoken_reply, "That sounds nice.");
}
