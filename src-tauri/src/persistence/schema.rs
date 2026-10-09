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
        transaction.pragma_update(None, "user_version", 8)?;
        transaction.commit()?;
        version = 8;
    }
    if version < 9 {
        let transaction = connection.unchecked_transaction()?;
        // Nullable: turns stored before the origin was recorded keep NULL and show no origin.
        for (column, kind) in [
            ("answered_by_provider", "TEXT"),
            ("answered_by_model", "TEXT"),
            ("answered_by_backup", "INTEGER"),
        ] {
            if !has_column(&transaction, "turns", column)? {
                transaction
                    .execute_batch(&format!("ALTER TABLE turns ADD COLUMN {column} {kind};"))?;
            }
        }
        transaction.pragma_update(None, "user_version", 9)?;
        transaction.commit()?;
        version = 9;
    }
    if version < 10 {
        let transaction = connection.unchecked_transaction()?;
        // Nullable: turns stored before these details were recorded keep NULL and show none.
        for column in ["reply_ms", "answer_duration_ms"] {
            if !has_column(&transaction, "turns", column)? {
                transaction.execute_batch(&format!(
                    "ALTER TABLE turns ADD COLUMN {column} INTEGER CHECK({column} IS NULL OR {column} >= 0);"
                ))?;
            }
        }
        // Keyed by the answer's sequence, not by a turn row: help is opened before the answer exists.
        transaction.execute_batch(
            "CREATE TABLE IF NOT EXISTS answer_help_uses (
            session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
            sequence INTEGER NOT NULL CHECK(sequence >= 1),
            PRIMARY KEY(session_id, sequence)
        );",
        )?;
        transaction.pragma_update(None, "user_version", 10)?;
        transaction.commit()?;
        version = 10;
    }
    if version < 11 {
        let transaction = connection.unchecked_transaction()?;
        // How often background coaching failed for an answer. An answer with feedback needs no row;
        // an answer without feedback and under the attempt limit is still waiting in the queue.
        transaction.execute_batch(
            "CREATE TABLE IF NOT EXISTS coaching_failures (
            session_id INTEGER NOT NULL,
            sequence INTEGER NOT NULL,
            failed_attempts INTEGER NOT NULL CHECK(failed_attempts >= 0),
            PRIMARY KEY(session_id, sequence),
            FOREIGN KEY(session_id, sequence) REFERENCES turns(session_id, sequence) ON DELETE CASCADE
        );",
        )?;
        transaction.pragma_update(None, "user_version", 11)?;
        transaction.commit()?;
        version = 11;
    }
    if version < 12 {
        let transaction = connection.unchecked_transaction()?;
        // Requests are counted per Pacific day, source and model; only the last limit error per
        // source is kept. Neither Gemini nor Antigravity can report its remaining quota.
        transaction.execute_batch(
            "CREATE TABLE IF NOT EXISTS api_usage_days (
            day TEXT NOT NULL,
            source TEXT NOT NULL,
            model TEXT NOT NULL,
            requests INTEGER NOT NULL CHECK(requests >= 0),
            PRIMARY KEY(day, source, model)
        );
        CREATE TABLE IF NOT EXISTS api_usage_last_limit (
            source TEXT PRIMARY KEY,
            occurred_at_ms INTEGER NOT NULL,
            model TEXT NOT NULL,
            message TEXT NOT NULL,
            resets_at_ms INTEGER
        );",
        )?;
        transaction.pragma_update(None, "user_version", 12)?;
        transaction.commit()?;
        version = 12;
    }
    if version < 13 {
        let transaction = connection.unchecked_transaction()?;
        // The glossary is seeded here, once: a learner who empties it later keeps it empty.
        let is_new: bool = transaction.query_row(
            "SELECT COUNT(*) = 0 FROM sqlite_master WHERE name = 'glossary_terms'",
            [],
            |row| row.get(0),
        )?;
        transaction.execute_batch(
            "CREATE TABLE IF NOT EXISTS speech_settings (
                id INTEGER PRIMARY KEY CHECK(id = 1),
                model_file TEXT NOT NULL,
                keep_raw_audio INTEGER NOT NULL DEFAULT 0 CHECK(keep_raw_audio IN (0, 1))
            );
            CREATE TABLE IF NOT EXISTS glossary_terms (
                position INTEGER PRIMARY KEY,
                term TEXT NOT NULL
            );",
        )?;
        for (position, term) in crate::audio::SEED_GLOSSARY
            .iter()
            .enumerate()
            .filter(|_| is_new)
        {
            transaction.execute(
                "INSERT INTO glossary_terms(position, term) VALUES(?1, ?2)",
                rusqlite::params![position as i64, term],
            )?;
        }
        transaction.pragma_update(None, "user_version", 13)?;
        transaction.commit()?;
        version = 13;
    }
    if version < 14 {
        let transaction = connection.unchecked_transaction()?;
        // An empty model_file means "no choice": the app picks the best installed model. Until
        // now base.en was the stored default, so a stored base.en is not a deliberate choice.
        let has_live_transcript: bool = transaction.query_row(
            "SELECT COUNT(*) > 0 FROM pragma_table_info('speech_settings') WHERE name = 'live_transcript'",
            [],
            |row| row.get(0),
        )?;
        if !has_live_transcript {
            transaction.execute_batch(
                "ALTER TABLE speech_settings
                    ADD COLUMN live_transcript INTEGER NOT NULL DEFAULT 1 CHECK(live_transcript IN (0, 1));",
            )?;
        }
        transaction.execute(
            "UPDATE speech_settings SET model_file = '' WHERE model_file = 'ggml-base.en.bin'",
            [],
        )?;
        transaction.pragma_update(None, "user_version", 14)?;
        transaction.commit()?;
        version = 14;
    }
    if version < 15 {
        let transaction = connection.unchecked_transaction()?;
        for (column, kind, default_val) in [
            ("topic_id", "TEXT", "'free_conversation'"),
            ("topic_label", "TEXT", "'Free conversation'"),
            ("topic_custom", "TEXT", "NULL"),
            ("duration_goal_seconds", "INTEGER", "600"),
            ("active_duration_ms", "INTEGER", "0"),
        ] {
            if !has_column(&transaction, "sessions", column)? {
                transaction.execute_batch(&format!(
                    "ALTER TABLE sessions ADD COLUMN {column} {kind} DEFAULT {default_val};"
                ))?;
            }
        }
        transaction.execute_batch(
            "CREATE TABLE IF NOT EXISTS personal_profile (
                id INTEGER PRIMARY KEY CHECK(id = 1),
                role TEXT NOT NULL DEFAULT '',
                stack TEXT NOT NULL DEFAULT '',
                interests TEXT NOT NULL DEFAULT '',
                goals TEXT NOT NULL DEFAULT ''
            );
            INSERT OR IGNORE INTO personal_profile (id, role, stack, interests, goals)
            VALUES (1, '', '', '', '');",
        )?;
        // Earlier versions measured finished sessions as wall time. Preserve that historical
        // duration once, while all open legacy sessions resume paused at zero active time.
        transaction.execute(
            "UPDATE sessions SET active_duration_ms = MAX(0, ended_at - started_at)
             WHERE ended_at IS NOT NULL AND active_duration_ms = 0",
            [],
        )?;
        transaction.pragma_update(None, "user_version", 15)?;
        transaction.commit()?;
        version = 15;
    }
    if version < 16 {
        let transaction = connection.unchecked_transaction()?;
        for (column, kind, default_val) in [
            ("practice_mode", "TEXT NOT NULL", "'voice'"),
            ("practice_phase", "TEXT NOT NULL", "'speaking'"),
            ("written_turn_count", "INTEGER NOT NULL", "0"),
        ] {
            if !has_column(&transaction, "sessions", column)? {
                transaction.execute_batch(&format!(
                    "ALTER TABLE sessions ADD COLUMN {column} {kind} DEFAULT {default_val};"
                ))?;
            }
        }
        transaction.pragma_update(None, "user_version", 16)?;
        transaction.commit()?;
        version = 16;
    }
    if version < 17 {
        let transaction = connection.unchecked_transaction()?;
        if !has_column(&transaction, "sessions", "is_mistake_practice")? {
            transaction.execute_batch(
                "ALTER TABLE sessions ADD COLUMN is_mistake_practice INTEGER NOT NULL DEFAULT 0;",
            )?;
        }
        transaction.execute_batch(
            "CREATE TABLE IF NOT EXISTS mistake_practice_questions (
                session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
                position INTEGER NOT NULL CHECK(position BETWEEN 1 AND 5),
                mistake_id INTEGER NOT NULL,
                original TEXT NOT NULL,
                corrected TEXT NOT NULL,
                question TEXT NOT NULL,
                PRIMARY KEY(session_id, position)
            );
            CREATE INDEX IF NOT EXISTS idx_mistake_practice_questions_session
                ON mistake_practice_questions(session_id);",
        )?;
        transaction.pragma_update(None, "user_version", 17)?;
        transaction.commit()?;
        version = 17;
    }
    if version < 18 {
        let transaction = connection.unchecked_transaction()?;
        transaction.execute_batch(
            "CREATE TABLE IF NOT EXISTS translation_settings (
                id INTEGER PRIMARY KEY CHECK(id = 1),
                native_language TEXT NOT NULL DEFAULT 'ru'
            );
            INSERT OR IGNORE INTO translation_settings (id, native_language) VALUES (1, 'ru');",
        )?;
        transaction.pragma_update(None, "user_version", SCHEMA_VERSION)?;
        transaction.commit()?;
    }
    Ok(())
}

fn has_column(connection: &Connection, table: &str, column: &str) -> rusqlite::Result<bool> {
    connection
        .prepare(&format!("PRAGMA table_info({table})"))?
        .query_map([], |row| row.get::<_, String>(1))?
        .try_fold(false, |found, name| Ok(found || name? == column))
}
