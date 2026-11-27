use super::super::super::agy::test_support::{recorded_calls, recording_cli, TestDirectory};
use super::super::super::{UsageBatchAnswer, UsageCandidate, UsageReviewRequest};
use super::review_usage_batch_with;
use crate::learning::LearningItemType;
use serde_json::{json, Value};
use std::time::Duration;

fn answer(sequence: usize, item_id: u64, target: &str) -> UsageBatchAnswer {
    UsageBatchAnswer {
        sequence,
        request: UsageReviewRequest {
            answered_question: "What happened?".into(),
            transcript: format!("Well, {target} is what I did."),
            candidates: vec![UsageCandidate {
                item_type: LearningItemType::Phrase,
                item_id,
                target: target.into(),
                cue: "meaning".into(),
            }],
        },
    }
}

fn finding(item_id: u64, excerpt: &str) -> Value {
    json!({
        "item_type": "phrase",
        "item_id": item_id,
        "outcome": "correct",
        "confidence": 0.95,
        "exact_excerpt": excerpt,
    })
}

fn envelope(answers: Value) -> String {
    json!({
        "type": "result",
        "subtype": "success",
        "is_error": false,
        "result": "",
        "structured_output": { "answers": answers },
    })
    .to_string()
}

#[test]
#[cfg(unix)]
fn every_answer_of_a_session_is_reviewed_with_one_call() {
    let dir = TestDirectory::new();
    let reply = envelope(json!([
        { "sequence": 1, "findings": [finding(7, "save time")] },
        { "sequence": 4, "findings": [finding(8, "make sense")] },
    ]));
    let cli = recording_cli(&dir, &format!("printf '%s' '{reply}'"));

    let results = review_usage_batch_with(
        &cli,
        &[answer(1, 7, "save time"), answer(4, 8, "make sense")],
    )
    .unwrap();

    assert_eq!(recorded_calls(&dir).len(), 1);
    let sequences: Vec<usize> = results.iter().map(|result| result.sequence).collect();
    assert_eq!(sequences, [1, 4]);
    assert_eq!(results[1].response.findings[0].item_id, 8);
}

#[test]
#[cfg(unix)]
fn the_prompt_carries_every_answer_with_its_sequence() {
    let dir = TestDirectory::new();
    let reply = envelope(json!([
        { "sequence": 2, "findings": [finding(7, "save time")] },
    ]));
    let cli = recording_cli(&dir, &format!("printf '%s' '{reply}'"));

    review_usage_batch_with(&cli, &[answer(2, 7, "save time")]).unwrap();

    let call = &recorded_calls(&dir)[0];
    let prompt = call.last().unwrap();
    assert!(prompt.contains("\"sequence\":2"));
    assert!(prompt.contains("Well, save time is what I did."));
}

#[test]
#[cfg(unix)]
fn an_answer_with_findings_that_do_not_validate_is_asked_again_alone() {
    let dir = TestDirectory::new();
    let bad = envelope(json!([
        { "sequence": 1, "findings": [finding(7, "save time")] },
        { "sequence": 4, "findings": [finding(8, "not in the transcript")] },
    ]));
    let good = envelope(json!([
        { "sequence": 4, "findings": [finding(8, "make sense")] },
    ]));
    let log = dir.path().join("calls.log");
    let cli = recording_cli(
        &dir,
        &format!(
            "if [ \"$(tr -cd '\\036' < '{}' | wc -c)\" -ge 2 ]; then printf '%s' '{good}'; else printf '%s' '{bad}'; fi",
            log.display()
        ),
    );

    let results = review_usage_batch_with(
        &cli,
        &[answer(1, 7, "save time"), answer(4, 8, "make sense")],
    )
    .unwrap();

    assert_eq!(recorded_calls(&dir).len(), 2);
    assert!(!recorded_calls(&dir)[1]
        .last()
        .unwrap()
        .contains("Well, save time"));
    assert_eq!(results.len(), 2);
}

#[test]
#[cfg(unix)]
fn a_reply_that_never_validates_is_an_error() {
    let dir = TestDirectory::new();
    let reply = envelope(json!([]));
    let cli = recording_cli(&dir, &format!("printf '%s' '{reply}'"));

    let error = review_usage_batch_with(&cli, &[answer(1, 7, "save time")]).unwrap_err();

    assert_eq!(recorded_calls(&dir).len(), 2);
    assert_eq!(
        error.code,
        crate::providers::ProviderErrorCode::InvalidOutput
    );
}

#[test]
fn an_empty_or_repeated_batch_is_rejected_before_any_call() {
    let binary = std::path::Path::new("/nonexistent");
    assert!(review_usage_batch_with(binary, &[]).is_err());
    assert!(review_usage_batch_with(
        binary,
        &[answer(1, 7, "save time"), answer(1, 8, "make sense")]
    )
    .is_err());
    let _ = Duration::from_secs(0);
}
