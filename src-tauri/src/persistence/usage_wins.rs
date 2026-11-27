use super::*;
use crate::conversation::DebriefWin;

impl SessionDatabase {
    /// Taken phrases the usage review saw the learner use without help in this session.
    /// With help, slipped and uncertain outcomes never count.
    pub fn session_wins(&self, session_id: u64) -> rusqlite::Result<Vec<DebriefWin>> {
        let mut statement = self.connection.prepare(
            "SELECT e.sequence, p.phrase FROM learning_usage_events e
             JOIN phrase_cards p ON p.id = e.item_id
             WHERE e.item_type = 'phrase' AND e.outcome = 'correct' AND e.session_id = ?1
             ORDER BY e.sequence, e.id",
        )?;
        let rows = statement.query_map(params![to_sql_id(session_id)?], |row| {
            Ok(DebriefWin {
                sequence: row.get::<_, i64>(0)? as usize,
                phrase: row.get(1)?,
            })
        })?;
        rows.collect()
    }
}
