//! The list of finished sessions the learner can reopen.

use super::{to_u64_id, SessionDatabase};
use rusqlite::params;

pub(crate) struct FinishedSessionRow {
    pub(crate) session_id: u64,
    pub(crate) ended_at: i64,
    pub(crate) topic_id: String,
    pub(crate) topic_label: String,
    pub(crate) opening_question: String,
    pub(crate) is_mistake_practice: bool,
    pub(crate) answer_count: usize,
}

impl SessionDatabase {
    /// Finished sessions that have at least one answer, newest first.
    pub(crate) fn finished_sessions_page(
        &self,
        limit: usize,
        offset: usize,
    ) -> rusqlite::Result<Vec<FinishedSessionRow>> {
        let mut statement = self.connection.prepare(
            "SELECT s.id, s.ended_at,
                    COALESCE(s.topic_id, 'free_conversation'),
                    COALESCE(s.topic_label, 'Free conversation'),
                    s.opening_question,
                    COALESCE(s.is_mistake_practice, 0),
                    (SELECT COUNT(*) FROM turns t WHERE t.session_id = s.id) AS answers
             FROM sessions s
             WHERE s.ended_at IS NOT NULL AND answers > 0
             ORDER BY s.ended_at DESC, s.id DESC
             LIMIT ?1 OFFSET ?2",
        )?;
        let rows = statement.query_map(
            params![
                i64::try_from(limit).unwrap_or(i64::MAX),
                i64::try_from(offset).unwrap_or(i64::MAX)
            ],
            |row| {
                let answers: i64 = row.get(6)?;
                Ok(FinishedSessionRow {
                    session_id: to_u64_id(row.get(0)?)?,
                    ended_at: row.get(1)?,
                    topic_id: row.get(2)?,
                    topic_label: row.get(3)?,
                    opening_question: row.get(4)?,
                    is_mistake_practice: row.get(5)?,
                    answer_count: usize::try_from(answers).unwrap_or(0),
                })
            },
        )?;
        rows.collect()
    }
}
