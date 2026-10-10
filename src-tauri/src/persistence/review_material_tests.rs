use super::*;
use crate::learning::LearningItemType;

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
    db.connection
        .execute("UPDATE phrase_cards SET next_review_at = 0", [])
        .unwrap();
}

#[test]
fn normal_review_has_six_items_and_warmup_has_three_phrases_without_replacing_an_active_run() {
    let mut db = SessionDatabase::open_in_memory().unwrap();
    due_phrases(&mut db);
    db.seed_recurring_mistake("I work in there", "I work there", 2, 20)
        .unwrap();
    let normal = db.start_memory_review_run().unwrap().unwrap();
    assert_eq!(normal.items.len(), 6);
    assert_eq!(normal.items[0].item_type, LearningItemType::Mistake);
    assert_eq!(db.start_memory_warmup().unwrap().unwrap(), normal);
    db.finish_memory_review_run(normal.run_id).unwrap();
    let warmup = db.start_memory_warmup().unwrap().unwrap();
    assert_eq!(warmup.items.len(), 3);
    assert!(warmup
        .items
        .iter()
        .all(|item| item.item_type == LearningItemType::Phrase));
    assert_eq!(db.start_memory_review_run().unwrap().unwrap(), warmup);
    assert!(warmup.items.iter().all(|item| item.target.is_none()));
}

#[test]
fn revealing_requires_the_current_unanswered_item_and_failed_writes_expose_nothing() {
    let mut db = SessionDatabase::open_in_memory().unwrap();
    due_phrases(&mut db);
    let run = db.start_memory_warmup().unwrap().unwrap();
    assert!(db.reveal_review_phrase(run.run_id, 2).is_err());
    db.connection.execute_batch("CREATE TRIGGER fail_hint BEFORE UPDATE OF is_cued ON memory_review_items BEGIN SELECT RAISE(ABORT, 'test cue failure'); END;").unwrap();
    assert!(db.reveal_review_phrase(run.run_id, 1).is_err());
    assert!(!db.review_material_rows(run.run_id).unwrap()[0].is_cued);
    db.connection
        .execute_batch("DROP TRIGGER fail_hint")
        .unwrap();
    db.reveal_review_phrase(run.run_id, 1).unwrap();
    db.reveal_review_phrase(run.run_id, 1).unwrap();
    assert!(db.review_material_rows(run.run_id).unwrap()[0].is_cued);
    let count: i64 = db
        .connection
        .query_row("SELECT COUNT(*) FROM review_events", [], |row| row.get(0))
        .unwrap();
    assert_eq!(count, 0);
    db.skip_memory_review_item(run.run_id, LearningItemType::Phrase, run.items[0].item_id)
        .unwrap();
    assert!(db.reveal_review_phrase(run.run_id, 1).is_err());
    db.reveal_review_phrase(run.run_id, 2).unwrap();
    db.finish_memory_review_run(run.run_id).unwrap();
    assert!(db.reveal_review_phrase(run.run_id, 3).is_err());
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
    let run = db.start_memory_review_run().unwrap().unwrap();
    db.connection.execute_batch("DROP TABLE review_material_preparations; ALTER TABLE memory_review_items DROP COLUMN is_cued; PRAGMA user_version = 19;").unwrap();
    drop(db);
    let reopened = SessionDatabase::open(&path).unwrap();
    assert_eq!(reopened.active_memory_review_run().unwrap().unwrap(), run);
    assert!(reopened.review_material(run.run_id).unwrap().is_none());
    assert!(reopened
        .review_material_rows(run.run_id)
        .unwrap()
        .iter()
        .all(|row| !row.is_cued));
    drop(reopened);
    std::fs::remove_file(path).unwrap();
}
