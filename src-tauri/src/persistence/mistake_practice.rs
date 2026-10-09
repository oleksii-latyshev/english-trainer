use super::{now_ms, to_safe_u64_id, to_sql_id, SessionDatabase};
use crate::learning::mistake_practice::{MistakePracticeCandidate, MistakePracticeQuestion};
use crate::persistence::session_metadata::{insert_session, NewSession};
use rusqlite::params;

impl SessionDatabase {
    #[cfg(test)]
    pub fn seed_recurring_mistake(
        &mut self,
        original: &str,
        corrected: &str,
        times_seen: i64,
        last_seen_at: i64,
    ) -> rusqlite::Result<u64> {
        self.connection.execute(
            "INSERT INTO mistakes (normalized_key, category, original_example, corrected_example, explanation, times_seen, last_seen_at, next_review_at, status) VALUES (?1, 'grammar', ?2, ?3, 'Use the natural form.', ?4, ?5, 0, 'learning')",
            params![format!("practice:{original}:{corrected}"), original, corrected, times_seen, last_seen_at],
        )?;
        to_safe_u64_id(self.connection.last_insert_rowid())
    }

    #[cfg(test)]
    pub fn reject_mistake_practice_cue(&self) -> rusqlite::Result<()> {
        self.connection.execute_batch(
            "CREATE TRIGGER reject_test_mistake_practice_cue BEFORE INSERT ON session_cue_exposures
             BEGIN SELECT RAISE(ABORT, 'test cue failure'); END;",
        )
    }

    #[cfg(test)]
    pub fn has_session_wide_cue_exposure(&self, session_id: u64) -> rusqlite::Result<bool> {
        self.connection.query_row(
            "SELECT EXISTS(SELECT 1 FROM session_cue_exposures WHERE session_id = ?1 AND item_type IS NULL AND item_id IS NULL)",
            [to_sql_id(session_id)?],
            |row| row.get(0),
        )
    }

    pub fn recurring_mistakes(&self) -> rusqlite::Result<Vec<MistakePracticeCandidate>> {
        let mut statement = self.connection.prepare(
            "SELECT id, original_example, corrected_example, explanation, times_seen, last_seen_at
             FROM mistakes WHERE status != 'archived' AND times_seen >= 2
             AND trim(original_example) != '' AND trim(corrected_example) != '' AND trim(explanation) != ''
             AND length(original_example) <= 300 AND length(corrected_example) <= 300 AND length(explanation) <= 500
             ORDER BY times_seen DESC, last_seen_at DESC, id ASC LIMIT 5",
        )?;
        let rows = statement.query_map([], |row| {
            let id = to_safe_u64_id(row.get(0)?)?;
            let times_seen = usize::try_from(row.get::<_, i64>(4)?)
                .map_err(|_| rusqlite::Error::IntegralValueOutOfRange(4, -1))?;
            Ok(MistakePracticeCandidate {
                id,
                original: row.get(1)?,
                corrected: row.get(2)?,
                explanation: row.get(3)?,
                times_seen,
                last_seen_at: row.get(5)?,
            })
        })?;
        rows.collect()
    }

    /// Rechecks every selected target and saves the session, plan and cue atomically.
    pub fn create_mistake_practice_session(
        &mut self,
        options: NewSession<'_>,
        questions: &[MistakePracticeQuestion],
        targets: &[MistakePracticeCandidate],
    ) -> rusqlite::Result<Option<u64>> {
        let transaction = self.connection.transaction()?;
        for target in targets {
            let still_valid: bool = transaction.query_row(
                "SELECT EXISTS(SELECT 1 FROM mistakes WHERE id = ?1 AND status != 'archived' AND times_seen >= 2 AND original_example = ?2 AND corrected_example = ?3)",
                params![to_sql_id(target.id)?, target.original, target.corrected], |row| row.get(0))?;
            if !still_valid {
                return Ok(None);
            }
        }
        let session_id = insert_session(&transaction, options)?;
        if session_id > 9_007_199_254_740_991 {
            return Err(rusqlite::Error::IntegralValueOutOfRange(0, i64::MAX));
        }
        for (index, question) in questions.iter().enumerate() {
            transaction.execute(
                "INSERT INTO mistake_practice_questions (session_id, position, mistake_id, original, corrected, question) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                params![to_sql_id(session_id)?, i64::try_from(index + 1).unwrap_or(i64::MAX), to_sql_id(question.mistake_id)?, question.original, question.corrected, question.question],
            )?;
        }
        transaction.execute(
            "INSERT INTO session_cue_exposures (session_id, item_type, item_id, exposed_at) VALUES (?1, NULL, NULL, ?2)",
            params![to_sql_id(session_id)?, now_ms()],
        )?;
        transaction.commit()?;
        Ok(Some(session_id))
    }

    pub fn mistake_practice_questions(
        &self,
        session_id: u64,
    ) -> rusqlite::Result<Vec<MistakePracticeQuestion>> {
        let mut statement = self.connection.prepare(
            "SELECT mistake_id, original, corrected, question FROM mistake_practice_questions WHERE session_id = ?1 ORDER BY position",
        )?;
        let rows = statement.query_map([to_sql_id(session_id)?], |row| {
            Ok(MistakePracticeQuestion {
                mistake_id: to_safe_u64_id(row.get(0)?)?,
                original: row.get(1)?,
                corrected: row.get(2)?,
                question: row.get(3)?,
            })
        })?;
        rows.collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn question_plan_session_and_cue_roll_back_together() {
        let mut database = SessionDatabase::open_in_memory().unwrap();
        database
            .seed_recurring_mistake("I work in there", "I work there", 2, 5)
            .unwrap();
        let candidates = database.recurring_mistakes().unwrap();
        let questions: Vec<_> = (0..5)
            .map(|index| MistakePracticeQuestion {
                mistake_id: candidates[0].id,
                original: candidates[0].original.clone(),
                corrected: candidates[0].corrected.clone(),
                question: format!("Question number {index}?"),
            })
            .collect();
        database
            .connection
            .execute_batch(
                "CREATE TRIGGER reject_mistake_practice_cue BEFORE INSERT ON session_cue_exposures
             BEGIN SELECT RAISE(ABORT, 'test failure'); END;",
            )
            .unwrap();
        let error = database
            .create_mistake_practice_session(
                NewSession {
                    mode: "conversation",
                    opening_question: &questions[0].question,
                    topic_id: "free_conversation",
                    topic_label: "Usual mistakes",
                    topic_custom: None,
                    duration_goal_seconds: 300,
                    practice_mode: "voice",
                    practice_phase: "speaking",
                    written_turn_count: 0,
                    is_mistake_practice: true,
                },
                &questions,
                &candidates,
            )
            .unwrap_err();
        assert!(error.to_string().contains("test failure"));
        let sessions: i64 = database
            .connection
            .query_row("SELECT COUNT(*) FROM sessions", [], |row| row.get(0))
            .unwrap();
        let plans: i64 = database
            .connection
            .query_row(
                "SELECT COUNT(*) FROM mistake_practice_questions",
                [],
                |row| row.get(0),
            )
            .unwrap();
        let cues: i64 = database
            .connection
            .query_row("SELECT COUNT(*) FROM session_cue_exposures", [], |row| {
                row.get(0)
            })
            .unwrap();
        assert_eq!((sessions, plans, cues), (0, 0, 0));
    }

    #[test]
    fn candidate_selection_is_frequency_then_recency_and_ignores_due_date() {
        let mut database = SessionDatabase::open_in_memory().unwrap();
        let older = database
            .seed_recurring_mistake("first wrong form", "first right form", 3, 10)
            .unwrap();
        let newer = database
            .seed_recurring_mistake("second wrong form", "second right form", 3, 20)
            .unwrap();
        let frequent = database
            .seed_recurring_mistake("third wrong form", "third right form", 5, 1)
            .unwrap();
        let archived = database
            .seed_recurring_mistake("hidden wrong form", "hidden right form", 8, 90)
            .unwrap();
        let single = database
            .seed_recurring_mistake("single wrong form", "single right form", 1, 100)
            .unwrap();
        database
            .connection
            .execute("UPDATE mistakes SET next_review_at = 9999999999999", [])
            .unwrap();
        database
            .connection
            .execute(
                "UPDATE mistakes SET status = 'archived' WHERE id = ?1",
                [to_sql_id(archived).unwrap()],
            )
            .unwrap();
        let ids: Vec<_> = database
            .recurring_mistakes()
            .unwrap()
            .into_iter()
            .map(|item| item.id)
            .collect();
        assert_eq!(ids, vec![frequent, newer, older]);
        assert!(!ids.contains(&single));
    }

    #[test]
    fn version_sixteen_sessions_migrate_with_mistake_flag_false() {
        let mut database = SessionDatabase::open_in_memory().unwrap();
        let session_id = database
            .create_session_with_mode("conversation", "Original prompt?")
            .unwrap();
        database
            .connection
            .execute_batch(
                "DROP TABLE mistake_practice_questions;
             ALTER TABLE sessions DROP COLUMN is_mistake_practice;
             PRAGMA user_version = 16;",
            )
            .unwrap();
        super::super::schema::migrate(&database.connection).unwrap();
        let metadata = database.session_metadata(session_id).unwrap().unwrap();
        assert!(!metadata.is_mistake_practice);
        assert!(database
            .mistake_practice_questions(session_id)
            .unwrap()
            .is_empty());
    }
}
