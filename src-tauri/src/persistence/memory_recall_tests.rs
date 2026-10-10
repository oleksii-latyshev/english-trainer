use super::*;
use crate::learning::{LearningItemType, LearningStatus, ReviewResponse};

fn path() -> std::path::PathBuf {
    static COUNTER: std::sync::atomic::AtomicUsize = std::sync::atomic::AtomicUsize::new(0);
    let id = COUNTER.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
    std::env::temp_dir().join(format!("memory-recall-{}-{id}.sqlite3", std::process::id()))
}

fn phrase(db: &mut SessionDatabase, target: &str, cue: &str) -> u64 {
    let card = db.save_phrase_card(target, cue, None, None).unwrap();
    db.connection
        .execute(
            "UPDATE phrase_cards SET next_review_at = 0 WHERE id = ?1",
            [card.id as i64],
        )
        .unwrap();
    card.id
}

fn insert_mistake(db: &mut SessionDatabase, original: &str, corrected: &str, due: i64) -> u64 {
    db.connection
        .execute(
            "INSERT INTO mistakes (normalized_key, category, original_example, corrected_example,
                explanation, times_seen, last_seen_at, next_review_at, status)
             VALUES (?1, 'grammar', ?2, ?3, 'test fixture', 2, 1, ?4, 'improving')",
            params![format!("fixture-{original}"), original, corrected, due],
        )
        .unwrap();
    db.connection.last_insert_rowid() as u64
}

#[test]
fn migrates_a_real_version_four_database_to_current_version() {
    let file = path();
    let connection = rusqlite::Connection::open(&file).unwrap();
    connection.execute_batch(
        "CREATE TABLE sessions (id INTEGER PRIMARY KEY AUTOINCREMENT, mode TEXT NOT NULL, scenario TEXT NOT NULL, started_at INTEGER NOT NULL, ended_at INTEGER, conversation_provider TEXT NOT NULL DEFAULT 'agy', opening_question TEXT NOT NULL);
         CREATE TABLE turns (id INTEGER PRIMARY KEY AUTOINCREMENT, session_id INTEGER NOT NULL REFERENCES sessions(id), sequence INTEGER NOT NULL, user_transcript TEXT NOT NULL, assistant_reply TEXT NOT NULL, assistant_question TEXT NOT NULL, created_at INTEGER NOT NULL);
         CREATE TABLE turn_feedback (session_id INTEGER NOT NULL, sequence INTEGER NOT NULL, feedback_json TEXT NOT NULL, PRIMARY KEY(session_id, sequence));
         CREATE TABLE attempt_comparisons (session_id INTEGER NOT NULL, sequence INTEGER NOT NULL, comparison_json TEXT NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY(session_id, sequence));
         CREATE TABLE mistakes (id INTEGER PRIMARY KEY AUTOINCREMENT, normalized_key TEXT NOT NULL UNIQUE, category TEXT NOT NULL, original_example TEXT NOT NULL, corrected_example TEXT NOT NULL, explanation TEXT NOT NULL, severity TEXT, confidence REAL, times_seen INTEGER NOT NULL DEFAULT 1, times_correct_afterwards INTEGER NOT NULL DEFAULT 0, last_seen_at INTEGER NOT NULL, last_reviewed_at INTEGER, next_review_at INTEGER NOT NULL, interval_days INTEGER NOT NULL DEFAULT 1, ease_factor REAL NOT NULL DEFAULT 2.5, status TEXT NOT NULL DEFAULT 'new');
         CREATE TABLE phrase_cards (id INTEGER PRIMARY KEY AUTOINCREMENT, phrase TEXT NOT NULL, normalized_phrase TEXT NOT NULL UNIQUE, meaning_or_note TEXT NOT NULL, session_id INTEGER, sequence INTEGER, created_at INTEGER NOT NULL, last_reviewed_at INTEGER, next_review_at INTEGER NOT NULL, interval_days INTEGER NOT NULL DEFAULT 1, ease_factor REAL NOT NULL DEFAULT 2.5, status TEXT NOT NULL DEFAULT 'learning');
         CREATE TABLE review_events (id INTEGER PRIMARY KEY AUTOINCREMENT, item_type TEXT NOT NULL, item_id INTEGER NOT NULL, response TEXT NOT NULL, created_at INTEGER NOT NULL, mistake_id INTEGER, phrase_id INTEGER);
         CREATE TABLE session_phrase_recalls (session_id INTEGER NOT NULL, phrase_id INTEGER NOT NULL, transcript TEXT NOT NULL, wording_observed INTEGER NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY(session_id, phrase_id));
         INSERT INTO phrase_cards (phrase, normalized_phrase, meaning_or_note, created_at, next_review_at) VALUES ('keep', 'keep', 'continue', 1, 0);
         PRAGMA user_version = 4;",
    )
    .unwrap();
    drop(connection);
    let db = SessionDatabase::open(&file).unwrap();
    let version: i64 = db
        .connection
        .pragma_query_value(None, "user_version", |row| row.get(0))
        .unwrap();
    assert_eq!(version, crate::persistence::SCHEMA_VERSION);
    let preserved: String = db
        .connection
        .query_row("SELECT phrase FROM phrase_cards", [], |row| row.get(0))
        .unwrap();
    assert_eq!(preserved, "keep");
    drop(db);
    let _ = std::fs::remove_file(file);
}

#[test]
fn snapshots_only_safe_due_items_in_deterministic_order_and_hides_targets() {
    let mut db = SessionDatabase::open_in_memory().unwrap();
    let unsafe_item = insert_mistake(&mut db, "the drawback was clear", "the drawback", 0);
    let first = insert_mistake(&mut db, "the minus was clear", "the main drawback", 0);
    let _later = phrase(&mut db, "turn out", "End up being");
    let _second = phrase(&mut db, "trade-off", "A compromise between choices");
    let overflow = phrase(&mut db, "come across", "Find or seem to be");
    let run = db.start_memory_review_run().unwrap().unwrap();
    assert_eq!(run.items.len(), 3);
    assert!(run.items.iter().all(|item| item.target.is_none()));
    assert_eq!(run.items[0].item_id, first);
    assert_eq!(run.items[0].cue, "the minus was clear");
    assert_eq!(run.items[1].cue, "End up being");
    assert_eq!(run.items[2].cue, "A compromise between choices");
    assert!(!run
        .items
        .iter()
        .any(|item| item.item_type == LearningItemType::Mistake && item.item_id == unsafe_item));
    assert!(!run
        .items
        .iter()
        .any(|item| item.item_type == LearningItemType::Phrase && item.item_id == overflow));
    assert_eq!(db.start_memory_review_run().unwrap().unwrap(), run);
}

#[test]
fn no_eligible_items_produces_no_empty_run() {
    let mut db = SessionDatabase::open_in_memory().unwrap();
    insert_mistake(&mut db, "the drawback was clear", "the drawback", 0);
    let empty_cue = phrase(&mut db, "figure out", "   ");
    let archived = phrase(&mut db, "carry on", "Continue despite difficulty");
    db.connection
        .execute(
            "UPDATE phrase_cards SET status='archived' WHERE id=?1",
            [archived as i64],
        )
        .unwrap();
    assert!(db.start_memory_review_run().unwrap().is_none());
    assert!(db.active_memory_review_run().unwrap().is_none());
    let status: String = db
        .connection
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
    let run = db.start_memory_review_run().unwrap().unwrap();
    let observed = db
        .record_memory_recall(
            run.run_id,
            LearningItemType::Phrase,
            matched,
            "The trade off matters.",
        )
        .unwrap();
    assert!(observed.wording_observed);
    assert_eq!(observed.saved_response, ReviewResponse::Remembered);
    assert_eq!(observed.status, LearningStatus::Learning);
    let missed_result = db
        .record_memory_recall(
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
        .connection
        .query_row(
            "SELECT times_correct_afterwards FROM mistakes LIMIT 1",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);
    assert_eq!(times_correct, 0);
    let events: i64 = db
        .connection
        .query_row("SELECT COUNT(*) FROM review_events", [], |row| row.get(0))
        .unwrap();
    assert_eq!(events, 2);
    let retry = db
        .record_memory_recall(
            run.run_id,
            LearningItemType::Phrase,
            matched,
            "different retry transcript",
        )
        .unwrap();
    assert_eq!(retry, observed);
    let events_after_retry: i64 = db
        .connection
        .query_row("SELECT COUNT(*) FROM review_events", [], |row| row.get(0))
        .unwrap();
    assert_eq!(events_after_retry, 2);
}

#[test]
fn a_cued_mistake_does_not_change_spontaneous_usage_count_or_promote_to_stable() {
    let mut db = SessionDatabase::open_in_memory().unwrap();
    let mistake = insert_mistake(&mut db, "the minus was visible", "the main drawback", 0);
    db.connection
        .execute(
            "UPDATE mistakes SET times_correct_afterwards = 3, status = 'improving' WHERE id = ?1",
            [mistake as i64],
        )
        .unwrap();
    let run = db.start_memory_review_run().unwrap().unwrap();
    let saved = db
        .record_memory_recall(
            run.run_id,
            LearningItemType::Mistake,
            mistake,
            "The main drawback was cost.",
        )
        .unwrap();
    assert!(saved.wording_observed);
    assert_eq!(saved.status, LearningStatus::Improving);
    let (times_correct, status): (i64, String) = db
        .connection
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
    let run = db.start_memory_review_run().unwrap().unwrap();
    let original_interval: i64 = db
        .connection
        .query_row(
            "SELECT interval_days FROM phrase_cards WHERE id = ?1",
            [id as i64],
            |row| row.get(0),
        )
        .unwrap();
    db.connection
        .execute_batch(
            "CREATE TRIGGER fail_memory_item_save BEFORE UPDATE ON memory_review_items
         BEGIN SELECT RAISE(ABORT, 'forced persistence failure'); END;",
        )
        .unwrap();
    assert!(db
        .record_memory_recall(run.run_id, LearningItemType::Phrase, id, "trade off")
        .is_err());
    let interval: i64 = db
        .connection
        .query_row(
            "SELECT interval_days FROM phrase_cards WHERE id = ?1",
            [id as i64],
            |row| row.get(0),
        )
        .unwrap();
    let events: i64 = db
        .connection
        .query_row("SELECT COUNT(*) FROM review_events", [], |row| row.get(0))
        .unwrap();
    let transcript: Option<String> = db
        .connection
        .query_row("SELECT transcript FROM memory_review_items", [], |row| {
            row.get(0)
        })
        .unwrap();
    assert_eq!(interval, original_interval);
    assert_eq!(events, 0);
    assert_eq!(transcript, None);
    db.connection
        .execute_batch("DROP TRIGGER fail_memory_item_save;")
        .unwrap();
    assert!(db
        .record_memory_recall(run.run_id, LearningItemType::Phrase, id, "trade off")
        .is_ok());
}

#[test]
fn rejects_out_of_order_wrong_and_stale_items_and_finishes_idempotently() {
    let mut db = SessionDatabase::open_in_memory().unwrap();
    let first = phrase(&mut db, "phrase one", "cue one");
    let second = phrase(&mut db, "phrase two", "cue two");
    let run = db.start_memory_review_run().unwrap().unwrap();
    assert!(db
        .record_memory_recall(run.run_id, LearningItemType::Phrase, second, "phrase two")
        .is_err());
    assert!(db
        .record_memory_recall(
            run.run_id + 100,
            LearningItemType::Phrase,
            first,
            "phrase one"
        )
        .is_err());
    assert!(db
        .record_memory_recall(run.run_id, LearningItemType::Phrase, first, "   ")
        .is_err());
    assert!(db
        .record_memory_recall(run.run_id, LearningItemType::Phrase, 0, "phrase one")
        .is_err());
    assert!(db
        .record_memory_recall(
            run.run_id,
            LearningItemType::Phrase,
            9_007_199_254_740_992,
            "phrase one"
        )
        .is_err());
    db.connection
        .execute(
            "UPDATE phrase_cards SET status='archived' WHERE id=?1",
            [first as i64],
        )
        .unwrap();
    assert!(db
        .record_memory_recall(run.run_id, LearningItemType::Phrase, first, "phrase one")
        .is_err());
    assert!(db.finish_memory_review_run(run.run_id).unwrap());
    assert!(db.finish_memory_review_run(run.run_id).unwrap());
    assert!(db.finish_memory_review_run(run.run_id + 100).is_err());
    assert!(db.active_memory_review_run().unwrap().is_none());
}

#[test]
fn item_that_is_no_longer_due_cannot_be_rescheduled_from_a_snapshot() {
    let mut db = SessionDatabase::open_in_memory().unwrap();
    let item = phrase(&mut db, "phrase one", "cue one");
    let run = db.start_memory_review_run().unwrap().unwrap();
    db.connection
        .execute(
            "UPDATE phrase_cards SET next_review_at = ?1 WHERE id = ?2",
            params![now_ms() + 86_400_000, item as i64],
        )
        .unwrap();
    assert!(db
        .record_memory_recall(run.run_id, LearningItemType::Phrase, item, "phrase one")
        .is_err());
    let events: i64 = db
        .connection
        .query_row("SELECT COUNT(*) FROM review_events", [], |row| row.get(0))
        .unwrap();
    assert_eq!(events, 0);
}

#[test]
fn deleted_or_changed_items_cannot_be_saved_against_a_snapshot() {
    let mut db = SessionDatabase::open_in_memory().unwrap();
    let deleted = phrase(&mut db, "phrase one", "cue one");
    let run = db.start_memory_review_run().unwrap().unwrap();
    db.connection
        .execute("DELETE FROM phrase_cards WHERE id=?1", [deleted as i64])
        .unwrap();
    assert!(db
        .record_memory_recall(run.run_id, LearningItemType::Phrase, deleted, "phrase one")
        .is_err());
    let events: i64 = db
        .connection
        .query_row("SELECT COUNT(*) FROM review_events", [], |row| row.get(0))
        .unwrap();
    assert_eq!(events, 0);

    let mut changed_db = SessionDatabase::open_in_memory().unwrap();
    let changed = phrase(&mut changed_db, "phrase two", "cue two");
    let changed_run = changed_db.start_memory_review_run().unwrap().unwrap();
    changed_db
        .connection
        .execute(
            "UPDATE phrase_cards SET phrase='new target' WHERE id=?1",
            [changed as i64],
        )
        .unwrap();
    assert!(changed_db
        .record_memory_recall(
            changed_run.run_id,
            LearningItemType::Phrase,
            changed,
            "phrase two"
        )
        .is_err());
    let changed_events: i64 = changed_db
        .connection
        .query_row("SELECT COUNT(*) FROM review_events", [], |row| row.get(0))
        .unwrap();
    assert_eq!(changed_events, 0);
}

#[test]
fn oversized_generated_run_id_rolls_back_and_does_not_leave_an_unfinishable_run() {
    let mut db = SessionDatabase::open_in_memory().unwrap();
    phrase(&mut db, "trade-off", "A compromise");
    db.connection
        .execute(
            "INSERT INTO sqlite_sequence (name, seq) VALUES ('memory_review_runs', 9007199254740991)",
            [],
        )
        .unwrap();
    assert!(db.start_memory_review_run().is_err());
    assert!(db.active_memory_review_run().unwrap().is_none());
    let count: i64 = db
        .connection
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
    let run = db.start_memory_review_run().unwrap().unwrap();
    db.record_memory_recall(run.run_id, LearningItemType::Phrase, first, "phrase one")
        .unwrap();
    drop(db);
    let mut reopened = SessionDatabase::open(&file).unwrap();
    let resumed = reopened.active_memory_review_run().unwrap().unwrap();
    assert_eq!(resumed.items[0].transcript.as_deref(), Some("phrase one"));
    assert_eq!(resumed.items[1].target, None);
    assert!(reopened.finish_memory_review_run(run.run_id).unwrap());
    assert!(reopened.active_memory_review_run().unwrap().is_none());
    let event_count: i64 = reopened
        .connection
        .query_row("SELECT COUNT(*) FROM review_events", [], |row| row.get(0))
        .unwrap();
    assert_eq!(event_count, 1);
    let pending_interval: i64 = reopened
        .connection
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
    let run = db.start_memory_review_run().unwrap().unwrap();
    assert!(run.items.iter().all(|item| !item.is_skipped));

    // Only the next unanswered item can be skipped, and skipping twice changes nothing.
    assert!(db
        .skip_memory_review_item(run.run_id, LearningItemType::Phrase, second)
        .is_err());
    db.skip_memory_review_item(run.run_id, LearningItemType::Phrase, first)
        .unwrap();
    db.skip_memory_review_item(run.run_id, LearningItemType::Phrase, first)
        .unwrap();

    let skipped = db.active_memory_review_run().unwrap().unwrap();
    assert!(skipped.items[0].is_skipped);
    assert_eq!(skipped.items[0].target, None);
    assert_eq!(skipped.items[0].saved_response, None);
    assert!(!skipped.items[1].is_skipped);
    // A skipped item is not scored later either.
    assert!(db
        .record_memory_recall(run.run_id, LearningItemType::Phrase, first, "phrase one")
        .is_err());
    db.record_memory_recall(run.run_id, LearningItemType::Phrase, second, "phrase two")
        .unwrap();

    let events: i64 = db
        .connection
        .query_row("SELECT COUNT(*) FROM review_events", [], |row| row.get(0))
        .unwrap();
    assert_eq!(events, 1);
    let (interval, next_review_at): (i64, i64) = db
        .connection
        .query_row(
            "SELECT interval_days, next_review_at FROM phrase_cards WHERE id = ?1",
            [first as i64],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .unwrap();
    assert_eq!((interval, next_review_at), (1, 0));

    let finished = db.active_memory_review_run().unwrap().unwrap();
    assert!(finished.items[0].is_skipped);
    assert!(finished.items[1].saved_response.is_some());
    assert!(db.finish_memory_review_run(run.run_id).unwrap());
    assert!(db
        .skip_memory_review_item(run.run_id, LearningItemType::Phrase, first)
        .is_err());
}

#[test]
fn a_skipped_item_survives_reopen_and_stays_due_for_the_next_review() {
    let file = path();
    let mut db = SessionDatabase::open(&file).unwrap();
    let first = phrase(&mut db, "phrase one", "cue one");
    let run = db.start_memory_review_run().unwrap().unwrap();
    db.skip_memory_review_item(run.run_id, LearningItemType::Phrase, first)
        .unwrap();
    drop(db);
    let mut reopened = SessionDatabase::open(&file).unwrap();
    let resumed = reopened.active_memory_review_run().unwrap().unwrap();
    assert!(resumed.items[0].is_skipped);
    assert!(reopened.finish_memory_review_run(run.run_id).unwrap());
    let next = reopened.start_memory_review_run().unwrap().unwrap();
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
