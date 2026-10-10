use super::*;
use crate::providers::agy::test_support::{recorded_calls, recording_cli, TestDirectory};
use serde_json::json;

fn request() -> WrapupRequest {
    WrapupRequest {
        answers: vec![crate::providers::WrapupAnswer {
            sequence: 4,
            question: "What did you change?".into(),
            transcript: "I said, \"we share progress early\".".into(),
        }],
    }
}

fn success(response: &str) -> String {
    json!({
        "status": "SUCCESS",
        "response": response,
        "conversation_id": "synthetic-test",
        "duration_seconds": 1.0,
        "usage": { "input_tokens": 10, "output_tokens": 8 }
    })
    .to_string()
}

#[cfg(unix)]
#[test]
fn pins_model_uses_private_scratch_and_sends_only_serialized_answers_once() {
    let directory = TestDirectory::new();
    let response = r#"{"phrases":[{"sequence":4,"phrase":"share progress early","note":"Use this phrase for giving updates before someone asks.","you_said":"share progress early"}]}"#;
    let cli = recording_cli(&directory, &format!("printf '%s' '{}'", success(response)));
    let output = generate_with_binary(&cli, &request()).unwrap();
    assert_eq!(output.phrases.len(), 1);
    let calls = recorded_calls(&directory);
    assert_eq!(calls.len(), 1);
    let args = &calls[0];
    assert_eq!(
        args[args.iter().position(|arg| arg == "--model").unwrap() + 1],
        WRAPUP_MODEL
    );
    assert!(!args.iter().any(|arg| arg == "--json-schema"));
    assert_eq!(
        args[args
            .iter()
            .position(|arg| arg == "--print-timeout")
            .unwrap()
            + 1],
        AGY_PRINT_TIMEOUT
    );
    let prompt = args[args.iter().position(|arg| arg == "--print").unwrap() + 1].as_str();
    let serialized_data = prompt.split_once("Learner data JSON: ").unwrap().1;
    let parsed_data: serde_json::Value = serde_json::from_str(serialized_data).unwrap();
    assert_eq!(
        parsed_data,
        json!({
            "answers": [{
                "sequence": 4,
                "question": "What did you change?",
                "transcript": "I said, \"we share progress early\"."
            }]
        })
    );
    assert!(prompt.contains(r#""additionalProperties":false"#));
    assert!(!prompt.contains("profile"));
    assert!(!prompt.contains("history"));
    let cwd = args[args.iter().position(|arg| arg == "--log-file").unwrap() + 1]
        .strip_suffix("/agy.log")
        .unwrap();
    assert!(cwd.starts_with(std::env::temp_dir().to_str().unwrap()));
    assert!(!cwd.contains("english-trainer"));
}

#[test]
fn accepts_envelope_metadata_and_rejects_malformed_or_fenced_content() {
    let request = request();
    let valid = success(r#"{"phrases":[]}"#);
    assert_eq!(parse_envelope(&valid, &request).unwrap().phrases.len(), 0);
    for output in [
        "not-json".to_owned(),
        success("```json {\"phrases\":[]} ```"),
        json!({"status":"ERROR","response":"{}"}).to_string(),
    ] {
        assert_eq!(
            parse_envelope(&output, &request).unwrap_err().code,
            ProviderErrorCode::InvalidOutput
        );
    }
}

#[cfg(unix)]
#[test]
fn preserves_quota_error_without_retry_and_rejects_invalid_request_before_call() {
    let directory = TestDirectory::new();
    let quota = recording_cli(&directory, "printf 'RESOURCE_EXHAUSTED' >&2\nexit 1");
    let error = generate_with_binary(&quota, &request()).unwrap_err();
    assert_eq!(error.code, ProviderErrorCode::RateLimited);
    assert_eq!(recorded_calls(&directory).len(), 1);

    let mut invalid = request();
    invalid.answers.clear();
    assert_eq!(
        generate_with_binary(std::path::Path::new("missing-agy"), &invalid)
            .unwrap_err()
            .code,
        ProviderErrorCode::InvalidRequest
    );
}

#[test]
#[ignore = "explicit synthetic live provider smoke test"]
fn live_synthetic_wrapup_smoke_reports_only_status_and_elapsed_time() {
    let started = std::time::Instant::now();
    let result = generate_session_wrapup(&request());
    eprintln!(
        "status={:?} elapsed_ms={}",
        result.as_ref().map(|_| "ok"),
        started.elapsed().as_millis()
    );
    assert!(result.is_ok());
}
