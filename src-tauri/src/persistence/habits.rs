use super::{to_sql_id, SessionDatabase};
use rusqlite::params;

/// Finished sessions read for habits; more than the trend uses, since short ones are skipped.
const SESSIONS_READ: i64 = 30;

impl SessionDatabase {
    /// The learner's answers of each finished conversation session up to this one, joined into one
    /// text per session, oldest first. Mistake practice is a drill and is left out.
    pub(crate) fn finished_session_texts(
        &self,
        up_to_session_id: u64,
    ) -> rusqlite::Result<Vec<String>> {
        let mut statement = self.connection.prepare(
            "SELECT t.session_id, t.user_transcript FROM turns t
             WHERE t.session_id IN (
               SELECT id FROM sessions
               WHERE ended_at IS NOT NULL AND is_mistake_practice = 0 AND id <= ?1
               ORDER BY id DESC LIMIT ?2)
             ORDER BY t.session_id, t.sequence",
        )?;
        let rows = statement.query_map(
            params![to_sql_id(up_to_session_id)?, SESSIONS_READ],
            |row| Ok((row.get::<_, i64>(0)?, row.get::<_, String>(1)?)),
        )?;
        let mut texts: Vec<(i64, String)> = Vec::new();
        for row in rows {
            let (session_id, transcript) = row?;
            match texts.last_mut() {
                Some((last, text)) if *last == session_id => {
                    text.push(' ');
                    text.push_str(&transcript);
                }
                _ => texts.push((session_id, transcript)),
            }
        }
        Ok(texts.into_iter().map(|(_, text)| text).collect())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::conversation::StoredTurn;

    fn answer(db: &mut SessionDatabase, session: u64, sequence: usize, text: &str) {
        db.save_turn(
            session,
            sequence,
            &StoredTurn {
                learner: text.into(),
                assistant_reply: "Reply".into(),
                assistant_question: "Next?".into(),
                answered_by: None,
            },
        )
        .unwrap();
    }

    #[test]
    fn finished_conversations_come_back_oldest_first_one_text_each() {
        let mut db = SessionDatabase::open_in_memory().unwrap();
        let first = db.create_session("Q?").unwrap();
        answer(&mut db, first, 1, "one");
        answer(&mut db, first, 2, "two");
        db.finish_session(first).unwrap();
        let second = db.create_session("Q?").unwrap();
        answer(&mut db, second, 1, "three");
        db.finish_session(second).unwrap();

        assert_eq!(
            db.finished_session_texts(second).unwrap(),
            ["one two", "three"]
        );
        assert_eq!(db.finished_session_texts(first).unwrap(), ["one two"]);
    }

    #[test]
    fn a_session_still_open_is_left_out() {
        let mut db = SessionDatabase::open_in_memory().unwrap();
        let open = db.create_session("Q?").unwrap();
        answer(&mut db, open, 1, "one");

        assert!(db.finished_session_texts(open).unwrap().is_empty());
    }

    #[test]
    fn mistake_practice_is_a_drill_and_is_left_out() {
        let mut db = SessionDatabase::open_in_memory().unwrap();
        let drill = db.create_session("Q?").unwrap();
        answer(&mut db, drill, 1, "drill answer");
        db.finish_session(drill).unwrap();
        db.connection
            .execute(
                "UPDATE sessions SET is_mistake_practice = 1 WHERE id = ?1",
                [drill as i64],
            )
            .unwrap();

        assert!(db.finished_session_texts(drill).unwrap().is_empty());
    }
}
