use super::SCHEMA_VERSION;
use rusqlite::Connection;

pub(super) fn migrate(connection: &Connection) -> rusqlite::Result<()> {
    let mut version: i64 = connection.pragma_query_value(None, "user_version", |row| row.get(0))?;
    if version < 1 {
        let transaction = connection.unchecked_transaction()?;
        transaction.execute_batch(
            "CREATE TABLE sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                mode TEXT NOT NULL,
                scenario TEXT NOT NULL,
                started_at INTEGER NOT NULL,
                ended_at INTEGER,
                conversation_provider TEXT NOT NULL DEFAULT 'agy',
                opening_question TEXT NOT NULL
            );
            CREATE UNIQUE INDEX one_active_session ON sessions ((1)) WHERE ended_at IS NULL;
            CREATE TABLE turns (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
                sequence INTEGER NOT NULL,
                user_transcript TEXT NOT NULL,
                assistant_reply TEXT NOT NULL,
                assistant_question TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                UNIQUE(session_id, sequence)
            );
            ",
        )?;
        transaction.pragma_update(None, "user_version", 1)?;
        transaction.commit()?;
        version = 1;
    }
    if version < 2 {
        let transaction = connection.unchecked_transaction()?;
        transaction.execute_batch(
            "CREATE TABLE turn_feedback (
                session_id INTEGER NOT NULL,
                sequence INTEGER NOT NULL,
                feedback_json TEXT NOT NULL,
                PRIMARY KEY(session_id, sequence),
                FOREIGN KEY(session_id, sequence) REFERENCES turns(session_id, sequence) ON DELETE CASCADE
            );
            CREATE TABLE attempt_comparisons (
                session_id INTEGER NOT NULL,
                sequence INTEGER NOT NULL,
                comparison_json TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                PRIMARY KEY(session_id, sequence),
                FOREIGN KEY(session_id, sequence) REFERENCES turns(session_id, sequence) ON DELETE CASCADE
            );",
        )?;
        transaction.pragma_update(None, "user_version", 2)?;
        transaction.commit()?;
        version = 2;
    }
    if version < 3 {
        let transaction = connection.unchecked_transaction()?;
        transaction.execute_batch(
            "CREATE TABLE mistakes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                normalized_key TEXT NOT NULL UNIQUE,
                category TEXT NOT NULL,
                original_example TEXT NOT NULL,
                corrected_example TEXT NOT NULL,
                explanation TEXT NOT NULL,
                severity TEXT,
                confidence REAL,
                times_seen INTEGER NOT NULL DEFAULT 1,
                times_correct_afterwards INTEGER NOT NULL DEFAULT 0,
                last_seen_at INTEGER NOT NULL,
                last_reviewed_at INTEGER,
                next_review_at INTEGER NOT NULL,
                interval_days INTEGER NOT NULL DEFAULT 1,
                ease_factor REAL NOT NULL DEFAULT 2.5,
                status TEXT NOT NULL DEFAULT 'new'
            );
            CREATE TABLE mistake_occurrences (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                mistake_id INTEGER NOT NULL REFERENCES mistakes(id) ON DELETE CASCADE,
                session_id INTEGER NOT NULL,
                sequence INTEGER NOT NULL,
                created_at INTEGER NOT NULL,
                UNIQUE(session_id, sequence),
                FOREIGN KEY(session_id, sequence) REFERENCES turns(session_id, sequence) ON DELETE CASCADE
            );
            CREATE TABLE phrase_cards (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                phrase TEXT NOT NULL,
                normalized_phrase TEXT NOT NULL UNIQUE,
                meaning_or_note TEXT NOT NULL,
                session_id INTEGER,
                sequence INTEGER,
                created_at INTEGER NOT NULL,
                last_reviewed_at INTEGER,
                next_review_at INTEGER NOT NULL,
                interval_days INTEGER NOT NULL DEFAULT 1,
                ease_factor REAL NOT NULL DEFAULT 2.5,
                status TEXT NOT NULL DEFAULT 'learning',
                FOREIGN KEY(session_id, sequence) REFERENCES turns(session_id, sequence) ON DELETE SET NULL
            );
            CREATE TABLE review_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                item_type TEXT NOT NULL,
                item_id INTEGER NOT NULL,
                response TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                mistake_id INTEGER REFERENCES mistakes(id) ON DELETE CASCADE,
                phrase_id INTEGER REFERENCES phrase_cards(id) ON DELETE CASCADE
            );
            CREATE INDEX idx_mistakes_next_review ON mistakes(next_review_at);
            CREATE INDEX idx_phrase_cards_next_review ON phrase_cards(next_review_at);
            CREATE INDEX idx_review_events_item ON review_events(item_type, item_id);",
        )?;
        transaction.pragma_update(None, "user_version", 3)?;
        transaction.commit()?;
        version = 3;
    }
    if version < 4 {
        let transaction = connection.unchecked_transaction()?;
        transaction.execute_batch(
            "CREATE TABLE session_phrase_recalls (
                session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
                phrase_id INTEGER NOT NULL REFERENCES phrase_cards(id) ON DELETE CASCADE,
                transcript TEXT NOT NULL,
                wording_observed INTEGER NOT NULL,
                created_at INTEGER NOT NULL,
                PRIMARY KEY(session_id, phrase_id)
            );",
        )?;
        transaction.pragma_update(None, "user_version", 4)?;
        transaction.commit()?;
        version = 4;
    }
    if version < 5 {
        let transaction = connection.unchecked_transaction()?;
        transaction.execute_batch(
            "CREATE TABLE memory_review_runs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                started_at INTEGER NOT NULL,
                completed_at INTEGER
            );
            CREATE UNIQUE INDEX one_active_memory_review_run ON memory_review_runs ((1)) WHERE completed_at IS NULL;
            CREATE TABLE memory_review_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                run_id INTEGER NOT NULL REFERENCES memory_review_runs(id) ON DELETE CASCADE,
                position INTEGER NOT NULL,
                item_type TEXT NOT NULL,
                item_id INTEGER NOT NULL,
                cue TEXT NOT NULL,
                target TEXT NOT NULL,
                transcript TEXT,
                wording_observed INTEGER,
                saved_response TEXT,
                next_review_at INTEGER,
                interval_days INTEGER,
                status TEXT,
                saved_at INTEGER,
                UNIQUE(run_id, position),
                UNIQUE(run_id, item_type, item_id)
            );
            CREATE INDEX idx_memory_review_items_run ON memory_review_items(run_id);",
        )?;
        transaction.pragma_update(None, "user_version", 5)?;
        transaction.commit()?;
        version = 5;
    }
    if version < 6 {
        let transaction = connection.unchecked_transaction()?;
        transaction.execute_batch(
            "CREATE TABLE turn_usage_assessments (
                session_id INTEGER NOT NULL,
                sequence INTEGER NOT NULL,
                assessed_at INTEGER NOT NULL,
                assessment_json TEXT NOT NULL,
                PRIMARY KEY(session_id, sequence),
                FOREIGN KEY(session_id, sequence) REFERENCES turns(session_id, sequence) ON DELETE CASCADE
            );
            CREATE TABLE learning_usage_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                item_type TEXT NOT NULL,
                item_id INTEGER NOT NULL,
                session_id INTEGER NOT NULL,
                sequence INTEGER NOT NULL,
                origin TEXT NOT NULL,
                original_turn_time INTEGER NOT NULL,
                outcome TEXT NOT NULL,
                exact_excerpt TEXT NOT NULL,
                confidence REAL NOT NULL,
                created_at INTEGER NOT NULL,
                FOREIGN KEY(session_id, sequence) REFERENCES turns(session_id, sequence) ON DELETE CASCADE
            );
            CREATE INDEX idx_learning_usage_events_item ON learning_usage_events(item_type, item_id);
            CREATE INDEX idx_learning_usage_events_turn ON learning_usage_events(session_id, sequence);
            CREATE UNIQUE INDEX idx_learning_usage_origin_identity
                ON learning_usage_events(session_id, sequence, item_type, item_id, origin);
            CREATE TABLE learning_usage_counter_baselines (
                item_id INTEGER PRIMARY KEY REFERENCES mistakes(id) ON DELETE CASCADE,
                baseline_count INTEGER NOT NULL
            );
            INSERT INTO learning_usage_counter_baselines (item_id, baseline_count)
                SELECT id, times_correct_afterwards FROM mistakes;
            CREATE TABLE session_cue_exposures (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
                item_type TEXT,
                item_id INTEGER,
                exposed_at INTEGER NOT NULL
            );
            CREATE INDEX idx_session_cue_exposures_session ON session_cue_exposures(session_id);",
        )?;
        transaction.pragma_update(None, "user_version", 6)?;
        transaction.commit()?;
        version = 6;
    }
    if version < 7 {
        let transaction = connection.unchecked_transaction()?;
        transaction.execute_batch("CREATE TABLE ai_settings (id INTEGER PRIMARY KEY CHECK(id = 1), settings_json TEXT NOT NULL);")?;
        transaction.pragma_update(None, "user_version", 7)?;
        transaction.commit()?;
    }
    if version < 8 {
        let transaction = connection.unchecked_transaction()?;
        transaction.execute_batch("CREATE TABLE IF NOT EXISTS turn_input_sources (
            session_id INTEGER NOT NULL,
            sequence INTEGER NOT NULL,
            input_source TEXT NOT NULL CHECK(input_source IN ('voice', 'edited', 'text')),
            PRIMARY KEY(session_id, sequence),
            FOREIGN KEY(session_id, sequence) REFERENCES turns(session_id, sequence) ON DELETE CASCADE
        );")?;
        transaction.pragma_update(None, "user_version", SCHEMA_VERSION)?;
        transaction.commit()?;
    }
    Ok(())
}
