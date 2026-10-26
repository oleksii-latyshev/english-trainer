use crate::conversation::SessionStore;
use crate::eva_growth::{
    domain::{GrowthActivity, SpokenSession, SunshineMoment},
    error::EvaGrowthError,
    ports::GrowthStore,
};
use crate::learning::infra::sqlite::independent_sessions_by_phrase;
use crate::speaking_activity::rounded_minutes;
use rusqlite::Connection;
use std::collections::HashMap;

const SESSIONS: &str = "SELECT id,
        CAST(julianday(date(?1 / 1000, 'unixepoch', 'localtime'))
           - julianday(date(started_at / 1000, 'unixepoch', 'localtime')) AS INTEGER),
        COALESCE(active_duration_ms, 0),
        COALESCE(topic_label, ''),
        COALESCE(practice_mode, 'voice') = 'text_chat'
     FROM sessions ORDER BY id";

pub struct SessionGrowthStore {
    sessions: SessionStore,
}

impl SessionGrowthStore {
    pub fn new(sessions: SessionStore) -> Self {
        Self { sessions }
    }
}

impl GrowthStore for SessionGrowthStore {
    fn activity(&self, now_ms: i64) -> Result<GrowthActivity, EvaGrowthError> {
        self.sessions
            .with_connection(|connection| read_activity(connection, now_ms))
            .map_err(|source| EvaGrowthError::Storage {
                operation: "read",
                source: Box::new(source),
            })
    }
}

struct SessionRow {
    session: SpokenSession,
    text_chat: bool,
}

fn read_sessions(connection: &Connection, now_ms: i64) -> rusqlite::Result<Vec<SessionRow>> {
    let mut statement = connection.prepare(SESSIONS)?;
    let rows = statement.query_map([now_ms], |row| {
        Ok(SessionRow {
            session: SpokenSession {
                session_id: u64::try_from(row.get::<_, i64>(0)?).unwrap_or(0),
                days_ago: row.get(1)?,
                active_ms: u64::try_from(row.get::<_, i64>(2)?).unwrap_or(0),
                topic: row.get(3)?,
            },
            text_chat: row.get(4)?,
        })
    })?;
    rows.collect()
}

fn read_phrases(connection: &Connection) -> rusqlite::Result<HashMap<u64, String>> {
    let mut statement = connection.prepare("SELECT id, phrase FROM phrase_cards")?;
    let rows = statement.query_map([], |row| {
        Ok((
            u64::try_from(row.get::<_, i64>(0)?).unwrap_or(0),
            row.get::<_, String>(1)?,
        ))
    })?;
    rows.collect()
}

fn read_activity(connection: &Connection, now_ms: i64) -> rusqlite::Result<GrowthActivity> {
    let rows = read_sessions(connection, now_ms)?;
    let days_ago: HashMap<u64, i64> = rows
        .iter()
        .map(|row| (row.session.session_id, row.session.days_ago))
        .collect();
    let phrases = read_phrases(connection)?;
    let mut sunshine = Vec::new();
    for (phrase_id, session_ids) in independent_sessions_by_phrase(connection)? {
        let Some(phrase) = phrases.get(&phrase_id) else {
            continue;
        };
        for session_id in session_ids {
            if let Some(&days_ago) = days_ago.get(&session_id) {
                sunshine.push(SunshineMoment {
                    session_id,
                    phrase_id,
                    days_ago,
                    phrase: phrase.clone(),
                });
            }
        }
    }
    let spoken = rows
        .into_iter()
        .filter(|row| !row.text_chat && rounded_minutes(row.session.active_ms) > 0)
        .map(|row| row.session)
        .collect();
    Ok(GrowthActivity {
        sessions: spoken,
        sunshine,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    const NOW: i64 = 1_791_460_800_000;
    const DAY_MS: i64 = 86_400_000;

    fn insert_session(connection: &Connection, started_at: i64, active_ms: i64, mode: &str) -> i64 {
        connection
            .execute(
                "INSERT INTO sessions (mode, scenario, started_at, ended_at, opening_question, active_duration_ms, practice_mode, topic_label)
                 VALUES ('conversation', 'free', ?1, ?1, 'Q?', ?2, ?3, 'Travel')",
                rusqlite::params![started_at, active_ms, mode],
            )
            .unwrap();
        connection.last_insert_rowid()
    }

    #[test]
    fn spoken_sessions_carry_their_day_and_text_chat_is_left_out() {
        let mut database = crate::persistence::SessionDatabase::open_in_memory().unwrap();
        let connection = database.connection_mut();
        insert_session(connection, NOW, 600_000, "voice");
        insert_session(connection, NOW - DAY_MS, 300_000, "voice");
        insert_session(connection, NOW, 900_000, "text_chat");
        insert_session(connection, NOW, 10_000, "voice");

        let activity = read_activity(connection, NOW).unwrap();

        let days: Vec<i64> = activity.sessions.iter().map(|s| s.days_ago).collect();
        assert_eq!(days, [0, 1]);
        assert_eq!(activity.sessions[0].topic, "Travel");
    }
}
