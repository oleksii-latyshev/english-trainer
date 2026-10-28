use super::lesson_queue::LessonQueue;
use super::lesson_worker::LessonWorker;
use crate::conversation::SessionStore;
use crate::mistakes::domain::lesson::RawLessonBatch;
use crate::mistakes::error::LessonProviderError;
use crate::mistakes::infra::SessionMistakeStore;
use crate::mistakes::test_support::*;
use serde_json::json;
use std::sync::Arc;
use std::time::{Duration, Instant};

fn wait_until(mut done: impl FnMut() -> bool) -> bool {
    let deadline = Instant::now() + Duration::from_secs(5);
    while Instant::now() < deadline {
        if done() {
            return true;
        }
        std::thread::sleep(Duration::from_millis(10));
    }
    false
}

fn start(
    sessions: &SessionStore,
    replies: Vec<Reply>,
    pause: Duration,
) -> (LessonQueue, Arc<ScriptedProvider>) {
    let provider = Arc::new(ScriptedProvider::with(replies));
    let worker = LessonWorker::new(
        Arc::new(SessionMistakeStore::new(sessions.clone())),
        provider.clone(),
        Arc::new(CountingNotifier::default()),
        Arc::new(FixedClock::at(NOW)),
    );
    (LessonQueue::start(worker, pause).unwrap(), provider)
}

fn ready(id: u64) -> Reply {
    Ok(RawLessonBatch {
        lessons: vec![lesson_json(id, "articles", json!([{"start": 1, "end": 2}]))],
        rule_cards: vec![],
    })
}

fn state(sessions: &SessionStore, id: u64) -> Option<String> {
    sessions
        .with_connection(|connection| {
            connection.query_row(
                "SELECT state FROM mistake_lessons WHERE mistake_id = ?1",
                [id as i64],
                |row| row.get(0),
            )
        })
        .ok()
}

#[test]
fn the_worker_prepares_waiting_mistakes_at_start_and_after_a_kick() {
    let sessions = SessionStore::default();
    let mut seeded = seed_session(&sessions, "Q?");
    let first = add_mistake(&sessions, &mut seeded, "I has a job", "I have a job", "Q?");
    let (queue, _) = start(&sessions, vec![ready(1), ready(2)], Duration::from_secs(60));

    assert!(wait_until(
        || state(&sessions, first).as_deref() == Some("ready")
    ));

    let second = add_mistake(&sessions, &mut seeded, "I has a car", "I have a car", "Q?");
    assert_eq!(state(&sessions, second), None);
    queue.kicker().kick();
    assert!(wait_until(
        || state(&sessions, second).as_deref() == Some("ready")
    ));
}

#[test]
fn a_quota_error_pauses_the_worker_even_when_kicked() {
    let sessions = SessionStore::default();
    let mut seeded = seed_session(&sessions, "Q?");
    let id = add_mistake(&sessions, &mut seeded, "I has a job", "I have a job", "Q?");
    let (queue, provider) = start(
        &sessions,
        vec![Err(LessonProviderError::QuotaExhausted), ready(1)],
        Duration::from_secs(3600),
    );

    assert!(wait_until(|| provider.call_count() == 1));
    queue.kicker().kick();
    std::thread::sleep(Duration::from_millis(150));

    assert_eq!(provider.call_count(), 1);
    assert_eq!(state(&sessions, id), None);
}

#[test]
fn the_worker_retries_after_the_quota_pause_ends() {
    let sessions = SessionStore::default();
    let mut seeded = seed_session(&sessions, "Q?");
    let id = add_mistake(&sessions, &mut seeded, "I has a job", "I have a job", "Q?");
    let (_queue, provider) = start(
        &sessions,
        vec![Err(LessonProviderError::QuotaExhausted), ready(1)],
        Duration::from_millis(100),
    );
    assert!(wait_until(
        || state(&sessions, id).as_deref() == Some("ready")
    ));
    assert_eq!(provider.call_count(), 2);
}

#[test]
fn dropping_the_queue_stops_the_worker() {
    let sessions = SessionStore::default();
    let (queue, provider) = start(&sessions, vec![], Duration::from_secs(60));
    let kicker = queue.kicker();
    drop(queue);
    let mut seeded = seed_session(&sessions, "Q?");
    add_mistake(&sessions, &mut seeded, "I has a job", "I have a job", "Q?");
    kicker.kick();
    std::thread::sleep(Duration::from_millis(150));
    assert_eq!(provider.call_count(), 0);
}
