use crate::conversation::StoredTurn;
#[cfg(test)]
use crate::learning::{LearningStatus, MistakeRecord};
#[cfg(test)]
use crate::providers::FocusCategory;
use crate::providers::{AttemptComparison, TurnFeedback};
use rusqlite::{params, Connection, OptionalExtension};

mod ai_settings;
mod daily_recall;
mod learning_reviews;
mod learning_targets;
pub(crate) mod learning_usage;
mod learning_writes;
mod memory_recall;
mod schema;
mod session_summary;
use std::path::Path;

const SCHEMA_VERSION: i64 = 7;

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
                "SELECT id, mode, opening_question FROM sessions WHERE ended_at IS NULL LIMIT 1",
                [],
                |row| {
                    Ok(StoredSession {
                        id: u64::try_from(row.get::<_, i64>(0)?)
                            .map_err(|_| rusqlite::Error::IntegralValueOutOfRange(0, -1))?,
                        mode: row.get(1)?,
                        opening_question: row.get(2)?,
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

    #[cfg(test)]
    pub fn create_session(&mut self, opening_question: &str) -> rusqlite::Result<u64> {
        self.create_session_with_mode("conversation", opening_question)
    }

    pub fn create_session_with_mode(
        &mut self,
        mode: &str,
        opening_question: &str,
    ) -> rusqlite::Result<u64> {
        self.connection.execute(
            "INSERT INTO sessions (mode, scenario, started_at, opening_question) VALUES (?1, 'free_conversation', ?2, ?3)",
            params![mode, now_ms(), opening_question],
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

    pub fn update_turn(
        &mut self,
        session_id: u64,
        sequence: usize,
        assistant_reply: &str,
        assistant_question: &str,
    ) -> rusqlite::Result<bool> {
        let count = self.connection.execute(
            "UPDATE turns SET assistant_reply = ?1, assistant_question = ?2 WHERE session_id = ?3 AND sequence = ?4",
            params![
                assistant_reply,
                assistant_question,
                to_sql_id(session_id)?,
                to_sql_sequence(sequence)?,
            ],
        )?;
        Ok(count == 1)
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

    #[cfg(test)]
    pub fn mistake_by_key(&self, key: &str) -> rusqlite::Result<Option<MistakeRecord>> {
        self.connection
            .query_row(
                "SELECT id, normalized_key, category, original_example, corrected_example,
                        explanation, times_seen, times_correct_afterwards, last_seen_at,
                        last_reviewed_at, next_review_at, interval_days, ease_factor, status
                 FROM mistakes WHERE normalized_key = ?1",
                params![key],
                |row| {
                    let cat_str: String = row.get(2)?;
                    let category = match cat_str.as_str() {
                        "vocabulary" => FocusCategory::Vocabulary,
                        "coherence" => FocusCategory::Coherence,
                        "interaction" => FocusCategory::Interaction,
                        _ => FocusCategory::Grammar,
                    };
                    let status_str: String = row.get(13)?;
                    let next_review: i64 = row.get(10)?;
                    Ok(MistakeRecord {
                        id: row.get::<_, i64>(0)? as u64,
                        normalized_key: row.get(1)?,
                        category,
                        original_example: row.get(3)?,
                        corrected_example: row.get(4)?,
                        explanation: row.get(5)?,
                        times_seen: row.get::<_, i64>(6)? as usize,
                        times_correct_afterwards: row.get::<_, i64>(7)? as usize,
                        last_seen_at: row.get(8)?,
                        last_reviewed_at: row.get(9)?,
                        next_review_at: next_review,
                        interval_days: row.get(11)?,
                        ease_factor: row.get(12)?,
                        status: LearningStatus::parse(&status_str).unwrap_or(LearningStatus::New),
                        is_due: next_review <= now_ms(),
                    })
                },
            )
            .optional()
    }
}

#[derive(Debug)]
pub struct StoredSession {
    pub id: u64,
    pub mode: String,
    pub opening_question: String,
}

use schema::migrate;

fn to_sql_id(value: u64) -> rusqlite::Result<i64> {
    i64::try_from(value).map_err(|_| rusqlite::Error::IntegralValueOutOfRange(0, i64::MAX))
}

fn to_u64_id(value: i64) -> rusqlite::Result<u64> {
    u64::try_from(value).map_err(|_| rusqlite::Error::IntegralValueOutOfRange(0, -1))
}

fn to_safe_u64_id(value: i64) -> rusqlite::Result<u64> {
    let id = to_u64_id(value)?;
    if id == 0 || id > 9_007_199_254_740_991 {
        return Err(rusqlite::Error::IntegralValueOutOfRange(0, value));
    }
    Ok(id)
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

#[cfg(test)]
#[path = "memory_recall_tests.rs"]
mod memory_recall_tests;

#[cfg(test)]
#[path = "learning_usage_tests.rs"]
mod learning_usage_tests;
