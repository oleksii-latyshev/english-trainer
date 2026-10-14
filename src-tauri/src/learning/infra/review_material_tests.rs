use super::{review_answers, review_material, review_runs};
use crate::learning::{LearningError, LearningItemType};
use crate::persistence::SessionDatabase;

fn finish(db: &mut SessionDatabase, run_id: u64) -> Result<bool, LearningError> {
    review_answers::finish_run(db.connection_mut(), run_id).map(|()| true)
}

fn due_phrases(db: &mut SessionDatabase) {
    for index in 0..8 {
        db.save_phrase_card(
            &format!("phrase {index}"),
            &format!("Situation {index}"),
            None,
            None,
        )
        .unwrap();
    }
    db.connection()
        .execute("UPDATE phrase_cards SET next_review_at = 0", [])
        .unwrap();
}

#[test]
fn normal_review_has_six_items_and_warmup_has_three_phrases_without_replacing_an_active_run() {
    let mut db = SessionDatabase::open_in_memory().unwrap();
    due_phrases(&mut db);
    db.seed_recurring_mistake("I work in there", "I work there", 2, 20)
        .unwrap();
    let normal = review_runs::start_run(db.connection_mut(), false)
        .unwrap()
        .unwrap();
    assert_eq!(normal.items.len(), 6);
    assert_eq!(normal.items[0].item_type, LearningItemType::Mistake);
    assert_eq!(
        review_runs::start_run(db.connection_mut(), true)
            .unwrap()
            .unwrap(),
        normal
    );
    finish(&mut db, normal.run_id).unwrap();
    let warmup = review_runs::start_run(db.connection_mut(), true)
        .unwrap()
        .unwrap();
    assert_eq!(warmup.items.len(), 3);
    assert!(warmup
        .items
        .iter()
        .all(|item| item.item_type == LearningItemType::Phrase));
    assert_eq!(
        review_runs::start_run(db.connection_mut(), false)
            .unwrap()
            .unwrap(),
        warmup
    );
    assert!(warmup.items.iter().all(|item| item.target.is_none()));
}

#[test]
fn revealing_requires_the_current_unanswered_item_and_failed_writes_expose_nothing() {
    let mut db = SessionDatabase::open_in_memory().unwrap();
    due_phrases(&mut db);
    let run = review_runs::start_run(db.connection_mut(), true)
        .unwrap()
        .unwrap();
    assert!(review_material::reveal_phrase(db.connection(), run.run_id, 2).is_err());
    db.connection().execute_batch("CREATE TRIGGER fail_hint BEFORE UPDATE OF is_cued ON memory_review_items BEGIN SELECT RAISE(ABORT, 'test cue failure'); END;").unwrap();
    assert!(review_material::reveal_phrase(db.connection(), run.run_id, 1).is_err());
    assert!(!review_material::material_rows(db.connection(), run.run_id).unwrap()[0].is_cued);
    db.connection()
        .execute_batch("DROP TRIGGER fail_hint")
        .unwrap();
    review_material::reveal_phrase(db.connection(), run.run_id, 1).unwrap();
    review_material::reveal_phrase(db.connection(), run.run_id, 1).unwrap();
    assert!(review_material::material_rows(db.connection(), run.run_id).unwrap()[0].is_cued);
    let count: i64 = db
        .connection()
        .query_row("SELECT COUNT(*) FROM review_events", [], |row| row.get(0))
        .unwrap();
    assert_eq!(count, 0);
    review_answers::skip_item(
        db.connection_mut(),
        run.run_id,
        LearningItemType::Phrase,
        run.items[0].item_id,
    )
    .unwrap();
    assert!(review_material::reveal_phrase(db.connection(), run.run_id, 1).is_err());
    review_material::reveal_phrase(db.connection(), run.run_id, 2).unwrap();
    finish(&mut db, run.run_id).unwrap();
    assert!(review_material::reveal_phrase(db.connection(), run.run_id, 3).is_err());
}

#[test]
fn migration_from_nineteen_preserves_unanswered_review_without_revealing_targets() {
    let path = std::env::temp_dir().join(format!(
        "review-material-migration-{}.sqlite3",
        std::process::id()
    ));
    let _ = std::fs::remove_file(&path);
    let mut db = SessionDatabase::open(&path).unwrap();
    due_phrases(&mut db);
    let run = review_runs::start_run(db.connection_mut(), false)
        .unwrap()
        .unwrap();
    db.connection().execute_batch("DROP TABLE review_material_preparations; ALTER TABLE memory_review_items DROP COLUMN is_cued; PRAGMA user_version = 19;").unwrap();
    drop(db);
    let reopened = SessionDatabase::open(&path).unwrap();
    assert_eq!(
        review_runs::active_run(reopened.connection())
            .unwrap()
            .unwrap(),
        run
    );
    assert!(
        review_material::stored_material(reopened.connection(), run.run_id)
            .unwrap()
            .is_none()
    );
    assert!(
        review_material::material_rows(reopened.connection(), run.run_id)
            .unwrap()
            .iter()
            .all(|row| !row.is_cued)
    );
    drop(reopened);
    std::fs::remove_file(path).unwrap();
}
