use super::*;
use crate::conversation::WrapupPreparation;
use crate::providers::{ConversationTurn, GeneratedWrapupPhrase, ProviderErrorCode};
use std::sync::mpsc;
use std::time::Duration;

const WAIT: Duration = Duration::from_secs(5);

fn finish_answer(store: &SessionStore) -> u64 {
    let id = store.start().unwrap().session_id;
    store
        .send_turn(id, "I share progress early".into(), |_| {
            Ok(ConversationTurn {
                spoken_reply: "Thanks.".into(),
                question: Some("What changed?".into()),
                session_phase: "active".into(),
                is_complete: false,
                provider_latency_ms: None,
                first_token_ms: None,
                answered_by: None,
            })
        })
        .unwrap();
    let summary = store.finish(id).unwrap();
    assert_eq!(summary.wrapup_preparation, WrapupPreparation::Pending);
    assert!(summary.phrases.is_empty());
    id
}

fn result() -> WrapupResult {
    WrapupResult {
        phrases: vec![GeneratedWrapupPhrase {
            sequence: 1,
            phrase: "share progress early".into(),
            note: "Use this when giving updates before someone asks.".into(),
            you_said: "share progress early".into(),
        }],
    }
}

#[test]
fn slow_generation_never_blocks_a_new_conversation_and_emits_only_finished_id() {
    let store = SessionStore::default();
    let id = finish_answer(&store);
    let (entered_tx, entered_rx) = mpsc::channel();
    let (release_tx, release_rx) = mpsc::channel();
    let release = Mutex::new(release_rx);
    let (event_tx, event_rx) = mpsc::channel();
    let queue = WrapupQueue::start(
        store.clone(),
        move |_| {
            entered_tx.send(()).unwrap();
            release.lock().unwrap().recv_timeout(WAIT).unwrap();
            Ok(result())
        },
        move |event| {
            event_tx.send(event).unwrap();
        },
    )
    .unwrap();
    entered_rx.recv_timeout(WAIT).unwrap();
    let next = store.start().unwrap();
    assert_ne!(next.session_id, id);
    assert_eq!(
        store.session_wrapup(id).unwrap().wrapup_preparation,
        WrapupPreparation::Pending
    );
    release_tx.send(()).unwrap();
    assert_eq!(event_rx.recv_timeout(WAIT).unwrap().session_id, id);
    assert_eq!(
        store.session_wrapup(id).unwrap().phrases[0].note,
        result().phrases[0].note
    );
    assert_eq!(
        store.get_active().unwrap().unwrap().session_id,
        next.session_id
    );
    drop(queue);
}

#[test]
fn startup_resumes_durable_pending_work_and_keeps_the_prepared_snapshot_on_reopen() {
    let path = std::env::temp_dir().join(format!(
        "english-trainer-wrapup-restart-{}.sqlite3",
        std::process::id()
    ));
    let store = SessionStore::open(&path).unwrap();
    let id = finish_answer(&store);
    drop(store);
    let reopened = SessionStore::open(&path).unwrap();
    let (event_tx, event_rx) = mpsc::channel();
    let queue = WrapupQueue::start(
        reopened.clone(),
        |_| Ok(result()),
        move |event| {
            event_tx.send(event).unwrap();
        },
    )
    .unwrap();
    assert_eq!(event_rx.recv_timeout(WAIT).unwrap().session_id, id);
    drop(queue);
    drop(reopened);
    let final_store = SessionStore::open(&path).unwrap();
    assert_eq!(
        final_store.session_wrapup(id).unwrap().wrapup_preparation,
        WrapupPreparation::Ready
    );
    assert_eq!(final_store.session_wrapup(id).unwrap().phrases.len(), 1);
    drop(final_store);
    let _ = std::fs::remove_file(path);
}

#[test]
fn failures_wait_for_explicit_retry_and_empty_sessions_never_call_the_provider() {
    let store = SessionStore::default();
    let empty = store.start().unwrap().session_id;
    assert_eq!(
        store.finish(empty).unwrap().wrapup_preparation,
        WrapupPreparation::Ready
    );
    let id = finish_answer(&store);
    let (call_tx, call_rx) = mpsc::channel();
    let (event_tx, event_rx) = mpsc::channel();
    let queue = WrapupQueue::start(
        store.clone(),
        move |_| {
            call_tx.send(()).unwrap();
            Err(ProviderError::new(
                ProviderErrorCode::RateLimited,
                "Try again later.",
            ))
        },
        move |event| {
            event_tx.send(event).unwrap();
        },
    )
    .unwrap();
    assert_eq!(event_rx.recv_timeout(WAIT).unwrap().session_id, id);
    call_rx.recv_timeout(WAIT).unwrap();
    assert!(
        matches!(store.session_wrapup(id).unwrap().wrapup_preparation,
        WrapupPreparation::Failed { error } if error.code == ProviderErrorCode::RateLimited)
    );
    queue.wake();
    assert!(call_rx.recv_timeout(Duration::from_millis(100)).is_err());
    queue.retry(id).unwrap();
    call_rx.recv_timeout(WAIT).unwrap();
    assert_eq!(event_rx.recv_timeout(WAIT).unwrap().session_id, id);
    assert!(queue.retry(empty).is_err());
}
