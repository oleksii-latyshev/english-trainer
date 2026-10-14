use super::ids::now_ms;
use super::{review_answers, review_runs};
use crate::learning::{LearningError, LearningItemType, LearningStatus, ReviewResponse};
use crate::persistence::SessionDatabase;
use rusqlite::params;

fn finish(db: &mut SessionDatabase, run_id: u64) -> Result<bool, LearningError> {
    review_answers::finish_run(db.connection_mut(), run_id).map(|()| true)
}

fn path() -> std::path::PathBuf {
    static COUNTER: std::sync::atomic::AtomicUsize = std::sync::atomic::AtomicUsize::new(0);
    let id = COUNTER.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
    std::env::temp_dir().join(format!("memory-recall-{}-{id}.sqlite3", std::process::id()))
}

fn phrase(db: &mut SessionDatabase, target: &str, cue: &str) -> u64 {
    let card = db.save_phrase_card(target, cue, None, None).unwrap();
    db.connection()
        .execute(
            "UPDATE phrase_cards SET next_review_at = 0 WHERE id = ?1",
            [card.id as i64],
        )
        .unwrap();
    card.id
}

fn insert_mistake(db: &mut SessionDatabase, original: &str, corrected: &str, due: i64) -> u64 {
    db.connection()
        .execute(
            "INSERT INTO mistakes (normalized_key, category, original_example, corrected_example,
                explanation, times_seen, last_seen_at, next_review_at, status)
             VALUES (?1, 'grammar', ?2, ?3, 'test fixture', 2, 1, ?4, 'improving')",
            params![format!("fixture-{original}"), original, corrected, due],
        )
        .unwrap();
    db.connection().last_insert_rowid() as u64
}

#[test]
fn snapshots_only_safe_due_items_in_deterministic_order_and_hides_targets() {
    let mut db = SessionDatabase::open_in_memory().unwrap();
    let unsafe_item = insert_mistake(&mut db, "the drawback was clear", "the drawback", 0);
    let first = insert_mistake(&mut db, "the minus was clear", "the main drawback", 0);
    let _later = phrase(&mut db, "turn out", "End up being");
    let _second = phrase(&mut db, "trade-off", "A compromise between choices");
    let overflow = phrase(&mut db, "come across", "Find or seem to be");
    let run = review_runs::start_run(db.connection_mut(), false)
        .unwrap()
        .unwrap();
    assert_eq!(run.items.len(), 4);
    assert!(run.items.iter().all(|item| item.target.is_none()));
    assert_eq!(run.items[0].item_id, first);
    assert_eq!(run.items[0].cue, "the minus was clear");
    assert_eq!(run.items[1].cue, "End up being");
    assert_eq!(run.items[2].cue, "A compromise between choices");
    assert!(!run
        .items
        .iter()
        .any(|item| item.item_type == LearningItemType::Mistake && item.item_id == unsafe_item));
    assert_eq!(run.items[3].item_id, overflow);
    assert_eq!(
        review_runs::start_run(db.connection_mut(), false)
            .unwrap()
            .unwrap(),
        run
    );
}

#[test]
fn no_eligible_items_produces_no_empty_run() {
    let mut db = SessionDatabase::open_in_memory().unwrap();
    insert_mistake(&mut db, "the drawback was clear", "the drawback", 0);
    let empty_cue = phrase(&mut db, "figure out", "   ");
    let archived = phrase(&mut db, "carry on", "Continue despite difficulty");
    db.connection()
        .execute(
            "UPDATE phrase_cards SET status='archived' WHERE id=?1",
            [archived as i64],
        )
        .unwrap();
    assert!(review_runs::start_run(db.connection_mut(), false)
        .unwrap()
        .is_none());
    assert!(review_runs::active_run(db.connection()).unwrap().is_none());
    let status: String = db
        .connection()
        .query_row(
            "SELECT status FROM phrase_cards WHERE id=?1",
            [empty_cue as i64],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(status, "learning");
}

#[test]
fn match_and_miss_commit_once_and_never_grant_spontaneous_mastery() {
    let mut db = SessionDatabase::open_in_memory().unwrap();
    let matched = phrase(&mut db, "trade-off", "A compromise between choices");
    let missed = phrase(&mut db, "carry on", "Continue despite difficulty");
    let run = review_runs::start_run(db.connection_mut(), false)
        .unwrap()
        .unwrap();
    let observed = review_answers::record_recall(
        db.connection_mut(),
        run.run_id,
        LearningItemType::Phrase,
        matched,
        "The trade off matters.",
    )
    .unwrap();
    assert!(observed.wording_observed);
    assert_eq!(observed.saved_response, ReviewResponse::Remembered);
    assert_eq!(observed.status, LearningStatus::Learning);
    let missed_result = review_answers::record_recall(
        db.connection_mut(),
        run.run_id,
        LearningItemType::Phrase,
        missed,
        "I do not know it.",
    )
    .unwrap();
    assert!(!missed_result.wording_observed);
    assert_eq!(missed_result.saved_response, ReviewResponse::NeedPractice);
    assert_eq!(missed_result.interval_days, 1);
    let times_correct: i64 = db
        .connection()
        .query_row(
            "SELECT times_correct_afterwards FROM mistakes LIMIT 1",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);
    assert_eq!(times_correct, 0);
    let events: i64 = db
        .connection()
        .query_row("SELECT COUNT(*) FROM review_events", [], |row| row.get(0))
        .unwrap();
    assert_eq!(events, 2);
    let retry = review_answers::record_recall(
        db.connection_mut(),
        run.run_id,
        LearningItemType::Phrase,
        matched,
        "different retry transcript",
    )
    .unwrap();
    assert_eq!(retry, observed);
    let events_after_retry: i64 = db
        .connection()
        .query_row("SELECT COUNT(*) FROM review_events", [], |row| row.get(0))
        .unwrap();
    assert_eq!(events_after_retry, 2);
}

#[test]
fn a_cued_mistake_does_not_change_spontaneous_usage_count_or_promote_to_stable() {
    let mut db = SessionDatabase::open_in_memory().unwrap();
    let mistake = insert_mistake(&mut db, "the minus was visible", "the main drawback", 0);
    db.connection()
        .execute(
            "UPDATE mistakes SET times_correct_afterwards = 3, status = 'improving' WHERE id = ?1",
            [mistake as i64],
        )
        .unwrap();
    let run = review_runs::start_run(db.connection_mut(), false)
        .unwrap()
        .unwrap();
    let saved = review_answers::record_recall(
        db.connection_mut(),
        run.run_id,
        LearningItemType::Mistake,
        mistake,
        "The main drawback was cost.",
    )
    .unwrap();
    assert!(saved.wording_observed);
    assert_eq!(saved.status, LearningStatus::Improving);
    let (times_correct, status): (i64, String) = db
        .connection()
        .query_row(
            "SELECT times_correct_afterwards, status FROM mistakes WHERE id = ?1",
            [mistake as i64],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .unwrap();
    assert_eq!(times_correct, 3);
    assert_eq!(status, "improving");
}

#[test]
fn rollback_keeps_schedule_and_transcript_retryable_after_database_failure() {
    let mut db = SessionDatabase::open_in_memory().unwrap();
    let id = phrase(&mut db, "trade-off", "A compromise");
    let run = review_runs::start_run(db.connection_mut(), false)
        .unwrap()
        .unwrap();
    let original_interval: i64 = db
        .connection()
        .query_row(
            "SELECT interval_days FROM phrase_cards WHERE id = ?1",
            [id as i64],
            |row| row.get(0),
        )
        .unwrap();
    db.connection()
        .execute_batch(
            "CREATE TRIGGER fail_memory_item_save BEFORE UPDATE ON memory_review_items
         BEGIN SELECT RAISE(ABORT, 'forced persistence failure'); END;",
        )
        .unwrap();
    assert!(review_answers::record_recall(
        db.connection_mut(),
        run.run_id,
        LearningItemType::Phrase,
        id,
        "trade off"
    )
    .is_err());
    let interval: i64 = db
        .connection()
        .query_row(
            "SELECT interval_days FROM phrase_cards WHERE id = ?1",
            [id as i64],
            |row| row.get(0),
        )
        .unwrap();
    let events: i64 = db
        .connection()
        .query_row("SELECT COUNT(*) FROM review_events", [], |row| row.get(0))
        .unwrap();
    let transcript: Option<String> = db
        .connection()
        .query_row("SELECT transcript FROM memory_review_items", [], |row| {
            row.get(0)
        })
        .unwrap();
    assert_eq!(interval, original_interval);
    assert_eq!(events, 0);
    assert_eq!(transcript, None);
    db.connection()
        .execute_batch("DROP TRIGGER fail_memory_item_save;")
        .unwrap();
    assert!(review_answers::record_recall(
        db.connection_mut(),
        run.run_id,
        LearningItemType::Phrase,
        id,
        "trade off"
    )
    .is_ok());
}

#[test]
fn rejects_out_of_order_wrong_and_stale_items_and_finishes_idempotently() {
    let mut db = SessionDatabase::open_in_memory().unwrap();
    let first = phrase(&mut db, "phrase one", "cue one");
    let second = phrase(&mut db, "phrase two", "cue two");
    let run = review_runs::start_run(db.connection_mut(), false)
        .unwrap()
        .unwrap();
    assert!(review_answers::record_recall(
        db.connection_mut(),
        run.run_id,
        LearningItemType::Phrase,
        second,
        "phrase two"
    )
    .is_err());
    assert!(review_answers::record_recall(
        db.connection_mut(),
        run.run_id + 100,
        LearningItemType::Phrase,
        first,
        "phrase one"
    )
    .is_err());
    db.connection()
        .execute(
            "UPDATE phrase_cards SET status='archived' WHERE id=?1",
            [first as i64],
        )
        .unwrap();
    assert!(review_answers::record_recall(
        db.connection_mut(),
        run.run_id,
        LearningItemType::Phrase,
        first,
        "phrase one"
    )
    .is_err());
    assert!(finish(&mut db, run.run_id).unwrap());
    assert!(finish(&mut db, run.run_id).unwrap());
    assert!(finish(&mut db, run.run_id + 100).is_err());
    assert!(review_runs::active_run(db.connection()).unwrap().is_none());
}

#[test]
fn item_that_is_no_longer_due_cannot_be_rescheduled_from_a_snapshot() {
    let mut db = SessionDatabase::open_in_memory().unwrap();
    let item = phrase(&mut db, "phrase one", "cue one");
    let run = review_runs::start_run(db.connection_mut(), false)
        .unwrap()
        .unwrap();
    db.connection()
        .execute(
            "UPDATE phrase_cards SET next_review_at = ?1 WHERE id = ?2",
            params![now_ms() + 86_400_000, item as i64],
        )
        .unwrap();
    assert!(review_answers::record_recall(
        db.connection_mut(),
        run.run_id,
        LearningItemType::Phrase,
        item,
        "phrase one"
    )
    .is_err());
    let events: i64 = db
        .connection()
        .query_row("SELECT COUNT(*) FROM review_events", [], |row| row.get(0))
        .unwrap();
    assert_eq!(events, 0);
}

#[test]
fn deleted_or_changed_items_cannot_be_saved_against_a_snapshot() {
    let mut db = SessionDatabase::open_in_memory().unwrap();
    let deleted = phrase(&mut db, "phrase one", "cue one");
    let run = review_runs::start_run(db.connection_mut(), false)
        .unwrap()
        .unwrap();
    db.connection()
        .execute("DELETE FROM phrase_cards WHERE id=?1", [deleted as i64])
        .unwrap();
    assert!(review_answers::record_recall(
        db.connection_mut(),
        run.run_id,
        LearningItemType::Phrase,
        deleted,
        "phrase one"
    )
    .is_err());
    let events: i64 = db
        .connection()
        .query_row("SELECT COUNT(*) FROM review_events", [], |row| row.get(0))
        .unwrap();
    assert_eq!(events, 0);

    let mut changed_db = SessionDatabase::open_in_memory().unwrap();
    let changed = phrase(&mut changed_db, "phrase two", "cue two");
    let changed_run = review_runs::start_run(changed_db.connection_mut(), false)
        .unwrap()
        .unwrap();
    changed_db
        .connection()
        .execute(
            "UPDATE phrase_cards SET phrase='new target' WHERE id=?1",
            [changed as i64],
        )
        .unwrap();
    assert!(review_answers::record_recall(
        changed_db.connection_mut(),
        changed_run.run_id,
        LearningItemType::Phrase,
        changed,
        "phrase two"
    )
    .is_err());
    let changed_events: i64 = changed_db
        .connection()
        .query_row("SELECT COUNT(*) FROM review_events", [], |row| row.get(0))
        .unwrap();
    assert_eq!(changed_events, 0);
}

#[test]
fn oversized_generated_run_id_rolls_back_and_does_not_leave_an_unfinishable_run() {
    let mut db = SessionDatabase::open_in_memory().unwrap();
    phrase(&mut db, "trade-off", "A compromise");
    db.connection()
        .execute(
            "INSERT INTO sqlite_sequence (name, seq) VALUES ('memory_review_runs', 9007199254740991)",
            [],
        )
        .unwrap();
    assert!(review_runs::start_run(db.connection_mut(), false).is_err());
    assert!(review_runs::active_run(db.connection()).unwrap().is_none());
    let count: i64 = db
        .connection()
        .query_row("SELECT COUNT(*) FROM memory_review_runs", [], |row| {
            row.get(0)
        })
        .unwrap();
    assert_eq!(count, 0);
}

#[test]
fn saved_progress_and_pending_queue_survive_database_reopen_and_early_finish() {
    let file = path();
    let mut db = SessionDatabase::open(&file).unwrap();
    let first = phrase(&mut db, "phrase one", "cue one");
    let _second = phrase(&mut db, "phrase two", "cue two");
    let run = review_runs::start_run(db.connection_mut(), false)
        .unwrap()
        .unwrap();
    review_answers::record_recall(
        db.connection_mut(),
        run.run_id,
        LearningItemType::Phrase,
        first,
        "phrase one",
    )
    .unwrap();
    drop(db);
    let mut reopened = SessionDatabase::open(&file).unwrap();
    let resumed = review_runs::active_run(reopened.connection())
        .unwrap()
        .unwrap();
    assert_eq!(resumed.items[0].transcript.as_deref(), Some("phrase one"));
    assert_eq!(resumed.items[1].target, None);
    assert!(finish(&mut reopened, run.run_id).unwrap());
    assert!(review_runs::active_run(reopened.connection())
        .unwrap()
        .is_none());
    let event_count: i64 = reopened
        .connection()
        .query_row("SELECT COUNT(*) FROM review_events", [], |row| row.get(0))
        .unwrap();
    assert_eq!(event_count, 1);
    let pending_interval: i64 = reopened
        .connection()
        .query_row(
            "SELECT interval_days FROM phrase_cards WHERE phrase='phrase two'",
            [],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(pending_interval, 1);
    drop(reopened);
    let _ = std::fs::remove_file(file);
}

#[test]
fn skipping_closes_an_item_without_scoring_it_and_lets_the_next_one_be_answered() {
    let mut db = SessionDatabase::open_in_memory().unwrap();
    let first = phrase(&mut db, "phrase one", "cue one");
    let second = phrase(&mut db, "phrase two", "cue two");
    let run = review_runs::start_run(db.connection_mut(), false)
        .unwrap()
        .unwrap();
    assert!(run.items.iter().all(|item| !item.is_skipped));

    assert!(review_answers::skip_item(
        db.connection_mut(),
        run.run_id,
        LearningItemType::Phrase,
        second
    )
    .is_err());
    review_answers::skip_item(
        db.connection_mut(),
        run.run_id,
        LearningItemType::Phrase,
        first,
    )
    .unwrap();
    review_answers::skip_item(
        db.connection_mut(),
        run.run_id,
        LearningItemType::Phrase,
        first,
    )
    .unwrap();

    let skipped = review_runs::active_run(db.connection()).unwrap().unwrap();
    assert!(skipped.items[0].is_skipped);
    assert_eq!(skipped.items[0].target, None);
    assert_eq!(skipped.items[0].saved_response, None);
    assert!(!skipped.items[1].is_skipped);
    assert!(review_answers::record_recall(
        db.connection_mut(),
        run.run_id,
        LearningItemType::Phrase,
        first,
        "phrase one"
    )
    .is_err());
    review_answers::record_recall(
        db.connection_mut(),
        run.run_id,
        LearningItemType::Phrase,
        second,
        "phrase two",
    )
    .unwrap();

    let events: i64 = db
        .connection()
        .query_row("SELECT COUNT(*) FROM review_events", [], |row| row.get(0))
        .unwrap();
    assert_eq!(events, 1);
    let (interval, next_review_at): (i64, i64) = db
        .connection()
        .query_row(
            "SELECT interval_days, next_review_at FROM phrase_cards WHERE id = ?1",
            [first as i64],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .unwrap();
    assert_eq!((interval, next_review_at), (1, 0));

    let finished = review_runs::active_run(db.connection()).unwrap().unwrap();
    assert!(finished.items[0].is_skipped);
    assert!(finished.items[1].saved_response.is_some());
    assert!(finish(&mut db, run.run_id).unwrap());
    assert!(review_answers::skip_item(
        db.connection_mut(),
        run.run_id,
        LearningItemType::Phrase,
        first
    )
    .is_err());
}

#[test]
fn a_skipped_item_survives_reopen_and_stays_due_for_the_next_review() {
    let file = path();
    let mut db = SessionDatabase::open(&file).unwrap();
    let first = phrase(&mut db, "phrase one", "cue one");
    let run = review_runs::start_run(db.connection_mut(), false)
        .unwrap()
        .unwrap();
    review_answers::skip_item(
        db.connection_mut(),
        run.run_id,
        LearningItemType::Phrase,
        first,
    )
    .unwrap();
    drop(db);
    let mut reopened = SessionDatabase::open(&file).unwrap();
    let resumed = review_runs::active_run(reopened.connection())
        .unwrap()
        .unwrap();
    assert!(resumed.items[0].is_skipped);
    assert!(finish(&mut reopened, run.run_id).unwrap());
    let next = review_runs::start_run(reopened.connection_mut(), false)
        .unwrap()
        .unwrap();
    assert_ne!(next.run_id, run.run_id);
    assert_eq!(next.items[0].item_id, first);
    assert!(!next.items[0].is_skipped);
    drop(reopened);
    let _ = std::fs::remove_file(file);
}

#[test]
fn saving_an_archived_phrase_again_brings_it_back_for_tomorrow() {
    let mut db = SessionDatabase::open_in_memory().unwrap();
    let card = db
        .save_phrase_card("for two weeks", "note", None, None)
        .unwrap();
    assert!(db
        .archive_learning_item(LearningItemType::Phrase, card.id)
        .unwrap());

    let again = db
        .save_phrase_card("For two weeks", "", None, None)
        .unwrap();
    assert_eq!(again.id, card.id);
    assert_eq!(again.status, LearningStatus::Learning);
    assert_eq!(again.created_at, card.created_at);
    let stored = db.get_learning_memory().unwrap().phrase_cards;
    assert_eq!(stored.len(), 1);
    assert_eq!(stored[0].status, LearningStatus::Learning);
    assert!(!stored[0].is_due);
}
