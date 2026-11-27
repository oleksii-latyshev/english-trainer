use super::*;
use crate::learning::focus_rule::pick_focus_rule;
use crate::providers::LearningPromptTarget;

const MAX_TARGET_CHARS: usize = 160;

/// What Eva steers toward on a turn. A rule is not a saved learning item: the usage review never
/// assesses it, so it has its own kind instead of a `LearningItemType`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SteeringKind {
    Phrase,
    Mistake,
    Rule,
}

impl SteeringKind {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Phrase => "phrase",
            Self::Mistake => "mistake",
            Self::Rule => "rule",
        }
    }
}

/// An item Eva may steer toward, identified so a session never picks it twice. For a rule the id
/// is the latest open mistake of that rule.
pub type TargetKey = (SteeringKind, u64);

const RULE_LOOKBACK_SESSIONS: i64 = 5;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DueLearningTarget {
    pub key: TargetKey,
    pub prompt: LearningPromptTarget,
}

fn bounded(value: String) -> String {
    value.chars().take(MAX_TARGET_CHARS).collect()
}

impl SessionDatabase {
    /// Choose the one item Eva steers toward on this turn: the focus rule of the latest earlier
    /// session when `prefer_rule` is set, else the oldest due taken phrase from an earlier
    /// session, else the oldest due recurring mistake, skipping what was already used. A session
    /// steers toward one rule at most; a rule also fills in when nothing else is due.
    /// These are conversation cues, not evidence that the learner has mastered them.
    pub fn next_learning_target(
        &self,
        current_session_id: u64,
        used: &[TargetKey],
        prefer_rule: bool,
    ) -> rusqlite::Result<Option<DueLearningTarget>> {
        let rule_used = used.iter().any(|(kind, _)| *kind == SteeringKind::Rule);
        if prefer_rule && !rule_used {
            if let Some(rule) = self.rule_target(current_session_id)? {
                return Ok(Some(rule));
            }
        }
        let due = self.due_item_target(current_session_id, used)?;
        if due.is_some() || rule_used {
            return Ok(due);
        }
        self.rule_target(current_session_id)
    }

    /// The Debrief's focus rule of the most recent earlier session that had one whose rule still
    /// has open mistakes.
    fn rule_target(&self, current_session_id: u64) -> rusqlite::Result<Option<DueLearningTarget>> {
        let mut sessions = self.connection.prepare(
            "SELECT DISTINCT session_id FROM mistake_occurrences WHERE session_id < ?1
             ORDER BY session_id DESC LIMIT ?2",
        )?;
        let earlier = sessions
            .query_map(
                params![to_sql_id(current_session_id)?, RULE_LOOKBACK_SESSIONS],
                |row| row.get::<_, i64>(0),
            )?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        for session in earlier {
            let counts = self.session_rule_counts(session as u64)?;
            let Some(rule) = pick_focus_rule(&counts).filter(|rule| rule.open > 0) else {
                continue;
            };
            let latest_open: Option<i64> = self
                .connection
                .query_row(
                    "SELECT id FROM mistakes
                     WHERE rule_key = ?1 AND status != 'archived' AND fixed_at IS NULL
                     ORDER BY id DESC LIMIT 1",
                    [rule.rule_key.as_str()],
                    |row| row.get(0),
                )
                .optional()?;
            if let Some(id) = latest_open {
                return Ok(Some(DueLearningTarget {
                    key: (SteeringKind::Rule, id as u64),
                    prompt: LearningPromptTarget {
                        kind: "rule".into(),
                        cue: bounded(rule.title),
                        target: bounded(rule.summary),
                    },
                }));
            }
        }
        Ok(None)
    }

    fn due_item_target(
        &self,
        current_session_id: u64,
        used: &[TargetKey],
    ) -> rusqlite::Result<Option<DueLearningTarget>> {
        let session_id = to_sql_id(current_session_id)?;
        let now = now_ms();
        let limit = to_sql_id(used.len() as u64 + 1)?;
        let mut phrases = self.connection.prepare(
            "SELECT id, meaning_or_note, phrase FROM phrase_cards
             WHERE status != 'archived' AND next_review_at <= ?1
               AND (session_id IS NULL OR session_id != ?2)
             ORDER BY next_review_at, id LIMIT ?3",
        )?;
        let rows = phrases
            .query_map(params![now, session_id, limit], read_row)?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        let phrase = first_unused(SteeringKind::Phrase, "phrase", used, rows);
        if phrase.is_some() {
            return Ok(phrase);
        }
        let mut mistakes = self.connection.prepare(
            "SELECT id, original_example, corrected_example FROM mistakes m
             WHERE m.status != 'archived' AND m.times_seen >= 2 AND m.next_review_at <= ?1
               AND EXISTS (SELECT 1 FROM mistake_occurrences o
                           WHERE o.mistake_id = m.id AND o.session_id != ?2)
             ORDER BY m.next_review_at, m.id LIMIT ?3",
        )?;
        let rows = mistakes
            .query_map(params![now, session_id, limit], read_row)?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        Ok(first_unused(SteeringKind::Mistake, "mistake", used, rows))
    }
}

fn read_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<(i64, String, String)> {
    Ok((row.get(0)?, row.get(1)?, row.get(2)?))
}

fn first_unused(
    item_type: SteeringKind,
    kind: &str,
    used: &[TargetKey],
    rows: Vec<(i64, String, String)>,
) -> Option<DueLearningTarget> {
    rows.into_iter().find_map(|(id, cue, target)| {
        let key = (item_type, id as u64);
        (!used.contains(&key)).then(|| DueLearningTarget {
            key,
            prompt: LearningPromptTarget {
                kind: kind.into(),
                cue: bounded(cue),
                target: bounded(target),
            },
        })
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::conversation::StoredTurn;
    use crate::mistakes::RuleKey;

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

    fn broken_in(db: &mut SessionDatabase, session: u64, name: &str, rule: &str) -> u64 {
        let id = db.seed_ruled_mistake(name, "fixed", 1, 1, rule).unwrap();
        answer(db, session, id as usize);
        db.connection
            .execute(
                "INSERT INTO mistake_occurrences (mistake_id, session_id, sequence, created_at)
                 VALUES (?1, ?2, ?1, 1)",
                params![id as i64, session as i64],
            )
            .unwrap();
        id
    }

    fn finished_session(db: &mut SessionDatabase) -> u64 {
        let session = db.create_session("Q?").unwrap();
        db.finish_session(session).unwrap();
        session
    }

    fn rule_of(target: Option<DueLearningTarget>) -> DueLearningTarget {
        let target = target.expect("a rule target");
        assert_eq!(target.prompt.kind, "rule");
        target
    }

    #[test]
    fn the_focus_rule_of_the_latest_earlier_session_becomes_the_target() {
        let mut db = SessionDatabase::open_in_memory().unwrap();
        let older = finished_session(&mut db);
        broken_in(&mut db, older, "old", "prepositions");
        let latest = finished_session(&mut db);
        broken_in(&mut db, latest, "a", "articles");
        let newest_open = broken_in(&mut db, latest, "b", "articles");
        let current = db.create_session("Q?").unwrap();

        let target = rule_of(db.next_learning_target(current, &[], true).unwrap());

        assert_eq!(target.key, (SteeringKind::Rule, newest_open));
        assert_eq!(target.prompt.cue, RuleKey::Articles.info().title);
        assert_eq!(target.prompt.target, RuleKey::Articles.info().summary);
    }

    #[test]
    fn a_rule_with_no_open_mistakes_gives_way_to_the_next_session() {
        let mut db = SessionDatabase::open_in_memory().unwrap();
        let older = finished_session(&mut db);
        let open = broken_in(&mut db, older, "old", "prepositions");
        let latest = finished_session(&mut db);
        let fixed = broken_in(&mut db, latest, "a", "articles");
        db.connection
            .execute(
                "UPDATE mistakes SET fixed_at = 5 WHERE id = ?1",
                [fixed as i64],
            )
            .unwrap();
        let current = db.create_session("Q?").unwrap();

        let target = rule_of(db.next_learning_target(current, &[], true).unwrap());

        assert_eq!(target.key, (SteeringKind::Rule, open));
    }

    #[test]
    fn the_current_session_never_supplies_its_own_rule() {
        let mut db = SessionDatabase::open_in_memory().unwrap();
        let current = db.create_session("Q?").unwrap();
        broken_in(&mut db, current, "a", "articles");

        assert!(db
            .next_learning_target(current, &[], true)
            .unwrap()
            .is_none());
    }

    #[test]
    fn a_session_steers_toward_one_rule_at_most() {
        let mut db = SessionDatabase::open_in_memory().unwrap();
        let earlier = finished_session(&mut db);
        let id = broken_in(&mut db, earlier, "a", "articles");
        let current = db.create_session("Q?").unwrap();

        let used = [(SteeringKind::Rule, id)];

        assert!(db
            .next_learning_target(current, &used, true)
            .unwrap()
            .is_none());
        assert!(db
            .next_learning_target(current, &used, false)
            .unwrap()
            .is_none());
    }

    #[test]
    fn phrases_stay_first_unless_the_rule_is_preferred() {
        let mut db = SessionDatabase::open_in_memory().unwrap();
        let earlier = finished_session(&mut db);
        broken_in(&mut db, earlier, "a", "articles");
        db.save_phrase_card("take care", "meaning", Some(earlier), Some(1))
            .unwrap();
        db.connection
            .execute("UPDATE phrase_cards SET next_review_at = 0", [])
            .unwrap();
        let current = db.create_session("Q?").unwrap();

        let first = db
            .next_learning_target(current, &[], false)
            .unwrap()
            .unwrap();
        let second = db
            .next_learning_target(current, &[], true)
            .unwrap()
            .unwrap();

        assert_eq!(first.prompt.kind, "phrase");
        assert_eq!(second.prompt.kind, "rule");
    }

    #[test]
    fn a_rule_fills_in_when_no_phrase_or_mistake_is_due() {
        let mut db = SessionDatabase::open_in_memory().unwrap();
        let earlier = finished_session(&mut db);
        broken_in(&mut db, earlier, "a", "articles");
        let current = db.create_session("Q?").unwrap();

        rule_of(db.next_learning_target(current, &[], false).unwrap());
    }

    #[test]
    fn without_any_earlier_rule_nothing_is_targeted() {
        let mut db = SessionDatabase::open_in_memory().unwrap();
        let current = db.create_session("Q?").unwrap();

        assert!(db
            .next_learning_target(current, &[], true)
            .unwrap()
            .is_none());
    }

    #[test]
    fn a_rule_steering_row_is_saved_with_the_turn() {
        let mut db = SessionDatabase::open_in_memory().unwrap();
        let session = db.create_session("Q?").unwrap();
        db.save_turn_with_steering(
            session,
            1,
            &StoredTurn {
                learner: "text".into(),
                assistant_reply: "Reply".into(),
                assistant_question: "Next?".into(),
                answered_by: None,
            },
            "voice",
            (None, None),
            Some((SteeringKind::Rule, 9)),
        )
        .unwrap();

        let saved: (String, i64) = db
            .connection
            .query_row("SELECT item_type, item_id FROM turn_steering", [], |row| {
                Ok((row.get(0)?, row.get(1)?))
            })
            .unwrap();

        assert_eq!(saved, ("rule".to_owned(), 9));
    }
}
