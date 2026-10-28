use super::*;
use serde_json::json;

fn mistake() -> LessonRequest {
    LessonRequest {
        mistake_id: 4,
        question: "Where did you work last year?".into(),
        said: "I worked there since 2020".into(),
        corrected: "I have worked there since 2020".into(),
        review_explanation: "Use Present Perfect with since.".into(),
    }
}

fn batch(mistakes: Vec<LessonRequest>) -> LessonBatchRequest {
    LessonBatchRequest {
        mistakes,
        missing_card_keys: vec![RuleKey::PastSimpleVsPresentPerfect, RuleKey::Articles],
    }
}

fn good_lesson(id: i64) -> Value {
    json!({
        "mistake_id": id,
        "rule_key": "past_simple_vs_present_perfect",
        "explanation": "With since, the action still goes on, so English uses Present Perfect.",
        "contrast": [
            {"label": "Finished", "sentence": "I worked there in 2020."},
            {"label": "Up to now", "sentence": "I have worked there since 2020."}
        ],
        "examples": ["She has lived here since May.", "We have known him for years."],
        "gaps": [{"start": 1, "end": 2}],
        "accepted": ["I've worked there since 2020", "I have been working there since 2020"],
        "situations": ["How long have you known your best friend?", "What have you done this week?"]
    })
}

fn card(key: &str) -> Value {
    json!({
        "rule_key": key,
        "body": "Use Present Perfect when the time runs up to now.",
        "examples": ["I have lived here for years.", "She has never been to Rome."]
    })
}

fn validated(lesson: Value) -> ValidatedBatch {
    validate_batch(
        &batch(vec![mistake()]),
        RawLessonBatch {
            lessons: vec![lesson],
            rule_cards: vec![],
        },
    )
}

fn changed(field: &str, value: Value) -> Value {
    let mut lesson = good_lesson(4);
    lesson[field] = value;
    lesson
}

#[test]
fn a_complete_lesson_is_accepted_with_its_fields() {
    let result = validated(good_lesson(4));
    assert!(result.rejected.is_empty());
    let (id, lesson) = &result.lessons[0];
    assert_eq!(*id, 4);
    assert_eq!(lesson.rule_key, RuleKey::PastSimpleVsPresentPerfect);
    assert_eq!(lesson.gaps, [WordRange { start: 1, end: 2 }]);
    assert_eq!(lesson.accepted.len(), 2);
    assert_eq!(lesson.contrast[1].label, "Up to now");
    assert_eq!(lesson.word, None);
}

#[test]
fn each_broken_field_rejects_only_its_own_lesson() {
    let cases = [
        ("an unknown rule", changed("rule_key", json!("tenses"))),
        ("an empty explanation", changed("explanation", json!("  "))),
        (
            "a long explanation",
            changed("explanation", json!("x".repeat(301))),
        ),
        (
            "one contrast line",
            changed("contrast", json!([{"label": "A", "sentence": "B."}])),
        ),
        (
            "three examples",
            changed("examples", json!(["a", "b", "c"])),
        ),
        (
            "a long example",
            changed("examples", json!(["a", "x".repeat(121)])),
        ),
        ("one situation", changed("situations", json!(["What now?"]))),
        (
            "a statement as situation",
            changed("situations", json!(["Tell me.", "What now?"])),
        ),
        (
            "non English text",
            changed("explanation", json!("Это правило")),
        ),
    ];
    for (name, lesson) in cases {
        let result = validated(lesson);
        assert_eq!(result.rejected, [4], "{name}");
        assert!(result.lessons.is_empty(), "{name}");
    }
}

#[test]
fn a_bad_entry_costs_only_its_own_lesson() {
    let other = LessonRequest {
        mistake_id: 9,
        ..mistake()
    };
    let result = validate_batch(
        &batch(vec![mistake(), other]),
        RawLessonBatch {
            lessons: vec![changed("rule_key", json!("nope")), good_lesson(9)],
            rule_cards: vec![],
        },
    );
    assert_eq!(result.rejected, [4]);
    assert_eq!(result.lessons.len(), 1);
    assert_eq!(result.lessons[0].0, 9);
}

#[test]
fn missing_unknown_duplicate_and_unreadable_entries_are_handled() {
    let result = validate_batch(
        &batch(vec![mistake()]),
        RawLessonBatch {
            lessons: vec![
                json!({"mistake_id": 4}),
                good_lesson(77),
                good_lesson(4),
                good_lesson(4),
            ],
            rule_cards: vec![],
        },
    );
    assert_eq!(result.lessons.len(), 1);
    assert!(result.rejected.is_empty());

    let nothing = validate_batch(&batch(vec![mistake()]), RawLessonBatch::default());
    assert_eq!(nothing.rejected, [4]);
}

#[test]
fn gaps_the_model_got_wrong_fall_back_to_the_changed_words() {
    for (name, gaps) in [
        ("the wrong word", json!([{"start": 2, "end": 3}])),
        ("far too many words", json!([{"start": 0, "end": 6}])),
        ("outside the sentence", json!([{"start": 1, "end": 20}])),
        ("empty range", json!([{"start": 1, "end": 1}])),
        ("no ranges", json!([])),
        ("negative", json!([{"start": -1, "end": 2}])),
    ] {
        let result = validated(changed("gaps", gaps));
        assert_eq!(
            result.lessons[0].1.gaps,
            [WordRange { start: 1, end: 2 }],
            "{name}"
        );
    }
}

#[test]
fn gaps_may_take_a_few_words_around_a_change() {
    let order = LessonRequest {
        said: "how exactly work this function".into(),
        corrected: "how exactly this function works".into(),
        ..mistake()
    };
    let result = validate_batch(
        &batch(vec![order]),
        RawLessonBatch {
            lessons: vec![changed("gaps", json!([{"start": 2, "end": 5}]))],
            rule_cards: vec![],
        },
    );
    assert_eq!(result.lessons[0].1.gaps, [WordRange { start: 2, end: 5 }]);
}

#[test]
fn a_lesson_without_any_usable_gap_is_rejected() {
    let same = LessonRequest {
        said: "I have worked there since 2020".into(),
        ..mistake()
    };
    let result = validate_batch(
        &batch(vec![same]),
        RawLessonBatch {
            lessons: vec![changed("gaps", json!([{"start": 0, "end": 6}]))],
            rule_cards: vec![],
        },
    );
    assert_eq!(result.rejected, [4]);
}

#[test]
fn gaps_for_two_separate_changes_must_be_ordered_and_apart() {
    let two = LessonRequest {
        said: "She go to school yesterday".into(),
        corrected: "She goes to the school today".into(),
        ..mistake()
    };
    let lesson = |gaps: Value| {
        validate_batch(
            &batch(vec![two.clone()]),
            RawLessonBatch {
                lessons: vec![changed("gaps", gaps)],
                rule_cards: vec![],
            },
        )
    };
    let ok =
        lesson(json!([{"start": 1, "end": 2}, {"start": 3, "end": 4}, {"start": 5, "end": 6}]));
    assert_eq!(ok.lessons.len(), 1);
    let unordered =
        lesson(json!([{"start": 3, "end": 4}, {"start": 1, "end": 2}, {"start": 5, "end": 6}]));
    assert_eq!(
        unordered.lessons[0].1.gaps,
        [
            WordRange { start: 1, end: 2 },
            WordRange { start: 3, end: 4 },
            WordRange { start: 5, end: 6 }
        ]
    );
}

#[test]
fn a_pure_deletion_accepts_a_small_range_next_to_it() {
    let deletion = LessonRequest {
        said: "I went to home".into(),
        corrected: "I went home".into(),
        ..mistake()
    };
    let result = validate_batch(
        &batch(vec![deletion]),
        RawLessonBatch {
            lessons: vec![changed("gaps", json!([{"start": 2, "end": 3}]))],
            rule_cards: vec![],
        },
    );
    assert_eq!(result.lessons.len(), 1);
}

#[test]
fn accepted_rewrites_drop_the_wrong_wording_the_correction_and_repeats() {
    let result = validated(changed(
        "accepted",
        json!([
            "I worked there since 2020.",
            "I have worked there since 2020",
            "I've been there since 2020",
            "i've been there since 2020!",
            "A",
            "B",
            "C",
            "D"
        ]),
    ));
    let accepted = &result.lessons[0].1.accepted;
    assert_eq!(accepted, &["I've been there since 2020", "A", "B", "C"]);
}

#[test]
fn situations_must_not_contain_the_corrected_or_the_wrong_wording() {
    for question in [
        "Have you said I have worked there since 2020?",
        "Why do you say I worked there since 2020?",
    ] {
        let result = validated(changed(
            "situations",
            json!([question, "What have you done today?"]),
        ));
        assert_eq!(result.rejected, [4], "{question}");
    }
}

#[test]
fn an_optional_word_is_kept_when_complete_and_dropped_when_empty() {
    let with_word = validated(changed(
        "word",
        json!({"word": "drawback", "meaning": "a disadvantage"}),
    ));
    assert_eq!(
        with_word.lessons[0].1.word,
        Some(LessonWord {
            word: "drawback".into(),
            meaning: "a disadvantage".into()
        })
    );
    let empty = validated(changed("word", json!({"word": "", "meaning": ""})));
    assert_eq!(empty.lessons[0].1.word, None);
    let half = validated(changed("word", json!({"word": "drawback", "meaning": ""})));
    assert_eq!(half.rejected, [4]);
}

#[test]
fn rule_cards_are_kept_only_for_used_missing_keys() {
    let result = validate_batch(
        &batch(vec![mistake()]),
        RawLessonBatch {
            lessons: vec![good_lesson(4)],
            rule_cards: vec![
                card("past_simple_vs_present_perfect"),
                card("past_simple_vs_present_perfect"),
                card("articles"),
                card("modal_verbs"),
                card("made_up"),
            ],
        },
    );
    let keys: Vec<_> = result.cards.iter().map(|card| card.rule_key).collect();
    assert_eq!(keys, [RuleKey::PastSimpleVsPresentPerfect]);
}

#[test]
fn a_bad_rule_card_is_skipped_without_costing_the_lesson() {
    let mut broken = card("past_simple_vs_present_perfect");
    broken["examples"] = json!(["only one"]);
    let result = validate_batch(
        &batch(vec![mistake()]),
        RawLessonBatch {
            lessons: vec![good_lesson(4)],
            rule_cards: vec![broken],
        },
    );
    assert_eq!(result.lessons.len(), 1);
    assert!(result.cards.is_empty());
}
