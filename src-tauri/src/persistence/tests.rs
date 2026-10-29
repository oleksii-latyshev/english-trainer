use super::*;
use crate::providers::{FocusCategory, FocusFeedback};
use std::sync::atomic::{AtomicUsize, Ordering};

static NEXT_PATH: AtomicUsize = AtomicUsize::new(0);

fn test_database_path() -> std::path::PathBuf {
    let index = NEXT_PATH.fetch_add(1, Ordering::Relaxed);
    std::env::temp_dir().join(format!(
        "english-trainer-db-{}-{index}.sqlite3",
        std::process::id()
    ))
}

fn sample_turn_feedback(category: FocusCategory, improved: &str) -> TurnFeedback {
    TurnFeedback {
        focus_feedback: vec![FocusFeedback {
            category,
            original: "Original text".into(),
            improved: improved.into(),
            explanation: "Explanation note".into(),
        }],
        b2_rewrite: "Stronger rewrite.".into(),
    }
}

#[test]
fn creates_versioned_schema_and_enforces_one_active_session() {
    let path = test_database_path();
    let db = SessionDatabase::open(&path).unwrap();
    let version: i64 = db
        .connection
        .pragma_query_value(None, "user_version", |row| row.get(0))
        .unwrap();
    assert_eq!(version, SCHEMA_VERSION);
    drop(db);

    let mut db = SessionDatabase::open(&path).unwrap();
    let first = db.create_session("Opening?").unwrap();
    assert!(db.create_session("Second?").is_err());
    assert!(db.finish_session(first).unwrap());
    assert!(db.create_session("Next?").is_ok());
    drop(db);
    let _ = std::fs::remove_file(path);
}

#[test]
fn migrates_existing_version_two_database_to_current_version() {
    let path = test_database_path();
    let connection = rusqlite::Connection::open(&path).unwrap();
    connection
        .execute_batch(
            "CREATE TABLE sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT, mode TEXT NOT NULL, scenario TEXT NOT NULL,
            started_at INTEGER NOT NULL, ended_at INTEGER, conversation_provider TEXT NOT NULL DEFAULT 'agy',
            opening_question TEXT NOT NULL
        );
        CREATE UNIQUE INDEX one_active_session ON sessions ((1)) WHERE ended_at IS NULL;
        CREATE TABLE turns (
            id INTEGER PRIMARY KEY AUTOINCREMENT, session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
            sequence INTEGER NOT NULL, user_transcript TEXT NOT NULL, assistant_reply TEXT NOT NULL,
            assistant_question TEXT NOT NULL, created_at INTEGER NOT NULL, UNIQUE(session_id, sequence)
        );
        CREATE TABLE turn_feedback (
            session_id INTEGER NOT NULL, sequence INTEGER NOT NULL, feedback_json TEXT NOT NULL,
            PRIMARY KEY(session_id, sequence),
            FOREIGN KEY(session_id, sequence) REFERENCES turns(session_id, sequence) ON DELETE CASCADE
        );
        CREATE TABLE attempt_comparisons (
            session_id INTEGER NOT NULL, sequence INTEGER NOT NULL, comparison_json TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            PRIMARY KEY(session_id, sequence),
            FOREIGN KEY(session_id, sequence) REFERENCES turns(session_id, sequence) ON DELETE CASCADE
        );
        INSERT INTO sessions (mode, scenario, started_at, opening_question) VALUES ('conversation', 'free', 1, 'Question?');
        INSERT INTO turns (session_id, sequence, user_transcript, assistant_reply, assistant_question, created_at)
        VALUES (1, 1, 'Original', 'Reply', 'Next?', 1);
        INSERT INTO attempt_comparisons (session_id, sequence, comparison_json, created_at)
        VALUES (1, 1, '{\"turn_sequence\":1,\"original_transcript\":\"Original\",\"retry_transcript\":\"Retry\",\"target\":\"Target\",\"target_evidence\":\"newly_observed_in_retry\",\"word_count_change\":0,\"hesitation\":\"None\"}', 1);
        PRAGMA user_version = 2;",
        )
        .unwrap();
    drop(connection);

    let db = SessionDatabase::open(&path).unwrap();
    let version: i64 = db
        .connection
        .pragma_query_value(None, "user_version", |row| row.get(0))
        .unwrap();
    assert_eq!(version, SCHEMA_VERSION);
    assert_eq!(db.turns(1).unwrap()[0].learner, "Original");
    let restored = db.active_session().unwrap().unwrap();
    assert_eq!(restored.practice_mode, "voice");
    assert_eq!(restored.practice_phase, "speaking");
    assert_eq!(restored.written_turn_count, 0);
    let comparisons = db.comparisons(1).unwrap();
    assert_eq!(comparisons.len(), 1);
    assert_eq!(comparisons[0].retry_transcript, "Retry");

    // Verify new v3 memory tables work
    let card = db
        .save_phrase_card("I work there", "Work note", Some(1), Some(1))
        .unwrap();
    assert_eq!(card.phrase, "I work there");
    let memory = db.get_learning_memory().unwrap();
    assert_eq!(memory.phrase_cards.len(), 1);

    drop(db);
    let _ = std::fs::remove_file(path);
}

#[test]
fn migrates_version_eight_database_keeping_old_turns_without_an_origin() {
    let path = test_database_path();
    let mut db = SessionDatabase::open(&path).unwrap();
    let session = db.create_session("Question?").unwrap();
    db.save_turn(
        session,
        1,
        &StoredTurn {
            learner: "Original".into(),
            assistant_reply: "Reply".into(),
            assistant_question: "Next?".into(),
            answered_by: None,
        },
    )
    .unwrap();
    // Rewind to the version 8 shape: a turns table without the origin columns.
    db.connection
        .execute_batch(
            "ALTER TABLE turns DROP COLUMN answered_by_provider;
            ALTER TABLE turns DROP COLUMN answered_by_model;
            ALTER TABLE turns DROP COLUMN answered_by_backup;
            PRAGMA user_version = 8;",
        )
        .unwrap();
    drop(db);
    let mut db = SessionDatabase::open(&path).unwrap();
    let version: i64 = db
        .connection
        .pragma_query_value(None, "user_version", |row| row.get(0))
        .unwrap();
    assert_eq!(version, SCHEMA_VERSION);
    assert_eq!(db.turns(1).unwrap()[0].answered_by, None);
    let answered_by = crate::providers::AnsweredBy::apple(true);
    db.save_turn(
        1,
        2,
        &StoredTurn {
            learner: "Next".into(),
            assistant_reply: "Fine.".into(),
            assistant_question: "Why?".into(),
            answered_by: Some(answered_by.clone()),
        },
    )
    .unwrap();
    assert_eq!(db.turns(1).unwrap()[1].answered_by, Some(answered_by));
    drop(db);
    let _ = std::fs::remove_file(path);
}

#[test]
fn migrates_a_real_version_four_database_to_current_version() {
    let file = test_database_path();
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
fn migrates_existing_version_three_database_to_recall_storage() {
    let path = test_database_path();
    let db = SessionDatabase::open(&path).unwrap();
    db.connection
        .execute_batch("DROP TABLE ai_settings; DROP TABLE memory_review_items; DROP TABLE memory_review_runs; DROP TABLE session_phrase_recalls; DROP TABLE learning_usage_counter_baselines; DROP TABLE session_cue_exposures; DROP TABLE learning_usage_events; DROP TABLE turn_usage_assessments; PRAGMA user_version = 3;")
        .unwrap();
    drop(db);
    let db = SessionDatabase::open(&path).unwrap();
    let version: i64 = db
        .connection
        .pragma_query_value(None, "user_version", |row| row.get(0))
        .unwrap();
    assert_eq!(version, SCHEMA_VERSION);
    assert!(crate::learning::daily_plan(db.connection(), 1).is_ok());
    let session = db.active_session().unwrap();
    assert!(session.is_none());
    drop(db);
    std::fs::remove_file(path).unwrap();
}

#[test]
fn phrase_save_rejects_empty_normalized_text_and_incomplete_provenance() {
    let db = SessionDatabase::open_in_memory().unwrap();
    assert!(db.save_phrase_card("... !!!", "", None, None).is_err());
    assert!(db
        .save_phrase_card("Useful phrase", "", Some(1), None)
        .is_err());
}

#[test]
fn saving_phrase_card_deduplicates_by_normalized_text() {
    let db = SessionDatabase::open_in_memory().unwrap();
    let card1 = db
        .save_phrase_card("The main trade-off was...", "Note 1", None, None)
        .unwrap();
    assert_eq!(card1.id, 1);

    // Saving identical or normalized-equivalent phrase returns existing card
    let card2 = db
        .save_phrase_card("the main trade-off was", "Note 2", None, None)
        .unwrap();
    assert_eq!(card2.id, card1.id);
    assert_eq!(card2.normalized_phrase, card1.normalized_phrase);

    let memory = db.get_learning_memory().unwrap();
    assert_eq!(memory.phrase_cards.len(), 1);
}

#[test]
fn due_target_selection_excludes_future_archived_and_current_session_items() {
    let mut db = SessionDatabase::open_in_memory().unwrap();
    let first = db.create_session("Opening?").unwrap();
    db.save_turn(
        first,
        1,
        &StoredTurn {
            learner: "I work in there".into(),
            assistant_reply: "Reply".into(),
            assistant_question: "Next?".into(),
            answered_by: None,
        },
    )
    .unwrap();
    db.save_turn_feedback(
        first,
        1,
        &sample_turn_feedback(FocusCategory::Grammar, "I work there"),
    )
    .unwrap();
    db.save_turn(
        first,
        2,
        &StoredTurn {
            learner: "I worked in there yesterday".into(),
            assistant_reply: "Reply".into(),
            assistant_question: "Another?".into(),
            answered_by: None,
        },
    )
    .unwrap();
    db.save_turn_feedback(
        first,
        2,
        &sample_turn_feedback(FocusCategory::Grammar, "I work there"),
    )
    .unwrap();
    db.save_phrase_card(
        "The main trade-off was",
        "Decision cue",
        Some(first),
        Some(1),
    )
    .unwrap();
    db.save_phrase_card("Future phrase", "Later", Some(first), Some(1))
        .unwrap();
    db.save_phrase_card("Archived phrase", "Old", Some(first), Some(1))
        .unwrap();
    db.finish_session(first).unwrap();
    let second = db.create_session("Opening?").unwrap();
    db.save_turn(
        second,
        1,
        &StoredTurn {
            learner: "Current answer".into(),
            assistant_reply: "Reply".into(),
            assistant_question: "Next?".into(),
            answered_by: None,
        },
    )
    .unwrap();
    db.save_phrase_card("Current phrase", "Current", Some(second), Some(1))
        .unwrap();
    db.connection
        .execute("UPDATE mistakes SET next_review_at = 0", [])
        .unwrap();
    db.connection
        .execute(
            "UPDATE phrase_cards SET next_review_at = 0 WHERE phrase != 'Future phrase'",
            [],
        )
        .unwrap();
    db.connection
        .execute(
            "UPDATE phrase_cards SET status = 'archived' WHERE phrase = 'Archived phrase'",
            [],
        )
        .unwrap();

    let targets = db.due_learning_targets(second).unwrap();
    assert_eq!(targets.len(), 2);
    assert_eq!(targets[0].target, "I work there");
    assert_eq!(targets[1].target, "The main trade-off was");

    db.connection
        .execute(
            "UPDATE phrase_cards SET meaning_or_note = ?1 WHERE phrase = 'The main trade-off was'",
            ["word ".repeat(50)],
        )
        .unwrap();
    let bounded = db.due_learning_targets(second).unwrap();
    assert_eq!(bounded[1].cue.chars().count(), 160);
}

#[test]
fn session_mode_persists_and_turn_can_be_updated_in_place() {
    let mut db = SessionDatabase::open_in_memory().unwrap();
    let session_id = db
        .create_session_with_mode("coach", "What did you build?")
        .unwrap();
    let active = db.active_session().unwrap().unwrap();
    assert_eq!(active.id, session_id);
    let mode: String = db
        .connection
        .query_row(
            "SELECT mode FROM sessions WHERE id = ?1",
            [session_id as i64],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(mode, "coach");
    assert_eq!(active.opening_question, "What did you build?");

    let initial_turn = StoredTurn {
        learner: "I built a service.".into(),
        assistant_reply: "".into(),
        assistant_question: "".into(),
        answered_by: None,
    };
    db.save_turn(session_id, 1, &initial_turn).unwrap();
    let loaded = db.turn(session_id, 1).unwrap().unwrap();
    assert_eq!(loaded.learner, "I built a service.");
    assert_eq!(loaded.assistant_reply, "");

    let updated = db
        .update_turn(
            session_id,
            1,
            "Sounds interesting.",
            "What architecture did you use?",
            None,
            None,
        )
        .unwrap();
    assert!(updated);
    let after_update = db.turn(session_id, 1).unwrap().unwrap();
    assert_eq!(after_update.learner, "I built a service.");
    assert_eq!(after_update.assistant_reply, "Sounds interesting.");
    assert_eq!(
        after_update.assistant_question,
        "What architecture did you use?"
    );
}

fn stored(learner: &str) -> StoredTurn {
    StoredTurn {
        learner: learner.into(),
        assistant_reply: "Thanks".into(),
        assistant_question: "Next?".into(),
        answered_by: None,
    }
}

#[test]
fn version_nine_database_migrates_keeping_turns_without_details() {
    let mut db = SessionDatabase::open_in_memory().unwrap();
    let session_id = db.create_session("Opening?").unwrap();
    db.save_turn(session_id, 1, &stored("Old answer")).unwrap();
    db.connection
        .execute_batch(
            "DROP TABLE answer_help_uses;
             ALTER TABLE turns DROP COLUMN reply_ms;
             ALTER TABLE turns DROP COLUMN answer_duration_ms;
             PRAGMA user_version = 9;",
        )
        .unwrap();
    migrate(&db.connection).unwrap();
    let version: i64 = db
        .connection
        .pragma_query_value(None, "user_version", |row| row.get(0))
        .unwrap();
    assert_eq!(version, SCHEMA_VERSION);
    assert_eq!(
        db.turn(session_id, 1).unwrap().unwrap().learner,
        "Old answer"
    );
    assert_eq!(
        db.turn_details(session_id).unwrap(),
        vec![TurnDetails::default()]
    );
}

#[test]
fn turn_details_round_trip_per_turn() {
    let mut db = SessionDatabase::open_in_memory().unwrap();
    let session_id = db.create_session("Opening?").unwrap();
    db.record_answer_help_used(session_id, 1).unwrap();
    db.record_answer_help_used(session_id, 1).unwrap();
    db.save_turn_with_details(
        session_id,
        1,
        &stored("Spoken"),
        "voice",
        Some(800),
        Some(14_000),
    )
    .unwrap();
    db.save_turn_with_details(session_id, 2, &stored("Typed"), "text", None, None)
        .unwrap();
    assert!(db
        .update_turn(session_id, 2, "Reply", "Q?", None, Some(1_100))
        .unwrap());
    assert_eq!(
        db.turn_details(session_id).unwrap(),
        vec![
            TurnDetails {
                reply_ms: Some(800),
                answer_duration_ms: Some(14_000),
                help_used: true
            },
            TurnDetails {
                reply_ms: Some(1_100),
                answer_duration_ms: None,
                help_used: false
            },
        ]
    );
}

#[test]
fn stored_sessions_keep_their_goal_and_a_missing_goal_means_no_limit() {
    let path = test_database_path();
    let mut db = SessionDatabase::open(&path).unwrap();
    let with_goal = db.create_session("With goal?").unwrap();
    assert!(db.finish_session(with_goal).unwrap());
    let without_goal = db.create_session("No limit?").unwrap();
    db.connection
        .execute(
            "UPDATE sessions SET duration_goal_seconds = NULL WHERE id = ?1",
            [i64::try_from(without_goal).unwrap()],
        )
        .unwrap();
    assert_eq!(
        db.session_metadata(with_goal)
            .unwrap()
            .unwrap()
            .duration_goal_seconds,
        Some(600)
    );
    assert_eq!(
        db.session_metadata(without_goal)
            .unwrap()
            .unwrap()
            .duration_goal_seconds,
        None
    );
    assert_eq!(
        db.active_session().unwrap().unwrap().duration_goal_seconds,
        None
    );
    drop(db);
    let _ = std::fs::remove_file(path);
}

#[test]
fn the_profile_name_survives_a_save_and_old_profiles_get_an_empty_name() {
    let path = test_database_path();
    let mut db = SessionDatabase::open(&path).unwrap();
    assert_eq!(db.get_personal_profile().unwrap().name, "");
    db.save_personal_profile(&crate::personal_profile::PersonalProfile {
        name: "Oleksii".into(),
        ..Default::default()
    })
    .unwrap();
    assert_eq!(db.get_personal_profile().unwrap().name, "Oleksii");
    drop(db);
    let _ = std::fs::remove_file(path);
}

fn mistake_columns(db: &SessionDatabase) -> Vec<String> {
    db.connection
        .prepare("PRAGMA table_info(mistakes)")
        .unwrap()
        .query_map([], |row| row.get::<_, String>(1))
        .unwrap()
        .collect::<Result<_, _>>()
        .unwrap()
}

#[test]
fn migrates_a_version_twenty_two_database_to_the_mistakes_lessons_schema() {
    let path = test_database_path();
    let db = SessionDatabase::open(&path).unwrap();
    db.connection
        .execute_batch(
            "DROP INDEX idx_mistakes_rule_key;
             DROP TABLE mistake_lessons; DROP TABLE rule_cards; DROP TABLE rule_relapses;
             ALTER TABLE mistakes DROP COLUMN rule_key;
             ALTER TABLE mistakes DROP COLUMN ladder_step;
             ALTER TABLE mistakes DROP COLUMN fixed_at;
             ALTER TABLE mistakes DROP COLUMN step4_pass_days;
             INSERT INTO mistakes (normalized_key, category, original_example, corrected_example, explanation, times_seen, last_seen_at, next_review_at)
             VALUES ('grammar:i have a job', 'grammar', 'I have job', 'I have a job', 'Add a.', 1, 5, 6);
             PRAGMA user_version = 22;",
        )
        .unwrap();
    assert!(!mistake_columns(&db).contains(&"rule_key".to_string()));
    drop(db);

    let db = SessionDatabase::open(&path).unwrap();
    let version: i64 = db
        .connection
        .pragma_query_value(None, "user_version", |row| row.get(0))
        .unwrap();
    assert_eq!(version, SCHEMA_VERSION);
    let columns = mistake_columns(&db);
    for column in ["rule_key", "ladder_step", "fixed_at", "step4_pass_days"] {
        assert!(columns.contains(&column.to_string()), "{column}");
    }
    let (rule, step, fixed, pass_days, said): (Option<String>, i64, Option<i64>, i64, String) = db
        .connection
        .query_row(
            "SELECT rule_key, ladder_step, fixed_at, step4_pass_days, original_example FROM mistakes",
            [],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?)),
        )
        .unwrap();
    assert_eq!((rule, step, fixed, pass_days), (None, 1, None, 0));
    assert_eq!(said, "I have job");
    for table in ["mistake_lessons", "rule_cards", "rule_relapses"] {
        let count: i64 = db
            .connection
            .query_row(&format!("SELECT COUNT(*) FROM {table}"), [], |row| {
                row.get(0)
            })
            .unwrap();
        assert_eq!(count, 0, "{table}");
    }
    drop(db);
    std::fs::remove_file(path).unwrap();
}

#[test]
fn the_mistakes_migration_is_idempotent_when_columns_already_exist() {
    let path = test_database_path();
    let db = SessionDatabase::open(&path).unwrap();
    db.connection
        .execute_batch("PRAGMA user_version = 22;")
        .unwrap();
    drop(db);
    let db = SessionDatabase::open(&path).unwrap();
    let version: i64 = db
        .connection
        .pragma_query_value(None, "user_version", |row| row.get(0))
        .unwrap();
    assert_eq!(version, SCHEMA_VERSION);
    drop(db);
    std::fs::remove_file(path).unwrap();
}

#[test]
fn a_lesson_needs_a_valid_state_and_goes_away_with_its_mistake() {
    let db = SessionDatabase::open_in_memory().unwrap();
    db.connection
        .execute_batch(
            "INSERT INTO mistakes (id, normalized_key, category, original_example, corrected_example, explanation, last_seen_at, next_review_at)
             VALUES (1, 'k', 'grammar', 'a', 'b', 'c', 1, 1);",
        )
        .unwrap();
    assert!(db
        .connection
        .execute(
            "INSERT INTO mistake_lessons (mistake_id, state, updated_at) VALUES (1, 'weird', 1)",
            []
        )
        .is_err());
    db.connection
        .execute(
            "INSERT INTO mistake_lessons (mistake_id, state, updated_at) VALUES (1, 'pending', 1)",
            [],
        )
        .unwrap();
    db.connection.execute("PRAGMA foreign_keys = ON", []).ok();
    db.connection
        .execute("DELETE FROM mistakes WHERE id = 1", [])
        .unwrap();
    let left: i64 = db
        .connection
        .query_row("SELECT COUNT(*) FROM mistake_lessons", [], |row| row.get(0))
        .unwrap();
    assert_eq!(left, 0);
}

#[test]
fn migrates_a_version_twenty_three_database_to_the_practice_runs_schema() {
    let path = test_database_path();
    let db = SessionDatabase::open(&path).unwrap();
    db.connection
        .execute_batch(
            "DROP TABLE mistake_attempts; DROP TABLE mistake_runs;
             INSERT INTO mistakes (id, normalized_key, category, original_example, corrected_example, explanation, last_seen_at, next_review_at)
             VALUES (1, 'grammar:i have a job', 'grammar', 'I have job', 'I have a job', 'Add a.', 5, 6);
             PRAGMA user_version = 23;",
        )
        .unwrap();
    drop(db);

    let db = SessionDatabase::open(&path).unwrap();
    let version: i64 = db
        .connection
        .pragma_query_value(None, "user_version", |row| row.get(0))
        .unwrap();
    assert_eq!(version, SCHEMA_VERSION);
    db.connection
        .execute_batch(
            "INSERT INTO mistake_runs (id, kind, items_json, created_at) VALUES (1, 'due', '[]', 1);
             INSERT INTO mistake_attempts (mistake_id, run_id, step, input, answer, outcome, checked_by, created_at)
             VALUES (1, 1, 2, 'typed', 'x', 'checking', 'ai', 1);
             INSERT INTO mistake_attempts (mistake_id, run_id, step, input, answer, outcome, checked_by, created_at)
             VALUES (1, 1, 2, 'typed', 'y', 'retry', 'local', 2);",
        )
        .unwrap();
    assert!(db
        .connection
        .execute(
            "INSERT INTO mistake_attempts (mistake_id, run_id, step, input, answer, outcome, checked_by, created_at)
             VALUES (1, 1, 2, 'typed', 'z', 'pass', 'local', 3)",
            [],
        )
        .is_err());
    assert!(db
        .connection
        .execute(
            "INSERT INTO mistake_runs (kind, items_json, created_at) VALUES ('weird', '[]', 1)",
            [],
        )
        .is_err());
    let said: String = db
        .connection
        .query_row(
            "SELECT original_example FROM mistakes WHERE id = 1",
            [],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(said, "I have job");
    drop(db);
    std::fs::remove_file(path).unwrap();
}
