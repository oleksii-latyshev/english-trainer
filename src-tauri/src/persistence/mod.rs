use crate::conversation::StoredTurn;
use crate::providers::{AttemptComparison, TurnFeedback};
use rusqlite::{params, Connection, OptionalExtension};
use std::path::Path;

const SCHEMA_VERSION: i64 = 2;

pub struct SessionDatabase {
    connection: Connection,
}

impl SessionDatabase {
    pub fn open_in_memory() -> rusqlite::Result<Self> {
        let connection = Connection::open_in_memory()?;
        connection.pragma_update(None, "foreign_keys", "ON")?;
        migrate(&connection)?;
        Ok(Self { connection })
    }

    pub fn open(path: impl AsRef<Path>) -> rusqlite::Result<Self> {
        let connection = Connection::open(path)?;
        connection.pragma_update(None, "foreign_keys", "ON")?;
        connection.busy_timeout(std::time::Duration::from_secs(5))?;
        migrate(&connection)?;
        Ok(Self { connection })
    }

    pub fn active_session(&self) -> rusqlite::Result<Option<StoredSession>> {
        self.connection
            .query_row(
                "SELECT id, opening_question FROM sessions WHERE ended_at IS NULL LIMIT 1",
                [],
                |row| {
                    Ok(StoredSession {
                        id: u64::try_from(row.get::<_, i64>(0)?)
                            .map_err(|_| rusqlite::Error::IntegralValueOutOfRange(0, -1))?,
                        opening_question: row.get(1)?,
                    })
                },
            )
            .optional()
    }

    pub fn turns(&self, session_id: u64) -> rusqlite::Result<Vec<StoredTurn>> {
        let mut statement = self.connection.prepare(
            "SELECT user_transcript, assistant_reply, assistant_question FROM turns WHERE session_id = ?1 ORDER BY sequence",
        )?;
        let rows = statement.query_map(
            [i64::try_from(session_id)
                .map_err(|_| rusqlite::Error::IntegralValueOutOfRange(0, i64::MAX))?],
            |row| {
                Ok(StoredTurn {
                    learner: row.get(0)?,
                    assistant_reply: row.get(1)?,
                    assistant_question: row.get(2)?,
                })
            },
        )?;
        rows.collect()
    }

    pub fn create_session(&mut self, opening_question: &str) -> rusqlite::Result<u64> {
        self.connection.execute(
            "INSERT INTO sessions (mode, scenario, started_at, opening_question) VALUES ('conversation', 'free_conversation', ?1, ?2)",
            params![now_ms(), opening_question],
        )?;
        Ok(self.connection.last_insert_rowid() as u64)
    }

    pub fn save_turn(
        &mut self,
        session_id: u64,
        sequence: usize,
        turn: &StoredTurn,
    ) -> rusqlite::Result<()> {
        let transaction = self.connection.transaction()?;
        transaction.execute(
            "INSERT INTO turns (session_id, sequence, user_transcript, assistant_reply, assistant_question, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![i64::try_from(session_id).map_err(|_| rusqlite::Error::IntegralValueOutOfRange(0, i64::MAX))?, i64::try_from(sequence).unwrap_or(i64::MAX), turn.learner, turn.assistant_reply, turn.assistant_question, now_ms()],
        )?;
        transaction.commit()
    }

    pub fn turn(&self, session_id: u64, sequence: usize) -> rusqlite::Result<Option<StoredTurn>> {
        self.connection
            .query_row(
                "SELECT user_transcript, assistant_reply, assistant_question FROM turns WHERE session_id = ?1 AND sequence = ?2",
                params![to_sql_id(session_id)?, to_sql_sequence(sequence)?],
                |row| Ok(StoredTurn {
                    learner: row.get(0)?,
                    assistant_reply: row.get(1)?,
                    assistant_question: row.get(2)?,
                }),
            )
            .optional()
    }

    pub fn save_turn_feedback(
        &mut self,
        session_id: u64,
        sequence: usize,
        feedback: &TurnFeedback,
    ) -> rusqlite::Result<()> {
        let encoded = serde_json::to_string(feedback)
            .map_err(|error| rusqlite::Error::ToSqlConversionFailure(Box::new(error)))?;
        self.connection.execute(
            "INSERT INTO turn_feedback (session_id, sequence, feedback_json) VALUES (?1, ?2, ?3) ON CONFLICT(session_id, sequence) DO UPDATE SET feedback_json = excluded.feedback_json",
            params![to_sql_id(session_id)?, to_sql_sequence(sequence)?, encoded],
        )?;
        Ok(())
    }

    pub fn turn_feedback(
        &self,
        session_id: u64,
        sequence: usize,
    ) -> rusqlite::Result<Option<TurnFeedback>> {
        let encoded: Option<String> = self
            .connection
            .query_row(
                "SELECT feedback_json FROM turn_feedback WHERE session_id = ?1 AND sequence = ?2",
                params![to_sql_id(session_id)?, to_sql_sequence(sequence)?],
                |row| row.get(0),
            )
            .optional()?;
        encoded
            .map(|json| {
                serde_json::from_str(&json).map_err(|error| {
                    rusqlite::Error::FromSqlConversionFailure(
                        0,
                        rusqlite::types::Type::Text,
                        Box::new(error),
                    )
                })
            })
            .transpose()
    }

    pub fn save_comparison(
        &mut self,
        session_id: u64,
        comparison: &AttemptComparison,
    ) -> rusqlite::Result<()> {
        let encoded = serde_json::to_string(comparison)
            .map_err(|error| rusqlite::Error::ToSqlConversionFailure(Box::new(error)))?;
        self.connection.execute(
            "INSERT INTO attempt_comparisons (session_id, sequence, comparison_json, created_at) VALUES (?1, ?2, ?3, ?4) ON CONFLICT(session_id, sequence) DO UPDATE SET comparison_json = excluded.comparison_json, created_at = excluded.created_at",
            params![to_sql_id(session_id)?, to_sql_sequence(comparison.turn_sequence)?, encoded, now_ms()],
        )?;
        Ok(())
    }

    pub fn comparisons(&self, session_id: u64) -> rusqlite::Result<Vec<AttemptComparison>> {
        let mut statement = self.connection.prepare(
            "SELECT comparison_json FROM attempt_comparisons WHERE session_id = ?1 ORDER BY sequence",
        )?;
        let rows = statement.query_map([to_sql_id(session_id)?], |row| {
            let json: String = row.get(0)?;
            serde_json::from_str(&json).map_err(|error| {
                rusqlite::Error::FromSqlConversionFailure(
                    0,
                    rusqlite::types::Type::Text,
                    Box::new(error),
                )
            })
        })?;
        rows.collect()
    }

    pub fn finish_session(&mut self, session_id: u64) -> rusqlite::Result<bool> {
        Ok(self.connection.execute(
            "UPDATE sessions SET ended_at = ?1 WHERE id = ?2 AND ended_at IS NULL",
            params![
                now_ms(),
                i64::try_from(session_id)
                    .map_err(|_| rusqlite::Error::IntegralValueOutOfRange(0, i64::MAX))?
            ],
        )? == 1)
    }

    #[cfg(test)]
    pub fn turn_count(&self, session_id: u64) -> rusqlite::Result<usize> {
        self.connection.query_row(
            "SELECT COUNT(*) FROM turns WHERE session_id = ?1",
            [i64::try_from(session_id)
                .map_err(|_| rusqlite::Error::IntegralValueOutOfRange(0, i64::MAX))?],
            |row| row.get::<_, i64>(0).map(|count| count as usize),
        )
    }
}

#[derive(Debug)]
pub struct StoredSession {
    pub id: u64,
    pub opening_question: String,
}

fn migrate(connection: &Connection) -> rusqlite::Result<()> {
    let version: i64 = connection.pragma_query_value(None, "user_version", |row| row.get(0))?;
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
        transaction.commit()?;
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
        transaction.pragma_update(None, "user_version", SCHEMA_VERSION)?;
        transaction.commit()?;
    }
    Ok(())
}

fn to_sql_id(value: u64) -> rusqlite::Result<i64> {
    i64::try_from(value).map_err(|_| rusqlite::Error::IntegralValueOutOfRange(0, i64::MAX))
}

fn to_sql_sequence(value: usize) -> rusqlite::Result<i64> {
    i64::try_from(value).map_err(|_| rusqlite::Error::IntegralValueOutOfRange(0, i64::MAX))
}

fn now_ms() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64
}

#[cfg(test)]
#[path = "tests.rs"]
mod tests;
