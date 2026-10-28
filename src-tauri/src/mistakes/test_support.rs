use super::domain::lesson::{Lesson, LessonBatchRequest, RawLessonBatch, WordRange};
use super::domain::rules::RuleKey;
use super::error::LessonProviderError;
use super::ports::{Clock, LessonKick, LessonProvider, MistakesNotifier};
use crate::conversation::SessionStore;
use serde_json::{json, Value};
use std::sync::atomic::{AtomicI64, AtomicUsize, Ordering};
use std::sync::Mutex;

pub const NOW: i64 = 1_791_460_800_000;

pub struct FixedClock(pub AtomicI64);

impl FixedClock {
    pub fn at(now_ms: i64) -> Self {
        Self(AtomicI64::new(now_ms))
    }
}

impl Clock for FixedClock {
    fn now_ms(&self) -> i64 {
        self.0.load(Ordering::SeqCst)
    }
}

#[derive(Default)]
pub struct CountingNotifier(pub Mutex<Vec<usize>>);

impl MistakesNotifier for CountingNotifier {
    fn updated(&self, lessons_ready: usize) {
        if let Ok(mut events) = self.0.lock() {
            events.push(lessons_ready);
        }
    }
}

#[derive(Default)]
pub struct CountingKick(pub AtomicUsize);

impl LessonKick for CountingKick {
    fn kick(&self) {
        self.0.fetch_add(1, Ordering::SeqCst);
    }
}

pub type Reply = Result<RawLessonBatch, LessonProviderError>;

#[derive(Default)]
pub struct ScriptedProvider {
    replies: Mutex<Vec<Reply>>,
    pub requests: Mutex<Vec<LessonBatchRequest>>,
}

impl ScriptedProvider {
    pub fn with(replies: Vec<Reply>) -> Self {
        Self {
            replies: Mutex::new(replies),
            requests: Mutex::default(),
        }
    }

    pub fn call_count(&self) -> usize {
        self.requests.lock().map_or(0, |requests| requests.len())
    }
}

impl LessonProvider for ScriptedProvider {
    fn prepare(&self, request: &LessonBatchRequest) -> Reply {
        if let Ok(mut requests) = self.requests.lock() {
            requests.push(request.clone());
        }
        let mut replies = self
            .replies
            .lock()
            .map_err(|_| LessonProviderError::Failed)?;
        if replies.is_empty() {
            return Err(LessonProviderError::Failed);
        }
        replies.remove(0)
    }
}

pub fn lesson_json(mistake_id: u64, rule: &str, gaps: Value) -> Value {
    json!({
        "mistake_id": mistake_id,
        "rule_key": rule,
        "explanation": "Short reason why.",
        "contrast": [
            {"label": "Before", "sentence": "One side."},
            {"label": "Now", "sentence": "The other side."}
        ],
        "examples": ["First example.", "Second example."],
        "gaps": gaps,
        "accepted": [],
        "situations": ["What did you do?", "Where have you been?"]
    })
}

pub fn card_json(rule: &str) -> Value {
    json!({
        "rule_key": rule,
        "body": "The rule in a few words.",
        "examples": ["An example.", "Another example."]
    })
}

pub fn ready_lesson(rule: RuleKey) -> Lesson {
    Lesson {
        rule_key: rule,
        explanation: "Because.".into(),
        contrast: vec![],
        examples: vec![],
        word: None,
        gaps: vec![WordRange { start: 0, end: 1 }],
        accepted: vec![],
        situations: vec![],
    }
}

pub struct Seeded {
    pub session_id: i64,
    pub next_sequence: i64,
}

pub fn seed_session(sessions: &SessionStore, opening: &str) -> Seeded {
    let session_id = sessions.with_connection(|connection| {
        connection
            .execute(
                "INSERT INTO sessions (mode, scenario, started_at, ended_at, opening_question)
                 VALUES ('conversation', 'free', ?1, ?1, ?2)",
                rusqlite::params![NOW, opening],
            )
            .map(|_| connection.last_insert_rowid())
    });
    Seeded {
        session_id: session_id.unwrap_or(0),
        next_sequence: 1,
    }
}

pub fn add_turn(
    sessions: &SessionStore,
    seeded: &mut Seeded,
    said: &str,
    eva_question: &str,
) -> i64 {
    let sequence = seeded.next_sequence;
    let session_id = seeded.session_id;
    seeded.next_sequence += 1;
    let inserted = sessions.with_connection(|connection| {
        connection.execute(
            "INSERT INTO turns (session_id, sequence, user_transcript, assistant_reply, assistant_question, created_at)
             VALUES (?1, ?2, ?3, 'Reply.', ?4, ?5)",
            rusqlite::params![session_id, sequence, said, eva_question, NOW],
        )
    });
    assert!(inserted.is_ok());
    sequence
}

pub fn add_mistake(
    sessions: &SessionStore,
    seeded: &mut Seeded,
    said: &str,
    corrected: &str,
    eva_question: &str,
) -> u64 {
    let sequence = add_turn(sessions, seeded, said, eva_question);
    let session_id = seeded.session_id;
    let id =
        sessions.with_connection(|connection| {
            connection.execute(
            "INSERT INTO mistakes (normalized_key, category, original_example, corrected_example,
                                   explanation, last_seen_at, next_review_at)
             VALUES (?1, 'grammar', ?2, ?3, 'Because.', ?4, ?4)",
            rusqlite::params![format!("grammar:{corrected}"), said, corrected, NOW + sequence],
        )?;
            let id = connection.last_insert_rowid();
            connection.execute(
                "INSERT INTO mistake_occurrences (mistake_id, session_id, sequence, created_at)
             VALUES (?1, ?2, ?3, ?4)",
                rusqlite::params![id, session_id, sequence, NOW + sequence],
            )?;
            Ok::<i64, rusqlite::Error>(id)
        });
    u64::try_from(id.unwrap_or(0)).unwrap_or(0)
}

pub fn single<T: rusqlite::types::FromSql>(sessions: &SessionStore, sql: &str, id: u64) -> T {
    sessions
        .with_connection(|connection| {
            connection.query_row(sql, [i64::try_from(id).unwrap_or(0)], |row| row.get(0))
        })
        .unwrap_or_else(|error| panic!("{sql}: {error}"))
}
