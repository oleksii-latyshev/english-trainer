use super::*;
use crate::providers::agy::test_support::{recorded_calls, recording_cli, TestDirectory};
use serde_json::json;

fn request() -> ReviewMaterialRequest {
    ReviewMaterialRequest {
        items: vec![
            crate::providers::ReviewTarget {
                position: 2,
                target: "take ownership".into(),
                note: "Use this when accepting responsibility for a task.".into(),
            },
            crate::providers::ReviewTarget {
                position: 1,
                target: "I'd rather … than …".into(),
                note: "Use this to compare a preference with an alternative.".into(),
            },
        ],
    }
}

fn response() -> &'static str {
    r#"{"items":[{"position":1,"situation":"A teammate must choose whether to repair an old service or replace it before launch.","model_answer":"I'd rather repair the old service than replace it before launch."},{"position":2,"situation":"A project needs one person to take responsibility for the release checklist.","model_answer":"I will take ownership of the release checklist before we ship."}]}"#
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

fn shell_quote(value: &str) -> String {
    format!("'{}'", value.replace('\'', "'\\''"))
}

#[cfg(unix)]
#[test]
fn pins_model_uses_private_scratch_and_sends_only_serialized_targets_once() {
    let directory = TestDirectory::new();
    let body = format!("printf '%s' {}", shell_quote(&success(response())));
    let cli = recording_cli(&directory, &body);
    let result = generate_with_binary(&cli, &request()).unwrap();
    assert_eq!(result.items.len(), 2);
    assert_eq!(result.items[0].position, 2);
    let calls = recorded_calls(&directory);
    assert_eq!(calls.len(), 1);
    let args = &calls[0];
    assert_eq!(
        args[args.iter().position(|arg| arg == "--model").unwrap() + 1],
        SPOKEN_REVIEW_MODEL
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
    let serialized_data = prompt.split_once("Saved review targets JSON: ").unwrap().1;
    let parsed_data: serde_json::Value = serde_json::from_str(serialized_data).unwrap();
    assert_eq!(
        parsed_data,
        json!({
            "items": [
                {
                    "position": 2,
                    "target": "take ownership",
                    "note": "Use this when accepting responsibility for a task."
                },
                {
                    "position": 1,
                    "target": "I'd rather … than …",
                    "note": "Use this to compare a preference with an alternative."
                }
            ]
        })
    );
    assert!(prompt.contains(r#""additionalProperties":false"#));
    assert!(!prompt.contains("profile"));
    assert!(!prompt.contains("transcript"));
    let cwd = args[args.iter().position(|arg| arg == "--log-file").unwrap() + 1]
        .strip_suffix("/agy.log")
        .unwrap();
    assert!(cwd.starts_with(std::env::temp_dir().to_str().unwrap()));
    assert!(!cwd.contains("english-trainer"));
}

#[test]
fn accepts_metadata_and_rejects_malformed_or_fenced_output() {
    let request = request();
    assert_eq!(
        parse_envelope(&success(response()), &request)
            .unwrap()
            .items
            .len(),
        2
    );
    let fenced = format!(
        "{}{}json {{}} {}{}",
        char::from(96),
        char::from(96),
        char::from(96),
        char::from(96)
    );
    for output in [
        "not-json".to_owned(),
        success(&fenced),
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
fn quota_is_rate_limited_without_retry_and_invalid_request_skips_the_process() {
    let directory = TestDirectory::new();
    let quota = recording_cli(&directory, "printf 'RESOURCE_EXHAUSTED' >&2\nexit 1");
    let error = generate_with_binary(&quota, &request()).unwrap_err();
    assert_eq!(error.code, ProviderErrorCode::RateLimited);
    assert_eq!(recorded_calls(&directory).len(), 1);

    let invalid = ReviewMaterialRequest { items: vec![] };
    assert_eq!(
        generate_with_binary(std::path::Path::new("missing-agy"), &invalid)
            .unwrap_err()
            .code,
        ProviderErrorCode::InvalidRequest
    );
}

#[test]
#[ignore = "explicit synthetic live provider smoke test"]
fn live_synthetic_spoken_review_smoke_reports_only_status_and_elapsed_time() {
    let started = std::time::Instant::now();
    let result = generate_review_material(&request());
    eprintln!(
        "status={:?} elapsed_ms={}",
        result.as_ref().map(|_| "ok"),
        started.elapsed().as_millis()
    );
    assert!(result.is_ok());
}
