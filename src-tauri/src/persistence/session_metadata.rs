use super::{now_ms, to_sql_id, SessionDatabase, StoredSession};
use rusqlite::{params, OptionalExtension};

pub(crate) struct NewSession<'a> {
    pub mode: &'a str,
    pub opening_question: &'a str,
    pub topic_id: &'a str,
    pub topic_label: &'a str,
    pub topic_custom: Option<&'a str>,
    pub duration_goal_seconds: u32,
    pub practice_mode: &'a str,
    pub practice_phase: &'a str,
    pub written_turn_count: usize,
}

pub(crate) struct PracticePhaseTransition<'a> {
    pub session_id: u64,
    pub phase: &'a str,
    pub written_turn_count: usize,
    pub expose_session_cues: bool,
    pub active_duration_ms: Option<u64>,
}

impl SessionDatabase {
    pub fn active_session(&self) -> rusqlite::Result<Option<StoredSession>> {
        self.connection
            .query_row(
                "SELECT id, COALESCE(topic_id, 'free_conversation'), COALESCE(topic_label, 'Free conversation'), topic_custom, COALESCE(duration_goal_seconds, 600), COALESCE(active_duration_ms, 0), started_at, opening_question, COALESCE(practice_mode, 'voice'), COALESCE(practice_phase, 'speaking'), COALESCE(written_turn_count, 0)
                 FROM sessions WHERE ended_at IS NULL LIMIT 1",
                [],
                stored_session,
            )
            .optional()
    }

    pub fn session_metadata(&self, session_id: u64) -> rusqlite::Result<Option<StoredSession>> {
        self.connection
            .query_row(
                "SELECT id, COALESCE(topic_id, 'free_conversation'), COALESCE(topic_label, 'Free conversation'), topic_custom, COALESCE(duration_goal_seconds, 600), COALESCE(active_duration_ms, 0), started_at, opening_question, COALESCE(practice_mode, 'voice'), COALESCE(practice_phase, 'speaking'), COALESCE(written_turn_count, 0)
                 FROM sessions WHERE id = ?1",
                [to_sql_id(session_id)?],
                stored_session,
            )
            .optional()
    }

    #[cfg(test)]
    pub fn create_session(&mut self, opening_question: &str) -> rusqlite::Result<u64> {
        self.create_session_with_mode("conversation", opening_question)
    }

    pub fn session_count(&self) -> rusqlite::Result<usize> {
        let count: i64 = self
            .connection
            .query_row("SELECT COUNT(*) FROM sessions", [], |row| row.get(0))?;
        usize::try_from(count).map_err(|_| rusqlite::Error::IntegralValueOutOfRange(0, count))
    }

    pub fn create_session_with_options(
        &mut self,
        options: NewSession<'_>,
    ) -> rusqlite::Result<u64> {
        self.connection.execute(
            "INSERT INTO sessions (mode, scenario, started_at, opening_question, topic_id, topic_label, topic_custom, duration_goal_seconds, active_duration_ms, practice_mode, practice_phase, written_turn_count)
             VALUES (?1, 'free_conversation', ?2, ?3, ?4, ?5, ?6, ?7, 0, ?8, ?9, ?10)",
            params![
                options.mode,
                now_ms(),
                options.opening_question,
                options.topic_id,
                options.topic_label,
                options.topic_custom,
                i64::from(options.duration_goal_seconds),
                options.practice_mode,
                options.practice_phase,
                i64::try_from(options.written_turn_count).unwrap_or(i64::MAX),
            ],
        )?;
        let row_id = self.connection.last_insert_rowid();
        u64::try_from(row_id).map_err(|_| rusqlite::Error::IntegralValueOutOfRange(0, row_id))
    }

    #[cfg(test)]
    pub fn create_session_with_mode(
        &mut self,
        mode: &str,
        opening_question: &str,
    ) -> rusqlite::Result<u64> {
        self.create_session_with_options(NewSession {
            mode,
            opening_question,
            topic_id: "free_conversation",
            topic_label: "Free conversation",
            topic_custom: None,
            duration_goal_seconds: 600,
            practice_mode: "voice",
            practice_phase: "speaking",
            written_turn_count: 0,
        })
    }

    pub fn finish_session_with_duration(
        &mut self,
        session_id: u64,
        active_duration_ms: u64,
    ) -> rusqlite::Result<bool> {
        Ok(self.connection.execute(
            "UPDATE sessions SET ended_at = ?1, active_duration_ms = ?2 WHERE id = ?3 AND ended_at IS NULL",
            params![
                now_ms(),
                to_sql_id(active_duration_ms)?,
                i64::try_from(session_id)
                    .map_err(|_| rusqlite::Error::IntegralValueOutOfRange(0, i64::MAX))?
            ],
        )? == 1)
    }

    pub fn update_session_active_duration(
        &mut self,
        session_id: u64,
        active_duration_ms: u64,
    ) -> rusqlite::Result<()> {
        self.connection.execute(
            "UPDATE sessions SET active_duration_ms = ?1 WHERE id = ?2",
            params![to_sql_id(active_duration_ms)?, to_sql_id(session_id)?],
        )?;
        Ok(())
    }

    /// Saves a phase change and its rehearsal cue exposure atomically.
    pub(crate) fn transition_practice_phase(
        &mut self,
        transition: PracticePhaseTransition<'_>,
    ) -> rusqlite::Result<bool> {
        let transaction = self.connection.transaction()?;
        let changed = transaction.execute(
            "UPDATE sessions SET practice_phase = ?1, written_turn_count = ?2, active_duration_ms = COALESCE(?3, active_duration_ms) WHERE id = ?4 AND ended_at IS NULL",
            rusqlite::params![transition.phase, i64::try_from(transition.written_turn_count).unwrap_or(i64::MAX), transition.active_duration_ms.map(to_sql_id).transpose()?, to_sql_id(transition.session_id)?],
        )? == 1;
        if changed && transition.expose_session_cues {
            transaction.execute(
                "INSERT INTO session_cue_exposures (session_id, item_type, item_id, exposed_at) VALUES (?1, NULL, NULL, ?2)",
                rusqlite::params![to_sql_id(transition.session_id)?, now_ms()],
            )?;
        }
        transaction.commit()?;
        Ok(changed)
    }

    pub fn get_personal_profile(&self) -> rusqlite::Result<crate::conversation::PersonalProfile> {
        self.connection
            .query_row(
                "SELECT role, stack, interests, goals FROM personal_profile WHERE id = 1",
                [],
                |row| {
                    Ok(crate::conversation::PersonalProfile {
                        role: row.get(0)?,
                        stack: row.get(1)?,
                        interests: row.get(2)?,
                        goals: row.get(3)?,
                    })
                },
            )
            .optional()
            .map(|opt| opt.unwrap_or_default())
    }

    pub fn save_personal_profile(
        &mut self,
        profile: &crate::conversation::PersonalProfile,
    ) -> rusqlite::Result<()> {
        self.connection.execute(
            "INSERT INTO personal_profile (id, role, stack, interests, goals)
             VALUES (1, ?1, ?2, ?3, ?4)
             ON CONFLICT(id) DO UPDATE SET
                 role = excluded.role,
                 stack = excluded.stack,
                 interests = excluded.interests,
                 goals = excluded.goals",
            params![
                profile.role,
                profile.stack,
                profile.interests,
                profile.goals
            ],
        )?;
        Ok(())
    }
}

fn stored_session(row: &rusqlite::Row<'_>) -> rusqlite::Result<StoredSession> {
    let id = row.get::<_, i64>(0)?;
    let duration_goal = row.get::<_, i64>(4)?;
    let active_duration = row.get::<_, i64>(5)?;
    Ok(StoredSession {
        id: u64::try_from(id).map_err(|_| rusqlite::Error::IntegralValueOutOfRange(0, id))?,
        topic_id: row.get(1)?,
        topic_label: row.get(2)?,
        topic_custom: row.get(3)?,
        duration_goal_seconds: u32::try_from(duration_goal)
            .map_err(|_| rusqlite::Error::IntegralValueOutOfRange(4, duration_goal))?,
        active_duration_ms: u64::try_from(active_duration)
            .map_err(|_| rusqlite::Error::IntegralValueOutOfRange(5, active_duration))?,
        started_at: row.get(6)?,
        opening_question: row.get(7)?,
        practice_mode: row.get(8)?,
        practice_phase: row.get(9)?,
        written_turn_count: usize::try_from(row.get::<_, i64>(10)?)
            .map_err(|_| rusqlite::Error::IntegralValueOutOfRange(10, -1))?,
    })
}
