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
