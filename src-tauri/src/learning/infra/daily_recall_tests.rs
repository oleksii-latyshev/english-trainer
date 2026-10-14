use super::{daily_plan, record_daily_recall};
use crate::conversation::StoredTurn;
use crate::learning::LearningStatus;
use crate::persistence::SessionDatabase;
use std::sync::atomic::{AtomicUsize, Ordering};

static NEXT_PATH: AtomicUsize = AtomicUsize::new(0);

fn test_database_path() -> std::path::PathBuf {
    let index = NEXT_PATH.fetch_add(1, Ordering::Relaxed);
    std::env::temp_dir().join(format!(
        "english-trainer-recall-{}-{index}.sqlite3",
        std::process::id()
    ))
}

#[test]
fn spoken_recall_queue_and_evidence_survive_without_changing_mastery() {
    let path = test_database_path();
    let mut db = SessionDatabase::open(&path).unwrap();
    let first = db.create_session("Earlier question?").unwrap();
    db.save_turn(
        first,
        1,
        &StoredTurn {
            learner: "A trade-off matters.".into(),
            assistant_reply: "Yes.".into(),
            assistant_question: "Why?".into(),
            answered_by: None,
        },
    )
    .unwrap();
    let card = db
        .save_phrase_card(
            "trade-off",
            "A compromise between two benefits",
            Some(first),
            Some(1),
        )
        .unwrap();
    db.connection()
        .execute(
            "UPDATE phrase_cards SET next_review_at = 0 WHERE id = ?1",
            [card.id as i64],
        )
        .unwrap();
    assert!(db.finish_session(first).unwrap());
    let second = db.create_session("New question?").unwrap();
    let plan = daily_plan(db.connection(), second).unwrap();
    assert_eq!(plan.completed_count, 0);
    assert_eq!(plan.items.len(), 1);
    assert_eq!(plan.items[0].phrase_id, card.id);
    assert_eq!(plan.items[0].cue, "A compromise between two benefits");

    let saved = record_daily_recall(
        db.connection(),
        second,
        card.id,
        "The trade off was worth it.",
    )
    .unwrap()
    .unwrap();
    assert!(saved.wording_observed);
    let duplicate = record_daily_recall(db.connection(), second, card.id, "I changed my answer")
        .unwrap()
        .unwrap();
    assert_eq!(duplicate, saved);
    assert_eq!(
        daily_plan(db.connection(), second).unwrap().completed_count,
        1
    );
    assert!(daily_plan(db.connection(), second)
        .unwrap()
        .items
        .is_empty());
    let memory = db.get_learning_memory().unwrap();
    assert_eq!(memory.phrase_cards[0].status, LearningStatus::Learning);
    assert!(memory.phrase_cards[0].is_due);
    drop(db);

    let db = SessionDatabase::open(&path).unwrap();
    assert_eq!(
        daily_plan(db.connection(), second).unwrap().completed_count,
        1
    );
    drop(db);
    std::fs::remove_file(path).unwrap();
}

#[test]
fn spoken_recall_excludes_cues_that_reveal_the_phrase() {
    let mut db = SessionDatabase::open_in_memory().unwrap();
    let first = db.create_session("Earlier?").unwrap();
    db.save_turn(
        first,
        1,
        &StoredTurn {
            learner: "Answer".into(),
            assistant_reply: "Reply".into(),
            assistant_question: "Next?".into(),
            answered_by: None,
        },
    )
    .unwrap();
    let leaked = db
        .save_phrase_card("bottleneck", "A bottleneck slowed us", Some(first), Some(1))
        .unwrap();
    db.connection()
        .execute(
            "UPDATE phrase_cards SET next_review_at = 0 WHERE id = ?1",
            [leaked.id as i64],
        )
        .unwrap();
    db.finish_session(first).unwrap();
    let second = db.create_session("Now?").unwrap();
    assert!(daily_plan(db.connection(), second)
        .unwrap()
        .items
        .is_empty());
    assert!(
        record_daily_recall(db.connection(), second, leaked.id, "bottleneck")
            .unwrap()
            .is_none()
    );
}
