use super::super::test_support::{recorded_calls, recording_cli, TestDirectory};
use super::*;
use std::{fs, path::Path, time::Duration};

fn target() -> MistakePracticeCandidate {
    MistakePracticeCandidate {
        id: 7,
        original: "I work in there".into(),
        corrected: "I work there".into(),
        explanation: "This verb does not need a preposition here.".into(),
        times_seen: 3,
        last_seen_at: 100,
    }
}

fn valid_output() -> String {
    let questions = [
        "What kind of projects do you enjoy most?",
        "Which task would you choose for a free afternoon?",
        "What work have you found especially satisfying lately?",
        "How do you decide which project to take on next?",
        "What would make your ideal workday memorable?",
    ];
    let entries: Vec<_> = questions
        .iter()
        .map(|question| json!({ "mistake_id": 7, "question": question }))
        .collect();
    json!({ "status": "SUCCESS", "structured_output": { "questions": entries } }).to_string()
}

#[test]
fn fake_cli_pins_gemini_and_parses_five_questions() {
    let dir = TestDirectory::new();
    let body = format!("printf '%s' '{}'", valid_output().replace('\'', "'\\''"));
    let cli = recording_cli(&dir, &body);
    let questions = generate_with_binary(&cli, &[target()]).unwrap();
    assert_eq!(questions.len(), 5);
    let calls = recorded_calls(&dir);
    let model_index = calls[0]
        .iter()
        .position(|argument| argument == "--model")
        .unwrap();
    assert_eq!(
        calls[0].get(model_index + 1).map(String::as_str),
        Some("gemini-3.8-flash-medium")
    );
}

#[test]
fn rejects_unknown_targets_duplicate_questions_and_leaked_or_non_english_text() {
    let valid = vec![
        "What kind of projects do you enjoy most?".to_string(),
        "Which task would you choose for a free afternoon?".to_string(),
        "What work have you found especially satisfying lately?".to_string(),
        "How do you decide which project to take on next?".to_string(),
        "What would make your ideal workday memorable?".to_string(),
    ];
    let plan = |questions: Vec<String>| Plan {
        questions: questions
            .into_iter()
            .map(|question| RawQuestion {
                mistake_id: 7,
                question,
            })
            .collect(),
    };
    assert!(validate_plan(plan(valid.clone()), &[target()]).is_ok());
    let mut duplicate = valid.clone();
    duplicate[4] = duplicate[0].replace('?', " ?");
    assert_eq!(
        validate_plan(plan(duplicate), &[target()])
            .unwrap_err()
            .code,
        ProviderErrorCode::InvalidOutput
    );
    let mut leaked = valid.clone();
    leaked[0] = "Tell me why I work there is useful?".into();
    assert_eq!(
        validate_plan(plan(leaked), &[target()]).unwrap_err().code,
        ProviderErrorCode::InvalidOutput
    );
    let mut non_english = valid.clone();
    non_english[0] = "你喜欢什么样的项目？".into();
    assert_eq!(
        validate_plan(plan(non_english), &[target()])
            .unwrap_err()
            .code,
        ProviderErrorCode::InvalidOutput
    );
    let mut unknown = plan(valid);
    unknown.questions[0].mistake_id = 88;
    assert_eq!(
        validate_plan(unknown, &[target()]).unwrap_err().code,
        ProviderErrorCode::InvalidOutput
    );
}

#[test]
fn quota_envelope_returns_a_typed_rate_limit_error() {
    let output = r#"{"status":"ERROR","response":"quota exceeded"}"#;
    assert_eq!(
        parse_and_validate(output, &[target()]).unwrap_err().code,
        ProviderErrorCode::RateLimited
    );
}

fn generate_with_binary(
    binary: &Path,
    candidates: &[MistakePracticeCandidate],
) -> Result<Vec<GeneratedMistakeQuestion>, ProviderError> {
    let workspace = runner::ScratchDirectory::new().unwrap();
    let schema = workspace.path().join("schema.json");
    fs::write(&schema, SCHEMA).unwrap();
    let output = run_cli(
        binary,
        workspace.path(),
        &schema,
        &workspace.path().join("agy.log"),
        TASK,
        CliOptions {
            timeout: Duration::from_secs(10),
            model: AGY_DEFAULT_MODEL,
        },
    )?;
    parse_and_validate(&output, candidates)
}
