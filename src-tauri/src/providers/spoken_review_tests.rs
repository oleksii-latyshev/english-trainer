use super::*;
use serde_json::json;

fn request() -> ReviewMaterialRequest {
    ReviewMaterialRequest {
        items: vec![
            ReviewTarget {
                position: 2,
                target: "take ownership".into(),
                note: "Use this when accepting responsibility for a task.".into(),
            },
            ReviewTarget {
                position: 1,
                target: "I'd rather … than …".into(),
                note: "Use this to compare a preference with an alternative.".into(),
            },
        ],
    }
}

fn material(position: usize, situation: &str, answer: &str) -> serde_json::Value {
    json!({
        "position": position,
        "situation": situation,
        "model_answer": answer
    })
}

fn valid_items() -> serde_json::Value {
    json!([
        material(
            1,
            "A teammate must choose whether to repair an old service or replace it before launch.",
            "I'd rather repair the old service than replace it before launch."
        ),
        material(
            2,
            "A project needs one person to take responsibility for the release checklist.",
            "I will take ownership of the release checklist before we ship."
        )
    ])
}

fn raw(items: serde_json::Value) -> String {
    json!({"items": items}).to_string()
}

#[test]
fn accepts_all_positions_trims_fields_and_orders_like_the_request() {
    let mut items = valid_items();
    items[0]["situation"] = json!(
        "  A teammate must choose whether to repair an old service or replace it before launch.  "
    );
    items[0]["model_answer"] =
        json!("  I'd rather repair the old service than replace it before launch.  ");
    let parsed = parse_review_material_result(&raw(items), &request()).unwrap();
    assert_eq!(parsed.items[0].position, 2);
    assert_eq!(parsed.items[1].position, 1);
    assert_eq!(
        parsed.items[0].model_answer,
        "I will take ownership of the release checklist before we ship."
    );
}

#[test]
fn accepts_a_target_that_is_already_a_complete_sentence_and_ellipsis_targets() {
    let sentence_request = ReviewMaterialRequest {
        items: vec![ReviewTarget {
            position: 1,
            target: "I would choose the simpler option.".into(),
            note: String::new(),
        }],
    };
    let sentence = raw(json!([material(
        1,
        "A team has two choices and wants a direct personal preference.",
        "I would choose the simpler option."
    )]));
    assert!(parse_review_material_result(&sentence, &sentence_request).is_ok());
    assert!(parse_review_material_result(&raw(valid_items()), &request()).is_ok());
}

#[test]
fn rejects_missing_duplicate_unknown_and_leaking_positions() {
    let valid = valid_items();
    let cases = [
        json!([valid[0].clone()]),
        json!([valid[0].clone(), valid[0].clone()]),
        json!([
            material(
                3,
                "A teammate chooses a preferred plan for launch.",
                "I will take ownership of the release checklist before we ship."
            ),
            valid[1].clone()
        ]),
        json!([
            valid[0].clone(),
            material(
                2,
                "Explain how to take ownership of the release checklist.",
                "I will take ownership of the release checklist before we ship."
            )
        ]),
    ];
    for items in cases {
        assert_eq!(
            parse_review_material_result(&raw(items), &request())
                .unwrap_err()
                .code,
            ProviderErrorCode::InvalidOutput
        );
    }
}

#[test]
fn rejects_answers_without_target_wording_or_a_complete_sentence() {
    let cases = [
        material(
            1,
            "A teammate must choose whether to repair an old service or replace it before launch.",
            "I prefer repairing the old service rather than replacing it before launch.",
        ),
        material(
            2,
            "A project needs one person to take responsibility for the release checklist.",
            "I take ownership.",
        ),
        material(
            2,
            "A project needs one person to take responsibility for the release checklist.",
            "I will take ownership of the release checklist before we ship",
        ),
    ];
    for invalid in cases {
        let result = if invalid["position"] == 1 {
            raw(json!([invalid, valid_items()[1].clone()]))
        } else {
            raw(json!([valid_items()[0].clone(), invalid]))
        };
        assert_eq!(
            parse_review_material_result(&result, &request())
                .unwrap_err()
                .code,
            ProviderErrorCode::InvalidOutput
        );
    }
}

#[test]
fn rejects_oversized_markup_control_and_non_english_output() {
    let valid = valid_items();
    for (position, field, invalid_value) in [
        (
            2,
            "situation",
            "<b>A project needs one person for a release task.</b>",
        ),
        (
            2,
            "situation",
            "Проект needs one person for a release task.",
        ),
        (
            2,
            "model_answer",
            "I will take ownership of the release checklist.\u{0001}",
        ),
        (
            2,
            "model_answer",
            "I will **take ownership** of the release checklist.",
        ),
    ] {
        let mut items = valid.clone();
        let item = items
            .as_array_mut()
            .unwrap()
            .iter_mut()
            .find(|item| item["position"] == position)
            .unwrap();
        item[field] = json!(invalid_value);
        assert_eq!(
            parse_review_material_result(&raw(items), &request())
                .unwrap_err()
                .code,
            ProviderErrorCode::InvalidOutput
        );
    }
    let mut long_situation = valid;
    long_situation[1]["situation"] = json!("A ".repeat(251));
    assert_eq!(
        parse_review_material_result(&raw(long_situation), &request())
            .unwrap_err()
            .code,
        ProviderErrorCode::InvalidOutput
    );
    assert_eq!(
        parse_review_material_result(&" ".repeat(24_001), &request())
            .unwrap_err()
            .code,
        ProviderErrorCode::InvalidOutput
    );
}

#[test]
fn rejects_empty_or_ambiguous_requests() {
    for invalid in [
        ReviewMaterialRequest { items: vec![] },
        ReviewMaterialRequest {
            items: vec![request().items[0].clone(), request().items[0].clone()],
        },
        ReviewMaterialRequest {
            items: vec![ReviewTarget {
                position: 7,
                target: "take ownership".into(),
                note: String::new(),
            }],
        },
        ReviewMaterialRequest {
            items: vec![ReviewTarget {
                position: 1,
                target: "take ownership\u{0001}".into(),
                note: String::new(),
            }],
        },
    ] {
        assert_eq!(
            invalid.validate().unwrap_err().code,
            ProviderErrorCode::InvalidRequest
        );
    }
}
