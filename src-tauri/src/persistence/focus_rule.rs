use super::{to_sql_id, SessionDatabase};
use crate::learning::focus_rule::RuleCount;
use crate::mistakes::RuleKey;
use rusqlite::params;

impl SessionDatabase {
    /// Per rule, the mistakes recorded in the session, the open ones of that rule overall and
    /// whether the rule was also broken in an earlier session. A mistake whose lesson is not
    /// ready has no rule yet and is left out.
    pub(crate) fn session_rule_counts(&self, session_id: u64) -> rusqlite::Result<Vec<RuleCount>> {
        let mut statement = self.connection.prepare(
            "SELECT m.rule_key, COUNT(*),
                    (SELECT COUNT(*) FROM mistakes open
                     WHERE open.rule_key = m.rule_key AND open.status != 'archived'
                       AND open.fixed_at IS NULL),
                    EXISTS(SELECT 1 FROM mistake_occurrences earlier
                           JOIN mistakes peer ON peer.id = earlier.mistake_id
                           WHERE peer.rule_key = m.rule_key AND peer.status != 'archived'
                             AND earlier.session_id < ?1)
             FROM mistake_occurrences o JOIN mistakes m ON m.id = o.mistake_id
             WHERE o.session_id = ?1 AND m.rule_key IS NOT NULL AND m.status != 'archived'
             GROUP BY m.rule_key
             ORDER BY m.rule_key",
        )?;
        let rows = statement.query_map(params![to_sql_id(session_id)?], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, u32>(1)?,
                row.get::<_, u32>(2)?,
                row.get::<_, bool>(3)?,
            ))
        })?;
        let mut counts = Vec::new();
        for row in rows {
            let (key, in_session, open, came_back) = row?;
            if let Some(rule) = RuleKey::parse(&key) {
                counts.push(RuleCount {
                    rule,
                    in_session,
                    open,
                    came_back,
                });
            }
        }
        Ok(counts)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::conversation::StoredTurn;

    fn answer(db: &mut SessionDatabase, session: u64, sequence: usize) {
        db.save_turn(
            session,
            sequence,
            &StoredTurn {
                learner: "text".into(),
                assistant_reply: "Reply".into(),
                assistant_question: "Next?".into(),
                answered_by: None,
            },
        )
        .unwrap();
    }

    fn occur(db: &SessionDatabase, mistake: u64, session: u64, sequence: usize) {
        db.connection
            .execute(
                "INSERT INTO mistake_occurrences (mistake_id, session_id, sequence, created_at)
                 VALUES (?1, ?2, ?3, 1)",
                params![mistake as i64, session as i64, sequence as i64],
            )
            .unwrap();
    }

    fn mistake(db: &mut SessionDatabase, name: &str, rule: &str) -> u64 {
        db.seed_ruled_mistake(name, "fixed", 1, 1, rule).unwrap()
    }

    #[test]
    fn counts_the_session_per_rule_with_open_mistakes_overall() {
        let mut db = SessionDatabase::open_in_memory().unwrap();
        let session = db.create_session("Q?").unwrap();
        for sequence in 1..=3 {
            answer(&mut db, session, sequence);
        }
        let first = mistake(&mut db, "a", "articles");
        let second = mistake(&mut db, "b", "articles");
        let fixed = mistake(&mut db, "c", "articles");
        let _elsewhere = mistake(&mut db, "d", "articles");
        let other = mistake(&mut db, "e", "prepositions");
        occur(&db, first, session, 1);
        occur(&db, second, session, 2);
        occur(&db, other, session, 3);
        db.connection
            .execute(
                "UPDATE mistakes SET fixed_at = 5 WHERE id = ?1",
                [fixed as i64],
            )
            .unwrap();

        let counts = db.session_rule_counts(session).unwrap();

        assert_eq!(
            counts,
            [
                RuleCount {
                    rule: RuleKey::Articles,
                    in_session: 2,
                    open: 3,
                    came_back: false
                },
                RuleCount {
                    rule: RuleKey::Prepositions,
                    in_session: 1,
                    open: 1,
                    came_back: false
                },
            ]
        );
    }

    #[test]
    fn a_rule_broken_in_an_earlier_session_came_back() {
        let mut db = SessionDatabase::open_in_memory().unwrap();
        let earlier = db.create_session("Q?").unwrap();
        answer(&mut db, earlier, 1);
        db.finish_session(earlier).unwrap();
        let session = db.create_session("Q?").unwrap();
        answer(&mut db, session, 1);
        let old = mistake(&mut db, "old", "articles");
        let new = mistake(&mut db, "new", "articles");
        occur(&db, old, earlier, 1);
        occur(&db, new, session, 1);

        let counts = db.session_rule_counts(session).unwrap();

        assert_eq!(counts.len(), 1);
        assert!(counts[0].came_back);
        assert!(!db.session_rule_counts(earlier).unwrap()[0].came_back);
    }

    #[test]
    fn a_mistake_without_a_lesson_yet_is_skipped() {
        let mut db = SessionDatabase::open_in_memory().unwrap();
        let session = db.create_session("Q?").unwrap();
        answer(&mut db, session, 1);
        let pending = mistake(&mut db, "pending", "articles");
        db.connection
            .execute(
                "UPDATE mistakes SET rule_key = NULL WHERE id = ?1",
                [pending as i64],
            )
            .unwrap();
        occur(&db, pending, session, 1);

        assert!(db.session_rule_counts(session).unwrap().is_empty());
    }
}
