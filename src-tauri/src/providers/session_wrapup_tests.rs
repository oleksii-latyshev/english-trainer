use super::*;
use serde_json::json;

fn request() -> WrapupRequest {
    WrapupRequest {
        answers: vec![WrapupAnswer {
            sequence: 2,
            question: "What changed after you joined the team?".into(),
            transcript: "I take part in planning and I try to share the progress early.".into(),
        }],
    }
}

fn raw(phrases: serde_json::Value) -> String {
    json!({"phrases": phrases}).to_string()
}

fn phrase(sequence: usize, text: &str, note: &str, quote: &str) -> serde_json::Value {
    json!({"sequence": sequence, "phrase": text, "note": note, "you_said": quote})
}

#[test]
fn accepts_grounded_phrase_and_trims_fields() {
    let parsed = parse_wrapup_result(
        &raw(json!([phrase(
            2,
            "  take part in planning  ",
            "Use this phrase to describe contributing to a shared activity.",
            "take part in planning"
        )])),
        &request(),
    )
    .unwrap();
    assert_eq!(parsed.phrases[0].phrase, "take part in planning");
    assert_eq!(parsed.phrases[0].you_said, "take part in planning");
}

#[test]
fn accepts_no_useful_phrases() {
    assert_eq!(
        parse_wrapup_result(r#"{"phrases":[]}"#, &request()).unwrap(),
        WrapupResult { phrases: vec![] }
    );
}

#[test]
fn rejects_unknown_sequences_and_unanchored_quotes() {
    for phrases in [
        json!([phrase(
            3,
            "share progress early",
            "A concise way to explain proactive updates.",
            "share the progress early"
        )]),
        json!([phrase(
            2,
            "provide timely updates",
            "A concise way to explain proactive updates.",
            "I provide timely updates"
        )]),
    ] {
        assert_eq!(
            parse_wrapup_result(&raw(phrases), &request())
                .unwrap_err()
                .code,
            ProviderErrorCode::InvalidOutput
        );
    }
}

#[test]
fn rejects_duplicate_phrases_and_notes_that_copy_the_quote() {
    let duplicate = json!([
        phrase(
            2,
            "share progress early",
            "A concise way to describe proactive updates.",
            "share the progress early"
        ),
        phrase(
            2,
            "Share progress early!",
            "A concise way to describe proactive updates.",
            "share the progress early"
        )
    ]);
    let copied_note = json!([phrase(
        2,
        "share progress early",
        "share the progress early",
        "share the progress early"
    )]);
    for phrases in [duplicate, copied_note] {
        assert_eq!(
            parse_wrapup_result(&raw(phrases), &request())
                .unwrap_err()
                .code,
            ProviderErrorCode::InvalidOutput
        );
    }
}

#[test]
fn rejects_markup_controls_and_non_english_letters() {
    for candidate in [
        phrase(
            2,
            "**share progress early**",
            "A concise way to describe proactive updates.",
            "share the progress early",
        ),
        phrase(
            2,
            "<b>share progress early</b>",
            "A concise way to describe proactive updates.",
            "share the progress early",
        ),
        phrase(
            2,
            "share прогресс early",
            "A concise way to describe proactive updates.",
            "share the progress early",
        ),
        phrase(
            2,
            "share progress early",
            "A concise way to describe proactive updates.",
            "share the\nprogress early",
        ),
    ] {
        assert_eq!(
            parse_wrapup_result(&raw(json!([candidate])), &request())
                .unwrap_err()
                .code,
            ProviderErrorCode::InvalidOutput
        );
    }
    assert_eq!(
        parse_wrapup_result("```json {\"phrases\":[]} ```", &request())
            .unwrap_err()
            .code,
        ProviderErrorCode::InvalidOutput
    );
    let mut numeric_quote_request = request();
    numeric_quote_request.answers[0]
        .transcript
        .push_str(" 100 50");
    assert_eq!(
        parse_wrapup_result(
            &raw(json!([phrase(
                2,
                "share progress early",
                "A concise way to describe proactive updates.",
                "100 50"
            )])),
            &numeric_quote_request
        )
        .unwrap_err()
        .code,
        ProviderErrorCode::InvalidOutput
    );
    assert_eq!(
        parse_wrapup_result(
            &raw(json!([phrase(
                2,
                "share progress early",
                "12345",
                "share the progress early"
            )])),
            &request()
        )
        .unwrap_err()
        .code,
        ProviderErrorCode::InvalidOutput
    );
}

#[test]
fn rejects_more_than_three_phrases_and_oversized_raw_output() {
    let too_many = json!([
        phrase(
            2,
            "take part in planning",
            "Describe joining a shared activity.",
            "take part in planning"
        ),
        phrase(
            2,
            "share progress early",
            "Describe giving updates proactively.",
            "share the progress early"
        ),
        phrase(
            2,
            "try to be clear",
            "Describe aiming for clarity.",
            "I try to share"
        ),
        phrase(
            2,
            "plan together",
            "Describe cooperating on a plan.",
            "take part in planning"
        )
    ]);
    assert_eq!(
        parse_wrapup_result(&raw(too_many), &request())
            .unwrap_err()
            .code,
        ProviderErrorCode::InvalidOutput
    );
    assert_eq!(
        parse_wrapup_result(&" ".repeat(16_001), &request())
            .unwrap_err()
            .code,
        ProviderErrorCode::InvalidOutput
    );
}

#[test]
fn validates_request_counts_sequences_lengths_and_controls() {
    let mut invalids = vec![WrapupRequest { answers: vec![] }];
    let mut duplicate = request();
    duplicate.answers.push(duplicate.answers[0].clone());
    invalids.push(duplicate);
    let mut control = request();
    control.answers[0].transcript.push('\u{0001}');
    invalids.push(control);
    let mut oversized = request();
    oversized.answers[0].question = "q".repeat(501);
    invalids.push(oversized);
    for invalid in invalids {
        assert_eq!(
            invalid.validate().unwrap_err().code,
            ProviderErrorCode::InvalidRequest
        );
    }
    let with_tabs = WrapupRequest {
        answers: vec![WrapupAnswer {
            sequence: 1,
            question: "What changed?\nWhy?".into(),
            transcript: "I changed\tmy approach.".into(),
        }],
    };
    assert!(with_tabs.validate().is_ok());
}
