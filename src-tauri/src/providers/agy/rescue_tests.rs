use super::*;
use crate::providers::agy::test_support::{recorded_calls, recording_cli, TestDirectory};

fn request(kind: RescueKind) -> RescueRequest {
    RescueRequest {
        kind,
        question: "How do you feel about remote work?".into(),
        partial_transcript: "I prefer it because".into(),
        description: String::new(),
    }
}

fn success(response: &str) -> String {
    json!({
        "status": "SUCCESS",
        "response": response,
        "conversation_id": "synthetic-test",
        "duration_seconds": 1.0,
        "num_turns": 1,
        "usage": { "input_tokens": 10, "output_tokens": 8 }
    })
    .to_string()
}

#[cfg(unix)]
#[test]
fn pins_model_uses_private_scratch_and_sends_strict_json_prompt() {
    let directory = TestDirectory::new();
    let cli = recording_cli(
        &directory,
        &format!(
            "printf '%s' '{}'",
            success(r#"{"kind":"next_step","suggestion":"One reason is the shorter commute."}"#)
        ),
    );
    let response = generate_with_binary(&cli, &request(RescueKind::NextStep)).unwrap();
    assert!(matches!(response, RescueResponse::NextStep { .. }));
    let calls = recorded_calls(&directory);
    assert_eq!(calls.len(), 1);
    let args = &calls[0];
    assert_eq!(
        args[args.iter().position(|arg| arg == "--model").unwrap() + 1],
        RESCUE_MODEL
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
    assert!(prompt.contains("How do you feel about remote work?"));
    assert!(prompt.contains("I prefer it because"));
    assert!(prompt.contains(r#"{"kind":"next_step","suggestion":"..."}"#));
    assert!(prompt.contains("\"additionalProperties\":false"));
    assert!(!prompt.contains("profile"));
    assert!(!prompt.contains("history"));
    let cwd = args[args.iter().position(|arg| arg == "--log-file").unwrap() + 1]
        .strip_suffix("/agy.log")
        .unwrap();
    assert!(cwd.starts_with(std::env::temp_dir().to_str().unwrap()));
    assert!(!cwd.contains("english-trainer"));
}

#[test]
fn prompt_embeds_a_kind_specific_closed_schema() {
    let missing = make_prompt(&request(RescueKind::MissingWord));
    assert!(missing.contains(r#"{"kind":"missing_word","candidates":["...","...","..."]}"#));
    assert!(missing.contains("\"minItems\":3"));
    assert!(missing.contains("\"maxItems\":5"));
    assert!(!missing.contains("\"kind\":\"next_step\""));
}

#[test]
fn accepts_cli_envelope_metadata_and_validates_response_text() {
    let output = success(r#"{"kind":"next_step","suggestion":"One reason is the commute."}"#);
    assert!(matches!(
        parse_envelope(&output, RescueKind::NextStep),
        Ok(RescueResponse::NextStep { .. })
    ));
}

#[cfg(unix)]
#[test]
fn rejects_malformed_and_mismatched_response_and_maps_quota_and_missing_binary_errors() {
    let directory = TestDirectory::new();
    let malformed = recording_cli(&directory, "printf '%s' 'not-json'");
    assert_eq!(
        generate_with_binary(&malformed, &request(RescueKind::NextStep))
            .unwrap_err()
            .code,
        ProviderErrorCode::InvalidOutput
    );
    let mismatch = recording_cli(
        &directory,
        &format!(
            "printf '%s' '{}'",
            success(r#"{"kind":"simpler","suggestion":"Say it in a simple way."}"#)
        ),
    );
    assert_eq!(
        generate_with_binary(&mismatch, &request(RescueKind::NextStep))
            .unwrap_err()
            .code,
        ProviderErrorCode::InvalidOutput
    );
    let fenced = recording_cli(
        &directory,
        &format!("printf '%s' '{}'", success("```json {} ```")),
    );
    assert_eq!(
        generate_with_binary(&fenced, &request(RescueKind::NextStep))
            .unwrap_err()
            .code,
        ProviderErrorCode::InvalidOutput
    );
    let quota = recording_cli(&directory, "printf 'RESOURCE_EXHAUSTED' >&2\nexit 1");
    let error = generate_with_binary(&quota, &request(RescueKind::NextStep)).unwrap_err();
    assert_eq!(error.code, ProviderErrorCode::RateLimited);
    assert!(error.message.contains("Keep speaking"));
    let missing = map_runner_error(ProviderError::new(
        ProviderErrorCode::Unavailable,
        "private detail",
    ));
    assert_eq!(missing.code, ProviderErrorCode::Unavailable);
    assert!(!missing.message.contains("private detail"));
}

#[test]
fn invalid_request_is_rejected_before_binary_invocation() {
    let mut invalid = request(RescueKind::NextStep);
    invalid.partial_transcript.clear();
    assert_eq!(
        generate_with_binary(std::path::Path::new("missing-agy"), &invalid)
            .unwrap_err()
            .code,
        ProviderErrorCode::InvalidRequest
    );
}

#[test]
#[ignore = "Requires configured agy and makes one synthetic Gemini request"]
fn live_synthetic_next_step_smoke_and_latency() {
    let request = RescueRequest {
        kind: RescueKind::NextStep,
        question: "What do you like about working remotely?".into(),
        partial_transcript: "I like working remotely because".into(),
        description: String::new(),
    };
    let started = std::time::Instant::now();
    let response = generate_rescue(&request);
    let elapsed_ms = started.elapsed().as_millis();
    match response {
        Ok(RescueResponse::NextStep { .. }) => eprintln!("status=ok elapsed_ms={elapsed_ms}"),
        Ok(_) => {
            eprintln!("status=wrong_variant elapsed_ms={elapsed_ms}");
            panic!("Rescue smoke test returned the wrong response variant.");
        }
        Err(_) => {
            eprintln!("status=error elapsed_ms={elapsed_ms}");
            panic!("Rescue smoke test did not return a usable response.");
        }
    }
}
