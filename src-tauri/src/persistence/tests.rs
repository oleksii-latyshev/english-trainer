use super::*;
use std::sync::atomic::{AtomicUsize, Ordering};

static NEXT_PATH: AtomicUsize = AtomicUsize::new(0);

fn test_database_path() -> std::path::PathBuf {
    let index = NEXT_PATH.fetch_add(1, Ordering::Relaxed);
    std::env::temp_dir().join(format!(
        "english-trainer-db-{}-{index}.sqlite3",
        std::process::id()
    ))
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
fn migrates_existing_version_one_sessions_and_turns() {
    let path = test_database_path();
    let connection = rusqlite::Connection::open(&path).unwrap();
    connection.execute_batch(
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
        INSERT INTO sessions (mode, scenario, started_at, opening_question) VALUES ('conversation', 'free', 1, 'Question?');
        INSERT INTO turns (session_id, sequence, user_transcript, assistant_reply, assistant_question, created_at)
        VALUES (1, 1, 'Original', 'Reply', 'Next?', 1);
        PRAGMA user_version = 1;",
    ).unwrap();
    drop(connection);

    let db = SessionDatabase::open(&path).unwrap();
    let version: i64 = db
        .connection
        .pragma_query_value(None, "user_version", |row| row.get(0))
        .unwrap();
    assert_eq!(version, 2);
    assert_eq!(db.turns(1).unwrap()[0].learner, "Original");
    db.connection
        .query_row("SELECT COUNT(*) FROM attempt_comparisons", [], |row| {
            row.get::<_, i64>(0)
        })
        .unwrap();
    drop(db);
    let _ = std::fs::remove_file(path);
}
