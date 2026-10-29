use super::sqlite_store::{
    from_json, json, latest_occurrence, question_for, sql_id, to_id, SessionMistakeStore,
};
use crate::mistakes::domain::ladder::{Progress, ScheduleUpdate};
use crate::mistakes::domain::lesson::WordRange;
use crate::mistakes::domain::practice::{
    AttemptOutcome, AttemptRecord, Candidate, CandidateLesson, CheckedBy, InputKind, RunItem,
    RunKind, RunRecord,
};
use crate::mistakes::domain::rules::RuleKey;
use crate::mistakes::error::MistakesError;
use crate::mistakes::ports::{NewAttempt, PracticeStore, RunPlanner, RunTarget};
use rusqlite::types::Value;
use rusqlite::{params, params_from_iter, Connection, OptionalExtension};

const CANDIDATES: &str = "SELECT m.id, m.rule_key, m.ladder_step, m.next_review_at,
        m.original_example, m.corrected_example, m.explanation,
        l.state, l.explanation, l.gaps_json, l.accepted_json, l.situations_json,
        (SELECT COUNT(*) FROM mistakes p WHERE p.rule_key = m.rule_key AND p.status != 'archived'),
        (SELECT COUNT(*) FROM mistake_attempts a
          WHERE a.mistake_id = m.id AND a.step = 4 AND a.outcome IN ('pass', 'miss'))
     FROM mistakes m LEFT JOIN mistake_lessons l ON l.mistake_id = m.id
     WHERE m.status != 'archived' AND ";

fn read_candidates(
    connection: &Connection,
    target: RunTarget,
    now_ms: i64,
) -> rusqlite::Result<Vec<Candidate>> {
    let (filter, args): (&str, Vec<Value>) = match target {
        RunTarget::Due => (
            "m.fixed_at IS NULL AND m.next_review_at <= ?1",
            vec![Value::Integer(now_ms)],
        ),
        RunTarget::One(id) => ("m.id = ?1", vec![Value::Integer(sql_id(id))]),
        RunTarget::Rule(rule) => (
            "m.fixed_at IS NULL AND m.rule_key = ?1",
            vec![Value::Text(rule.as_str().to_string())],
        ),
    };
    let mut statement = connection.prepare(&format!("{CANDIDATES}{filter}"))?;
    let rows = statement.query_map(params_from_iter(args), |row| {
        Ok((
            row.get::<_, i64>(0)?,
            row.get::<_, Option<String>>(1)?,
            row.get::<_, i64>(2)?,
            row.get::<_, i64>(3)?,
            row.get::<_, String>(4)?,
            row.get::<_, String>(5)?,
            row.get::<_, String>(6)?,
            row.get::<_, Option<String>>(7)?,
            row.get::<_, Option<String>>(8)?,
            row.get::<_, Option<String>>(9)?,
            row.get::<_, Option<String>>(10)?,
            row.get::<_, Option<String>>(11)?,
            row.get::<_, i64>(12)?,
            row.get::<_, i64>(13)?,
        ))
    })?;
    let raw: Vec<_> = rows.collect::<Result<_, _>>()?;
    raw.into_iter()
        .map(|row| {
            let (
                id,
                rule,
                step,
                next_review_at,
                said,
                corrected,
                review_explanation,
                state,
                explanation,
                gaps,
                accepted,
                situations,
                rule_count,
                step4_attempts,
            ) = row;
            let rule_key = rule.as_deref().and_then(RuleKey::parse);
            let question = match latest_occurrence(connection, id)? {
                Some(occurrence) => question_for(connection, &occurrence)?,
                None => String::new(),
            };
            let lesson = (state.as_deref() == Some("ready")).then(|| CandidateLesson {
                explanation: explanation.unwrap_or_default(),
                gaps: from_json::<Vec<WordRange>>(&gaps.unwrap_or_default()),
                accepted: from_json(&accepted.unwrap_or_default()),
                situations: from_json(&situations.unwrap_or_default()),
            });
            Ok(Candidate {
                mistake_id: to_id(id),
                rule_key,
                rule_count: if rule_key.is_some_and(RuleKey::counts_as_back_again) {
                    u32::try_from(rule_count).unwrap_or(0)
                } else {
                    0
                },
                ladder_step: u8::try_from(step).unwrap_or(1),
                next_review_at,
                question,
                said,
                corrected,
                review_explanation,
                lesson,
                step4_attempts: u32::try_from(step4_attempts).unwrap_or(0),
            })
        })
        .collect()
}

fn read_attempts(connection: &Connection, run_id: i64) -> rusqlite::Result<Vec<AttemptRecord>> {
    let mut statement = connection.prepare(
        "SELECT id, mistake_id, run_id, step, input, answer, outcome, checked_by, note, created_at
         FROM mistake_attempts WHERE run_id = ?1 ORDER BY id",
    )?;
    let rows = statement.query_map([run_id], attempt_of)?;
    rows.collect()
}

fn attempt_of(row: &rusqlite::Row<'_>) -> rusqlite::Result<AttemptRecord> {
    let input: String = row.get(4)?;
    let outcome: String = row.get(6)?;
    let checked_by: String = row.get(7)?;
    Ok(AttemptRecord {
        id: to_id(row.get(0)?),
        mistake_id: to_id(row.get(1)?),
        run_id: to_id(row.get(2)?),
        step: u8::try_from(row.get::<_, i64>(3)?).unwrap_or(1),
        input: InputKind::parse(&input).unwrap_or(InputKind::Typed),
        answer: row.get(5)?,
        outcome: AttemptOutcome::parse(&outcome).unwrap_or(AttemptOutcome::Miss),
        checked_by: CheckedBy::parse(&checked_by).unwrap_or(CheckedBy::Local),
        note: row.get(8)?,
        created_at: row.get(9)?,
    })
}

fn read_run(connection: &Connection, run_id: u64) -> rusqlite::Result<Option<RunRecord>> {
    let sql = sql_id(run_id);
    let row = connection
        .query_row(
            "SELECT kind, rule_key, items_json, created_at, finished_at
             FROM mistake_runs WHERE id = ?1",
            [sql],
            |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, Option<String>>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, i64>(3)?,
                    row.get::<_, Option<i64>>(4)?,
                ))
            },
        )
        .optional()?;
    let Some((kind, rule, items, created_at, finished_at)) = row else {
        return Ok(None);
    };
    Ok(Some(RunRecord {
        id: run_id,
        kind: RunKind::parse(&kind).unwrap_or(RunKind::Due),
        rule_key: rule.as_deref().and_then(RuleKey::parse),
        items: from_json::<Vec<RunItem>>(&items),
        attempts: read_attempts(connection, sql)?,
        created_at,
        finished_at,
    }))
}

fn open_run_id(connection: &Connection) -> rusqlite::Result<Option<i64>> {
    connection
        .query_row(
            "SELECT id FROM mistake_runs WHERE finished_at IS NULL ORDER BY id DESC LIMIT 1",
            [],
            |row| row.get(0),
        )
        .optional()
}

fn start(
    connection: &mut Connection,
    target: RunTarget,
    now_ms: i64,
    plan: RunPlanner<'_>,
) -> rusqlite::Result<Option<RunRecord>> {
    let transaction = connection.transaction()?;
    if let Some(open) = open_run_id(&transaction)? {
        return read_run(&transaction, to_id(open));
    }
    let items = plan(read_candidates(&transaction, target, now_ms)?);
    if items.is_empty() {
        return Ok(None);
    }
    let rule = match target {
        RunTarget::Rule(rule) => Some(rule.as_str()),
        _ => None,
    };
    transaction.execute(
        "INSERT INTO mistake_runs (kind, rule_key, items_json, created_at) VALUES (?1, ?2, ?3, ?4)",
        params![target.kind().as_str(), rule, json(&items)?, now_ms],
    )?;
    let id = to_id(transaction.last_insert_rowid());
    let run = read_run(&transaction, id)?;
    transaction.commit()?;
    Ok(run)
}

fn apply(
    connection: &Connection,
    mistake_id: u64,
    update: &ScheduleUpdate,
) -> rusqlite::Result<()> {
    connection.execute(
        "UPDATE mistakes SET ladder_step = ?2, next_review_at = ?3, step4_pass_days = ?4,
                fixed_at = COALESCE(fixed_at, ?5)
         WHERE id = ?1",
        params![
            sql_id(mistake_id),
            i64::from(update.ladder_step),
            update.next_review_at,
            i64::from(update.step4_pass_days),
            update.fixed_at
        ],
    )?;
    Ok(())
}

impl PracticeStore for SessionMistakeStore {
    fn start_run(
        &self,
        target: RunTarget,
        now_ms: i64,
        plan: RunPlanner<'_>,
    ) -> Result<Option<RunRecord>, MistakesError> {
        self.run("start", |connection| {
            start(connection, target, now_ms, plan)
        })
    }

    fn run(&self, run_id: u64) -> Result<Option<RunRecord>, MistakesError> {
        SessionMistakeStore::run(self, "read", |connection| read_run(connection, run_id))
    }

    fn progress(&self, mistake_id: u64) -> Result<Option<Progress>, MistakesError> {
        self.run("read", |connection| {
            let row = connection
                .query_row(
                    "SELECT ladder_step, step4_pass_days, fixed_at,
                            (SELECT MAX(created_at) FROM mistake_attempts
                              WHERE mistake_id = ?1 AND step = 4 AND outcome = 'pass')
                     FROM mistakes WHERE id = ?1 AND status != 'archived'",
                    [sql_id(mistake_id)],
                    |row| {
                        Ok(Progress {
                            ladder_step: u8::try_from(row.get::<_, i64>(0)?).unwrap_or(1),
                            step4_pass_days: u8::try_from(row.get::<_, i64>(1)?).unwrap_or(0),
                            fixed_at: row.get(2)?,
                            last_step4_pass_ms: row.get(3)?,
                        })
                    },
                )
                .optional()?;
            Ok(row)
        })
    }

    fn record(
        &self,
        attempt: &NewAttempt,
        update: Option<(u64, ScheduleUpdate)>,
    ) -> Result<u64, MistakesError> {
        self.run("save", |connection| {
            let transaction = connection.transaction()?;
            transaction.execute(
                "INSERT INTO mistake_attempts (mistake_id, run_id, step, input, answer, outcome,
                                               checked_by, note, created_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
                params![
                    sql_id(attempt.mistake_id),
                    sql_id(attempt.run_id),
                    i64::from(attempt.step),
                    attempt.input.as_str(),
                    attempt.answer,
                    attempt.outcome.as_str(),
                    attempt.checked_by.as_str(),
                    attempt.note,
                    attempt.created_at
                ],
            )?;
            let id = to_id(transaction.last_insert_rowid());
            if let Some((mistake_id, update)) = update {
                apply(&transaction, mistake_id, &update)?;
            }
            transaction.commit()?;
            Ok(id)
        })
    }

    fn attempt(&self, attempt_id: u64) -> Result<Option<AttemptRecord>, MistakesError> {
        self.run("read", |connection| {
            connection
                .query_row(
                    "SELECT id, mistake_id, run_id, step, input, answer, outcome, checked_by, note, created_at
                     FROM mistake_attempts WHERE id = ?1",
                    [sql_id(attempt_id)],
                    attempt_of,
                )
                .optional()
        })
    }

    fn begin_check(&self, attempt_id: u64) -> Result<bool, MistakesError> {
        self.run("update", |connection| {
            let changed = connection.execute(
                "UPDATE mistake_attempts SET outcome = 'checking', checked_by = 'ai'
                 WHERE id = ?1 AND outcome = 'miss' AND checked_by = 'local' AND step = 2
                   AND NOT EXISTS (
                       SELECT 1 FROM mistake_attempts r
                       WHERE r.run_id = mistake_attempts.run_id
                         AND r.mistake_id = mistake_attempts.mistake_id AND r.outcome = 'retry')",
                [sql_id(attempt_id)],
            )?;
            Ok(changed > 0)
        })
    }

    fn resolve(
        &self,
        attempt_id: u64,
        outcome: AttemptOutcome,
        note: &str,
        update: Option<(u64, ScheduleUpdate)>,
    ) -> Result<bool, MistakesError> {
        self.run("save", |connection| {
            let transaction = connection.transaction()?;
            let changed = transaction.execute(
                "UPDATE mistake_attempts SET outcome = ?2, note = ?3, checked_by = 'ai'
                 WHERE id = ?1 AND outcome = 'checking'",
                params![sql_id(attempt_id), outcome.as_str(), note],
            )?;
            if changed == 0 {
                return Ok(false);
            }
            if let Some((mistake_id, update)) = update {
                apply(&transaction, mistake_id, &update)?;
            }
            transaction.commit()?;
            Ok(true)
        })
    }

    fn finish_run(&self, run_id: u64, now_ms: i64) -> Result<bool, MistakesError> {
        self.run("update", |connection| {
            connection.execute(
                "UPDATE mistake_runs SET finished_at = ?2 WHERE id = ?1 AND finished_at IS NULL",
                params![sql_id(run_id), now_ms],
            )?;
            connection.query_row(
                "SELECT EXISTS(SELECT 1 FROM mistake_runs WHERE id = ?1)",
                [sql_id(run_id)],
                |row| row.get(0),
            )
        })
    }

    fn utc_offset_ms(&self, at_ms: i64) -> Result<i64, MistakesError> {
        self.run("read", |connection| {
            let seconds = at_ms.div_euclid(1000);
            let local: i64 = connection.query_row(
                "SELECT CAST(strftime('%s', ?1, 'unixepoch', 'localtime') AS INTEGER)",
                [seconds],
                |row| row.get(0),
            )?;
            Ok((local - seconds) * 1000)
        })
    }
}
