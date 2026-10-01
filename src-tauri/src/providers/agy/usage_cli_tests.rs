use super::*;
use crate::{learning::LearningItemType, providers::UsageCandidate};
use std::{
    fs,
    path::PathBuf,
    sync::atomic::{AtomicU64, Ordering},
};

static TEST_SEQUENCE: AtomicU64 = AtomicU64::new(0);

struct TestDirectory(PathBuf);

impl TestDirectory {
    fn new() -> Self {
        let id = TEST_SEQUENCE.fetch_add(1, Ordering::Relaxed);
        let path = std::env::temp_dir().join(format!(
            "eng-trainer-usage-cli-test-{}-{id}",
            std::process::id()
        ));
        fs::create_dir(&path).unwrap();
        Self(path)
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
    let path = dir.0.join("fake-agy");
    fs::write(&path, format!("#!/bin/sh\n{body}\n")).unwrap();
    fs::set_permissions(&path, fs::Permissions::from_mode(0o700)).unwrap();
    path
}

fn request() -> UsageReviewRequest {
    UsageReviewRequest {
        answered_question: "What happened?".into(),
        transcript: "I work there now.".into(),
        candidates: vec![UsageCandidate {
            item_type: LearningItemType::Mistake,
            item_id: 10,
            target: "work there".into(),
            cue: "work in there".into(),
        }],
    }
}

#[cfg(unix)]
#[test]
fn fake_cli_receives_request_and_schema_and_succeeds_after_invalid_retry() {
    let dir = TestDirectory::new();
    let prompt_path = dir.0.join("prompts");
    let schema_path = dir.0.join("schema");
    let attempts_path = dir.0.join("attempts");
    let scratch_path = dir.0.join("scratch-path");
    let invalid = r#"{"status":"SUCCESS","structured_output":{"findings":[]}}"#;
    let valid = r#"{"status":"SUCCESS","structured_output":{"findings":[{"item_type":"mistake","item_id":10,"outcome":"correct","confidence":0.95,"exact_excerpt":"I work there now"}]}}"#;
    let script = format!(
        "while [ \"$#\" -gt 0 ]; do case \"$1\" in --print) shift; printf '%s\\n' \"$1\" >> '{}';; --json-schema) shift; cat \"$1\" > '{}';; esac; shift; done; pwd > '{}'; if [ -f '{}' ]; then printf '%s' '{}'; else touch '{}'; printf '%s' '{}'; fi",
        prompt_path.display(), schema_path.display(), scratch_path.display(), attempts_path.display(), valid, attempts_path.display(), invalid
    );
    let engine = AgyEngine {
        binary: fake_cli(&dir, &script),
    };

    let result = engine.review_usage(&request()).unwrap();
    assert_eq!(result.findings[0].outcome, UsageOutcome::Correct);
    let prompts = fs::read_to_string(prompt_path).unwrap();
    assert_eq!(prompts.lines().count(), 2);
    assert!(prompts.contains("What happened?"));
    assert!(prompts.contains("I work there now."));
    assert!(prompts.contains("work in there"));
    assert!(prompts.contains("Do not call tools or access, inspect, or modify files."));
    assert!(prompts.contains("Your previous output was invalid"));
    let schema: serde_json::Value =
        serde_json::from_str(&fs::read_to_string(schema_path).unwrap()).unwrap();
    assert_eq!(schema["additionalProperties"], false);
    assert_eq!(schema["properties"]["findings"]["maxItems"], 3);
    let scratch = PathBuf::from(fs::read_to_string(scratch_path).unwrap().trim());
    assert!(!scratch.exists());
}

#[cfg(unix)]
#[test]
fn fake_cli_retries_two_invalid_outputs_then_cleans_scratch() {
    let dir = TestDirectory::new();
    let counter = dir.0.join("attempts");
    let scratch_path = dir.0.join("scratch-path");
    let invalid = r#"{"status":"SUCCESS","structured_output":{"findings":[]}}"#;
    let script = format!(
        "pwd > '{}'; if [ -f '{}' ]; then echo retry >> '{}'; else touch '{}'; fi; printf '%s' '{}'",
        scratch_path.display(), counter.display(), counter.display(), counter.display(), invalid
    );
    let engine = AgyEngine {
        binary: fake_cli(&dir, &script),
    };
    let error = engine.review_usage(&request()).unwrap_err();
    assert_eq!(error.code, ProviderErrorCode::InvalidOutput);
    assert_eq!(fs::read_to_string(counter).unwrap(), "retry\n");
    let scratch = PathBuf::from(fs::read_to_string(scratch_path).unwrap().trim());
    assert!(!scratch.exists());
}

#[cfg(unix)]
#[test]
fn fake_cli_process_failure_is_typed_and_cleans_scratch() {
    let dir = TestDirectory::new();
    let counter = dir.0.join("calls");
    let scratch_path = dir.0.join("scratch-path");
    let script = format!(
        "echo called >> '{}'; pwd > '{}'; exit 17",
        counter.display(),
        scratch_path.display()
    );
    let engine = AgyEngine {
        binary: fake_cli(&dir, &script),
    };
    let error = engine.review_usage(&request()).unwrap_err();
    assert_eq!(error.code, ProviderErrorCode::ProcessFailed);
    assert_eq!(fs::read_to_string(counter).unwrap().lines().count(), 1);
    let scratch = PathBuf::from(fs::read_to_string(scratch_path).unwrap().trim());
    assert!(!scratch.exists());
}

#[test]
fn scratch_directory_creates_and_cleans_up_on_drop() {
    let path = {
        let scratch = ScratchDirectory::new().unwrap();
        assert!(scratch.path().is_dir());
        scratch.path().to_path_buf()
    };
    assert!(!path.exists());
}
