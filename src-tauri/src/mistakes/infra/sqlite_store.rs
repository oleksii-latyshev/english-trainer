use crate::conversation::SessionStore;
use crate::mistakes::domain::lesson::{Lesson, LessonRequest, RuleCardContent};
use crate::mistakes::domain::rules::{RuleKey, RULES};
use crate::mistakes::domain::view::{
    LessonState, LessonView, MistakeDetail, MistakeGroup, MistakeGroups, MistakeRule,
    MistakeSummary, RuleCardView,
};
use crate::mistakes::error::MistakesError;
use crate::mistakes::ports::{LessonOutcome, LessonStore, MistakeStore, SavedOutcome};
use rusqlite::{params, Connection, OptionalExtension};
use std::collections::BTreeMap;

const MAX_FAILURES_SQL: i64 = crate::mistakes::domain::lesson::MAX_FAILURES as i64;

#[derive(Clone)]
pub struct SessionMistakeStore {
    sessions: SessionStore,
}

impl SessionMistakeStore {
    pub fn new(sessions: SessionStore) -> Self {
        Self { sessions }
    }

    pub(super) fn run<T>(
        &self,
        operation: &'static str,
        work: impl FnOnce(&mut Connection) -> rusqlite::Result<T>,
    ) -> Result<T, MistakesError> {
        self.sessions
            .with_connection(work)
            .map_err(MistakesError::storage(operation))
    }
}

pub(super) fn sql_id(id: u64) -> i64 {
    i64::try_from(id).unwrap_or(i64::MAX)
}

pub(super) fn to_id(value: i64) -> u64 {
    u64::try_from(value).unwrap_or(0)
}

pub(super) fn json<T: serde::Serialize>(value: &T) -> rusqlite::Result<String> {
    serde_json::to_string(value)
        .map_err(|error| rusqlite::Error::ToSqlConversionFailure(Box::new(error)))
}

pub(super) fn from_json<T: serde::de::DeserializeOwned + Default>(text: &str) -> T {
    serde_json::from_str(text).unwrap_or_default()
}

pub(super) struct Occurrence {
    pub(super) session_id: i64,
    pub(super) sequence: i64,
}

pub(super) fn latest_occurrence(
    connection: &Connection,
    mistake_id: i64,
) -> rusqlite::Result<Option<Occurrence>> {
    connection
        .query_row(
            "SELECT session_id, sequence FROM mistake_occurrences
             WHERE mistake_id = ?1 ORDER BY created_at DESC, id DESC LIMIT 1",
            [mistake_id],
            |row| {
                Ok(Occurrence {
                    session_id: row.get(0)?,
                    sequence: row.get(1)?,
                })
            },
        )
        .optional()
}

pub(super) fn question_for(
    connection: &Connection,
    occurrence: &Occurrence,
) -> rusqlite::Result<String> {
    let Some((opening, mode, written)) = connection
        .query_row(
            "SELECT opening_question, COALESCE(practice_mode, 'voice'), COALESCE(written_turn_count, 0)
             FROM sessions WHERE id = ?1",
            [occurrence.session_id],
            |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?, row.get::<_, i64>(2)?)),
        )
        .optional()?
    else {
        return Ok(String::new());
    };
    let prompt_sequence = if mode == "write_then_speak" && occurrence.sequence > written {
        occurrence.sequence - written - 1
    } else {
        occurrence.sequence - 1
    };
    if prompt_sequence <= 0 {
        return Ok(opening);
    }
    let prompt: Option<String> = connection
        .query_row(
            "SELECT CASE WHEN assistant_question = '' THEN assistant_reply ELSE assistant_question END
             FROM turns WHERE session_id = ?1 AND sequence = ?2",
            params![occurrence.session_id, prompt_sequence],
            |row| row.get(0),
        )
        .optional()?;
    Ok(prompt.unwrap_or(opening))
}

fn read_pending(connection: &Connection, limit: usize) -> rusqlite::Result<Vec<LessonRequest>> {
    let mut statement = connection.prepare(
        "SELECT m.id, m.original_example, m.corrected_example, m.explanation
         FROM mistakes m LEFT JOIN mistake_lessons l ON l.mistake_id = m.id
         WHERE m.status != 'archived'
           AND (l.mistake_id IS NULL OR (l.state = 'pending' AND l.failures < ?2))
         ORDER BY m.id DESC LIMIT ?1",
    )?;
    let rows: Vec<(i64, String, String, String)> = statement
        .query_map(
            params![i64::try_from(limit).unwrap_or(i64::MAX), MAX_FAILURES_SQL],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
        )?
        .collect::<Result<_, _>>()?;
    rows.into_iter()
        .map(|(id, said, corrected, review_explanation)| {
            let question = match latest_occurrence(connection, id)? {
                Some(occurrence) => question_for(connection, &occurrence)?,
                None => String::new(),
            };
            Ok(LessonRequest {
                mistake_id: to_id(id),
                question,
                said,
                corrected,
                review_explanation,
            })
        })
        .collect()
}

fn read_missing_card_keys(connection: &Connection) -> rusqlite::Result<Vec<RuleKey>> {
    let mut statement = connection.prepare("SELECT rule_key FROM rule_cards")?;
    let have: Vec<String> = statement
        .query_map([], |row| row.get(0))?
        .collect::<Result<_, _>>()?;
    Ok(RULES
        .iter()
        .map(|info| info.key)
        .filter(|key| key.counts_as_back_again() && !have.iter().any(|kept| kept == key.as_str()))
        .collect())
}

fn save_card(connection: &Connection, card: &RuleCardContent) -> rusqlite::Result<()> {
    let info = card.rule_key.info();
    connection.execute(
        "INSERT OR IGNORE INTO rule_cards (rule_key, title, summary, body, examples_json)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        params![
            card.rule_key.as_str(),
            info.title,
            info.summary,
            card.body,
            json(&card.examples)?
        ],
    )?;
    Ok(())
}

fn save_lesson(
    connection: &Connection,
    mistake_id: u64,
    lesson: &Lesson,
    now_ms: i64,
) -> rusqlite::Result<bool> {
    let id = sql_id(mistake_id);
    let tagged = connection.execute(
        "UPDATE mistakes SET rule_key = ?2 WHERE id = ?1",
        params![id, lesson.rule_key.as_str()],
    )?;
    if tagged == 0 {
        return Ok(false);
    }
    let word = lesson.word.as_ref().map(json).transpose()?;
    connection.execute(
        "INSERT INTO mistake_lessons (mistake_id, state, explanation, contrast_json, examples_json,
                                      word_json, gaps_json, accepted_json, situations_json,
                                      failures, updated_at)
         VALUES (?1, 'ready', ?2, ?3, ?4, ?5, ?6, ?7, ?8, 0, ?9)
         ON CONFLICT(mistake_id) DO UPDATE SET state = 'ready', explanation = excluded.explanation,
            contrast_json = excluded.contrast_json, examples_json = excluded.examples_json,
            word_json = excluded.word_json, gaps_json = excluded.gaps_json,
            accepted_json = excluded.accepted_json, situations_json = excluded.situations_json,
            failures = 0, updated_at = excluded.updated_at",
        params![
            id,
            lesson.explanation,
            json(&lesson.contrast)?,
            json(&lesson.examples)?,
            word,
            json(&lesson.gaps)?,
            json(&lesson.accepted)?,
            json(&lesson.situations)?,
            now_ms
        ],
    )?;
    Ok(true)
}

fn record_relapses(connection: &Connection, rule: RuleKey, now_ms: i64) -> rusqlite::Result<bool> {
    if !rule.counts_as_back_again() {
        return Ok(false);
    }
    let inserted = connection.execute(
        "INSERT OR IGNORE INTO rule_relapses (rule_key, session_id, sequence, created_at)
         SELECT ?1, o.session_id, o.sequence, o.created_at
         FROM mistakes m
         JOIN mistake_occurrences o ON o.id = (
             SELECT id FROM mistake_occurrences WHERE mistake_id = m.id
             ORDER BY created_at DESC, id DESC LIMIT 1)
         WHERE m.rule_key = ?1 AND m.status != 'archived'
           AND EXISTS (
               SELECT 1 FROM mistakes peer
               JOIN mistake_occurrences earlier ON earlier.mistake_id = peer.id
               WHERE peer.rule_key = ?1 AND peer.id != m.id AND peer.status != 'archived'
                 AND earlier.created_at < o.created_at)",
        params![rule.as_str()],
    )?;
    if inserted == 0 {
        return Ok(false);
    }
    connection.execute(
        "UPDATE mistakes SET ladder_step = 1, step4_pass_days = 0, next_review_at = ?2
         WHERE rule_key = ?1 AND status != 'archived' AND fixed_at IS NULL",
        params![rule.as_str(), now_ms],
    )?;
    Ok(true)
}

fn count_failure(connection: &Connection, mistake_id: u64, now_ms: i64) -> rusqlite::Result<()> {
    connection.execute(
        "INSERT INTO mistake_lessons (mistake_id, state, failures, updated_at)
         SELECT ?1, CASE WHEN 1 >= ?3 THEN 'failed' ELSE 'pending' END, 1, ?2
         WHERE EXISTS (SELECT 1 FROM mistakes WHERE id = ?1)
         ON CONFLICT(mistake_id) DO UPDATE SET
            failures = failures + 1,
            state = CASE WHEN failures + 1 >= ?3 THEN 'failed' ELSE state END,
            updated_at = excluded.updated_at
         WHERE state != 'ready'",
        params![sql_id(mistake_id), now_ms, MAX_FAILURES_SQL],
    )?;
    Ok(())
}

fn write_outcome(
    connection: &mut Connection,
    outcome: &LessonOutcome,
    now_ms: i64,
) -> rusqlite::Result<SavedOutcome> {
    let transaction = connection.transaction()?;
    for card in &outcome.cards {
        save_card(&transaction, card)?;
    }
    let mut saved = SavedOutcome::default();
    for (mistake_id, lesson) in &outcome.lessons {
        if save_lesson(&transaction, *mistake_id, lesson, now_ms)? {
            saved.lessons_ready += 1;
            if record_relapses(&transaction, lesson.rule_key, now_ms)? {
                saved.relapses += 1;
            }
        }
    }
    for mistake_id in &outcome.failed {
        count_failure(&transaction, *mistake_id, now_ms)?;
    }
    transaction.commit()?;
    Ok(saved)
}

impl LessonStore for SessionMistakeStore {
    fn pending(&self, limit: usize) -> Result<Vec<LessonRequest>, MistakesError> {
        self.run("read", |connection| read_pending(connection, limit))
    }

    fn missing_card_keys(&self) -> Result<Vec<RuleKey>, MistakesError> {
        self.run("read", |connection| read_missing_card_keys(connection))
    }

    fn save(&self, outcome: &LessonOutcome, now_ms: i64) -> Result<SavedOutcome, MistakesError> {
        self.run("save", |connection| {
            write_outcome(connection, outcome, now_ms)
        })
    }
}

const SUMMARIES: &str = "SELECT m.id, m.original_example, m.corrected_example, m.rule_key,
        m.ladder_step, m.fixed_at, m.next_review_at, m.last_seen_at, l.state
     FROM mistakes m LEFT JOIN mistake_lessons l ON l.mistake_id = m.id
     WHERE m.status != 'archived'
     ORDER BY m.last_seen_at DESC, m.id DESC";

fn read_summaries(connection: &Connection, now_ms: i64) -> rusqlite::Result<Vec<MistakeSummary>> {
    let mut statement = connection.prepare(SUMMARIES)?;
    let rows = statement.query_map([], |row| {
        let fixed_at: Option<i64> = row.get(5)?;
        let next_review_at: i64 = row.get(6)?;
        let rule: Option<String> = row.get(3)?;
        let state: Option<String> = row.get(8)?;
        Ok(MistakeSummary {
            id: to_id(row.get(0)?),
            said: row.get(1)?,
            corrected: row.get(2)?,
            rule_key: rule.as_deref().and_then(RuleKey::parse),
            lesson_state: state
                .as_deref()
                .map_or(LessonState::Pending, LessonState::parse),
            ladder_step: u8::try_from(row.get::<_, i64>(4)?).unwrap_or(1),
            is_fixed: fixed_at.is_some(),
            is_due: fixed_at.is_none() && next_review_at <= now_ms,
            last_seen_at: row.get(7)?,
        })
    })?;
    rows.collect()
}

fn read_relapses(connection: &Connection) -> rusqlite::Result<BTreeMap<String, (u32, i64)>> {
    let mut statement = connection.prepare(
        "SELECT rule_key, COUNT(*), MAX(created_at) FROM rule_relapses GROUP BY rule_key",
    )?;
    let rows = statement.query_map([], |row| {
        Ok((
            row.get::<_, String>(0)?,
            (
                u32::try_from(row.get::<_, i64>(1)?).unwrap_or(0),
                row.get(2)?,
            ),
        ))
    })?;
    rows.collect()
}

fn read_groups(connection: &Connection, now_ms: i64) -> rusqlite::Result<MistakeGroups> {
    let summaries = read_summaries(connection, now_ms)?;
    let relapses = read_relapses(connection)?;
    let due_count = u32::try_from(summaries.iter().filter(|item| item.is_due).count()).unwrap_or(0);
    let mut by_rule: BTreeMap<usize, Vec<MistakeSummary>> = BTreeMap::new();
    let mut ungrouped = Vec::new();
    for summary in summaries {
        let position = summary
            .rule_key
            .filter(|rule| rule.counts_as_back_again())
            .and_then(|rule| RULES.iter().position(|info| info.key == rule));
        match position {
            Some(position) => by_rule.entry(position).or_default().push(summary),
            None => ungrouped.push(summary),
        }
    }
    let mut groups: Vec<(usize, MistakeGroup)> = by_rule
        .into_iter()
        .map(|(position, mistakes)| {
            let info = &RULES[position];
            let (relapse_count, last_relapse_at) = relapses
                .get(info.key.as_str())
                .map_or((0, None), |(count, last)| (*count, Some(*last)));
            let count = |predicate: &dyn Fn(&MistakeSummary) -> bool| {
                u32::try_from(mistakes.iter().filter(|item| predicate(item)).count()).unwrap_or(0)
            };
            let group = MistakeGroup {
                rule_key: info.key,
                title: info.title.to_string(),
                summary: info.summary.to_string(),
                mistake_count: count(&|_| true),
                fixed_count: count(&|item| item.is_fixed),
                due_count: count(&|item| item.is_due),
                relapse_count,
                last_relapse_at,
                mistakes,
            };
            (position, group)
        })
        .collect();
    groups.sort_by(|(left_position, left), (right_position, right)| {
        right
            .relapse_count
            .cmp(&left.relapse_count)
            .then(right.mistake_count.cmp(&left.mistake_count))
            .then(left_position.cmp(right_position))
    });
    Ok(MistakeGroups {
        groups: groups.into_iter().map(|(_, group)| group).collect(),
        ungrouped,
        due_count,
    })
}

fn read_detail(
    connection: &Connection,
    id: u64,
    now_ms: i64,
) -> rusqlite::Result<Option<MistakeDetail>> {
    let sql = sql_id(id);
    let row = connection
        .query_row(
            "SELECT m.original_example, m.corrected_example, m.explanation, m.rule_key,
                    m.ladder_step, m.fixed_at, m.next_review_at, m.last_seen_at,
                    l.state, l.explanation, l.contrast_json, l.examples_json, l.word_json
             FROM mistakes m LEFT JOIN mistake_lessons l ON l.mistake_id = m.id
             WHERE m.id = ?1 AND m.status != 'archived'",
            [sql],
            |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, Option<String>>(3)?,
                    row.get::<_, i64>(4)?,
                    row.get::<_, Option<i64>>(5)?,
                    row.get::<_, i64>(6)?,
                    row.get::<_, i64>(7)?,
                    row.get::<_, Option<String>>(8)?,
                    row.get::<_, Option<String>>(9)?,
                    row.get::<_, Option<String>>(10)?,
                    row.get::<_, Option<String>>(11)?,
                    row.get::<_, Option<String>>(12)?,
                ))
            },
        )
        .optional()?;
    let Some((
        said,
        corrected,
        review_explanation,
        rule,
        step,
        fixed_at,
        next_review_at,
        last_seen_at,
        state,
        explanation,
        contrast,
        examples,
        word,
    )) = row
    else {
        return Ok(None);
    };
    let occurrence = latest_occurrence(connection, sql)?;
    let question = match &occurrence {
        Some(occurrence) => question_for(connection, occurrence)?,
        None => String::new(),
    };
    let state = state
        .as_deref()
        .map_or(LessonState::Pending, LessonState::parse);
    let lesson = (state == LessonState::Ready).then(|| LessonView {
        explanation: explanation.unwrap_or_default(),
        contrast: from_json(&contrast.unwrap_or_default()),
        examples: from_json(&examples.unwrap_or_default()),
        word: word.and_then(|text| serde_json::from_str(&text).ok()),
    });
    let rule = rule
        .as_deref()
        .and_then(RuleKey::parse)
        .map(|rule_key| MistakeRule {
            rule_key,
            title: rule_key.info().title.to_string(),
        });
    Ok(Some(MistakeDetail {
        id,
        question,
        said,
        corrected,
        review_explanation,
        session_id: occurrence.as_ref().map(|item| to_id(item.session_id)),
        sequence: occurrence.as_ref().map(|item| to_id(item.sequence)),
        last_seen_at,
        ladder_step: u8::try_from(step).unwrap_or(1),
        fixed_at,
        next_review_at,
        is_due: fixed_at.is_none() && next_review_at <= now_ms,
        rule,
        lesson_state: state,
        lesson,
    }))
}

fn read_rule_card(connection: &Connection, rule: RuleKey) -> rusqlite::Result<RuleCardView> {
    let stored: Option<(String, String)> = connection
        .query_row(
            "SELECT body, examples_json FROM rule_cards WHERE rule_key = ?1",
            [rule.as_str()],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .optional()?;
    let info = rule.info();
    Ok(RuleCardView {
        rule_key: rule,
        title: info.title.to_string(),
        summary: info.summary.to_string(),
        body: stored.as_ref().map(|(body, _)| body.clone()),
        examples: stored.map_or_else(Vec::new, |(_, examples)| from_json(&examples)),
    })
}

impl MistakeStore for SessionMistakeStore {
    fn groups(&self, now_ms: i64) -> Result<MistakeGroups, MistakesError> {
        self.run("read", |connection| read_groups(connection, now_ms))
    }

    fn mistake(&self, id: u64, now_ms: i64) -> Result<Option<MistakeDetail>, MistakesError> {
        self.run("read", |connection| read_detail(connection, id, now_ms))
    }

    fn rule_card(&self, rule: RuleKey) -> Result<RuleCardView, MistakesError> {
        self.run("read", |connection| read_rule_card(connection, rule))
    }

    fn archive(&self, id: u64) -> Result<bool, MistakesError> {
        self.run("update", |connection| {
            connection.execute(
                "UPDATE mistakes SET status = 'archived' WHERE id = ?1 AND status != 'archived'",
                [sql_id(id)],
            )?;
            connection.query_row(
                "SELECT EXISTS(SELECT 1 FROM mistakes WHERE id = ?1)",
                [sql_id(id)],
                |row| row.get(0),
            )
        })
    }

    fn reset_failed_lesson(&self, id: u64) -> Result<bool, MistakesError> {
        self.run("update", |connection| {
            connection.execute(
                "UPDATE mistake_lessons SET state = 'pending', failures = 0
                 WHERE mistake_id = ?1 AND state = 'failed'",
                [sql_id(id)],
            )?;
            connection.query_row(
                "SELECT EXISTS(SELECT 1 FROM mistakes WHERE id = ?1 AND status != 'archived')",
                [sql_id(id)],
                |row| row.get(0),
            )
        })
    }
}
