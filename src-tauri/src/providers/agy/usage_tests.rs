use super::*;
use crate::learning::LearningItemType;
use crate::providers::UsageCandidate;

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

#[test]
fn parses_valid_usage_envelope_and_validates_findings() {
    let transcript = "The main trade off is that it was slow, but I work there now.";
    let request = UsageReviewRequest {
        answered_question: "What happened?".into(),
        transcript: transcript.into(),
        candidates: vec![
            UsageCandidate {
                item_type: LearningItemType::Phrase,
                item_id: 42,
                target: "trade off".into(),
                cue: "compromise".into(),
            },
            UsageCandidate {
                item_type: LearningItemType::Mistake,
                item_id: 10,
                target: "work there".into(),
                cue: "work in there".into(),
            },
        ],
    };

    let envelope_json = r#"{
        "status": "SUCCESS",
        "structured_output": {
            "findings": [
                {
                    "item_type": "phrase",
                    "item_id": 42,
                    "outcome": "correct",
                    "confidence": 0.95,
                    "exact_excerpt": "main trade off"
                },
                {
                    "item_type": "mistake",
                    "item_id": 10,
                    "outcome": "correct",
                    "confidence": 0.91,
                    "exact_excerpt": "work there"
                }
            ]
        }
    }"#;

    let parsed = parse_usage_envelope(envelope_json).unwrap();
    let validated = validate_usage_response(parsed, &request).unwrap();
    assert_eq!(validated.findings.len(), 2);
    assert_eq!(validated.findings[0].outcome, UsageOutcome::Correct);
    assert_eq!(validated.findings[1].outcome, UsageOutcome::Correct);
}

#[test]
fn low_confidence_downgrades_to_uncertain() {
    let transcript = "I work there now.";
    let request = UsageReviewRequest {
        answered_question: "Where do you work?".into(),
        transcript: transcript.into(),
        candidates: vec![UsageCandidate {
            item_type: LearningItemType::Mistake,
            item_id: 10,
            target: "work there".into(),
            cue: "work in there".into(),
        }],
    };

    let envelope_json = r#"{
        "status": "SUCCESS",
        "structured_output": {
            "findings": [
                {
                    "item_type": "mistake",
                    "item_id": 10,
                    "outcome": "correct",
                    "confidence": 0.85,
                    "exact_excerpt": "work there"
                }
            ]
        }
    }"#;

    let parsed = parse_usage_envelope(envelope_json).unwrap();
    let validated = validate_usage_response(parsed, &request).unwrap();
    assert_eq!(validated.findings[0].outcome, UsageOutcome::Uncertain);
}

#[test]
fn rejects_bad_quotes_not_in_transcript() {
    let transcript = "I work there now.";
    let request = UsageReviewRequest {
        answered_question: "Question".into(),
        transcript: transcript.into(),
        candidates: vec![UsageCandidate {
            item_type: LearningItemType::Mistake,
            item_id: 10,
            target: "work there".into(),
            cue: "work in there".into(),
        }],
    };

    let envelope_json = r#"{
        "status": "SUCCESS",
        "structured_output": {
            "findings": [
                {
                    "item_type": "mistake",
                    "item_id": 10,
                    "outcome": "correct",
                    "confidence": 0.95,
                    "exact_excerpt": "I worked in there"
                }
            ]
        }
    }"#;

    let parsed = parse_usage_envelope(envelope_json).unwrap();
    assert!(validate_usage_response(parsed, &request).is_err());
}

#[test]
fn rejects_missing_or_unknown_candidate_identities() {
    let transcript = "I work there now.";
    let request = UsageReviewRequest {
        answered_question: "Question".into(),
        transcript: transcript.into(),
        candidates: vec![UsageCandidate {
            item_type: LearningItemType::Mistake,
            item_id: 10,
            target: "work there".into(),
            cue: "work in there".into(),
        }],
    };

    // Unknown ID 999
    let envelope_json = r#"{
        "status": "SUCCESS",
        "structured_output": {
            "findings": [
                {
                    "item_type": "mistake",
                    "item_id": 999,
                    "outcome": "correct",
                    "confidence": 0.95,
                    "exact_excerpt": "work there"
                }
            ]
        }
    }"#;
    let parsed = parse_usage_envelope(envelope_json).unwrap();
    assert!(validate_usage_response(parsed, &request).is_err());
}

#[test]
fn strict_parser_rejects_extra_fields_duplicates_and_phrase_meaning_as_quote() {
    let request = UsageReviewRequest {
        answered_question: "Question?".into(),
        transcript: "The trade off is a compromise.".into(),
        candidates: vec![UsageCandidate {
            item_type: LearningItemType::Phrase,
            item_id: 3,
            target: "trade off".into(),
            cue: "a compromise".into(),
        }],
    };
    let extra = r#"{"status":"SUCCESS","structured_output":{"findings":[{"item_type":"phrase","item_id":3,"outcome":"correct","confidence":0.95,"exact_excerpt":"trade off","extra":true}]}}"#;
    assert!(parse_usage_envelope(extra).is_err());
    let meaning_only = r#"{"findings":[{"item_type":"phrase","item_id":3,"outcome":"incorrect","confidence":0.95,"exact_excerpt":"a compromise"}]}"#;
    let raw = serde_json::from_str(meaning_only).unwrap();
    assert!(validate_usage_response(raw, &request).is_err());

    let duplicate_request = UsageReviewRequest {
        candidates: vec![
            request.candidates[0].clone(),
            UsageCandidate {
                item_type: LearningItemType::Mistake,
                item_id: 4,
                target: "trade off".into(),
                cue: "trade-off".into(),
            },
        ],
        ..request
    };
    let duplicate_findings = r#"{"findings":[{"item_type":"phrase","item_id":3,"outcome":"correct","confidence":0.95,"exact_excerpt":"trade off"},{"item_type":"phrase","item_id":3,"outcome":"correct","confidence":0.95,"exact_excerpt":"trade off"}]}"#;
    let raw = serde_json::from_str(duplicate_findings).unwrap();
    assert!(validate_usage_response(raw, &duplicate_request).is_err());
}

#[test]
fn request_validation_bounds_question_transcript_candidate_ids_and_wording() {
    let mut invalid = request();
    invalid.answered_question = " ".into();
    assert_eq!(
        validate_usage_request(&invalid).unwrap_err().code,
        ProviderErrorCode::InvalidRequest
    );

    let mut invalid = request();
    invalid.transcript = "x".repeat(4_001);
    assert_eq!(
        validate_usage_request(&invalid).unwrap_err().code,
        ProviderErrorCode::InvalidRequest
    );

    let mut invalid = request();
    invalid.candidates[0].item_id = 0;
    assert_eq!(
        validate_usage_request(&invalid).unwrap_err().code,
        ProviderErrorCode::InvalidRequest
    );

    let mut invalid = request();
    invalid.answered_question = "q".repeat(501);
    assert_eq!(
        validate_usage_request(&invalid).unwrap_err().code,
        ProviderErrorCode::InvalidRequest
    );

    let mut invalid = request();
    invalid.candidates[0].item_id = 9_007_199_254_740_992;
    assert_eq!(
        validate_usage_request(&invalid).unwrap_err().code,
        ProviderErrorCode::InvalidRequest
    );

    let mut invalid = request();
    invalid.candidates[0].target = "there".into();
    assert_eq!(
        validate_usage_request(&invalid).unwrap_err().code,
        ProviderErrorCode::InvalidRequest
    );

    let mut invalid = request();
    invalid.candidates[0].cue = "c".repeat(501);
    assert_eq!(
        validate_usage_request(&invalid).unwrap_err().code,
        ProviderErrorCode::InvalidRequest
    );

    let mut invalid = request();
    invalid.candidates[0].target = "invented wording".into();
    invalid.candidates[0].cue = "also invented".into();
    assert_eq!(
        validate_usage_request(&invalid).unwrap_err().code,
        ProviderErrorCode::InvalidRequest
    );
}

#[test]
fn request_rejects_duplicate_candidate_identity() {
    let mut invalid = request();
    invalid.candidates.push(invalid.candidates[0].clone());
    assert_eq!(
        validate_usage_request(&invalid).unwrap_err().code,
        ProviderErrorCode::InvalidRequest
    );
}

#[test]
fn low_confidence_and_empty_uncertain_quotes_are_safe() {
    let request = request();
    let raw = RawUsageResponse {
        findings: vec![RawFinding {
            item_type: "mistake".into(),
            item_id: 10,
            outcome: "uncertain".into(),
            confidence: 0.2,
            exact_excerpt: String::new(),
        }],
    };
    let result = validate_usage_response(raw, &request).unwrap();
    assert_eq!(result.findings[0].outcome, UsageOutcome::Uncertain);
    assert!(result.findings[0].exact_excerpt.is_empty());
}
