use super::*;
use std::sync::mpsc;
use std::thread;
use std::time::Duration;

fn turn(reply: &str, question: &str) -> ConversationTurn {
    ConversationTurn {
        spoken_reply: reply.into(),
        question: Some(question.into()),
        session_phase: "active".into(),
        is_complete: false,
    }
}

fn temporary_database_path() -> std::path::PathBuf {
    static NEXT: std::sync::atomic::AtomicUsize = std::sync::atomic::AtomicUsize::new(0);
    let index = NEXT.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
    std::env::temp_dir().join(format!(
        "english-trainer-session-{}-{index}.sqlite3",
        std::process::id()
    ))
}

#[test]
fn start_turn_context_resume_and_finish_form_a_session() {
    let store = SessionStore::default();
    let session = store.start().unwrap();
    assert_eq!(session.opening_question, OPENING_QUESTION);
    assert_eq!(session.turn_count, 0);

    let first = store
        .send_turn(
            session.session_id,
            "I went to a museum.".into(),
            |context| {
                assert_eq!(context.opening_question, session.opening_question);
                assert!(context.recent_turns.is_empty());
                assert_eq!(context.latest_transcript, "I went to a museum.");
                Ok(turn("That sounds interesting.", "What did you see there?"))
            },
        )
        .unwrap();
    assert_eq!(first.question.as_deref(), Some("What did you see there?"));

    store
        .send_turn(session.session_id, "I saw an old ship.".into(), |context| {
            assert_eq!(context.recent_turns.len(), 1);
            assert_eq!(context.recent_turns[0].learner, "I went to a museum.");
            assert_eq!(
                context.recent_turns[0].assistant_question,
                "What did you see there?"
            );
            assert_eq!(context.latest_transcript, "I saw an old ship.");
            Ok(turn("That must have been impressive.", "How old was it?"))
        })
        .unwrap();

    let resumed = store.start().unwrap();
    assert_eq!(resumed.session_id, session.session_id);
    assert_eq!(resumed.opening_question, "How old was it?");
    assert_eq!(resumed.turn_count, 2);
    assert_eq!(store.finish(session.session_id).unwrap().finished, true);
    assert_eq!(
        store.finish(session.session_id).unwrap_err().code,
        ProviderErrorCode::InvalidSession
    );
}

#[test]
fn provider_failure_keeps_session_and_allows_retry() {
    let store = SessionStore::default();
    let session = store.start().unwrap();
    let failed = store.send_turn(session.session_id, "Try again please.".into(), |_| {
        Err(ProviderError::new(ProviderErrorCode::Timeout, "retry"))
    });
    assert_eq!(failed.unwrap_err().code, ProviderErrorCode::Timeout);

    let retried = store
        .send_turn(session.session_id, "Try again please.".into(), |context| {
            assert!(context.recent_turns.is_empty());
            Ok(turn("Of course.", "What would you like to discuss?"))
        })
        .unwrap();
    assert_eq!(retried.spoken_reply, "Of course.");
}

#[test]
fn rejects_invalid_and_stale_session_ids() {
    let store = SessionStore::default();
    let session = store.start().unwrap();
    let error = store
        .send_turn(
            session.session_id + 100,
            "Hello.".into(),
            |_| unreachable!(),
        )
        .unwrap_err();
    assert_eq!(error.code, ProviderErrorCode::InvalidSession);
    let too_long = store
        .send_turn(
            session.session_id,
            "x".repeat(MAX_TRANSCRIPT_CHARS + 1),
            |_| unreachable!(),
        )
        .unwrap_err();
    assert_eq!(too_long.code, ProviderErrorCode::InvalidRequest);
    let blank = store
        .send_turn(session.session_id, "  \n".into(), |_| unreachable!())
        .unwrap_err();
    assert_eq!(blank.code, ProviderErrorCode::InvalidRequest);
}

#[test]
fn concurrent_turn_is_rejected_without_holding_mutex_during_provider_call() {
    let store = SessionStore::default();
    let session = store.start().unwrap();
    let session_id = session.session_id;
    let worker_store = store.clone();
    let (started_tx, started_rx) = mpsc::channel();
    let (release_tx, release_rx) = mpsc::channel();
    let worker = thread::spawn(move || {
        worker_store.send_turn(session_id, "First answer.".into(), |_| {
            started_tx.send(()).unwrap();
            release_rx.recv_timeout(Duration::from_secs(3)).unwrap();
            Ok(turn("Got it.", "What happened next?"))
        })
    });

    started_rx.recv_timeout(Duration::from_secs(3)).unwrap();
    let second = store.send_turn(
        session.session_id,
        "Second answer.".into(),
        |_| unreachable!(),
    );
    assert_eq!(second.unwrap_err().code, ProviderErrorCode::Busy);
    let finish = store.finish(session.session_id).unwrap_err();
    assert_eq!(finish.code, ProviderErrorCode::Busy);
    release_tx.send(()).unwrap();
    assert!(worker.join().unwrap().is_ok());
}

#[test]
fn context_history_is_bounded_to_eight_recent_turns() {
    let store = SessionStore::default();
    let session = store.start().unwrap();
    for index in 0..10 {
        store
            .send_turn(session.session_id, format!("answer {index}"), |context| {
                assert!(context.recent_turns.len() <= MAX_TURNS);
                if index == 9 {
                    assert_eq!(context.recent_turns.len(), MAX_TURNS);
                    assert_eq!(context.recent_turns[0].learner, "answer 1");
                    assert_eq!(context.recent_turns.last().unwrap().learner, "answer 8");
                }
                Ok(turn("Okay.", &format!("Question {index}?")))
            })
            .unwrap();
    }
}

#[test]
fn context_discards_oldest_turns_to_stay_within_character_budget() {
    let store = SessionStore::default();
    let session = store.start().unwrap();
    for index in 0..4 {
        store
            .send_turn(
                session.session_id,
                format!("{index}{}", "x".repeat(2_900)),
                |context| {
                    let chars = context_char_count(context);
                    assert!(chars <= MAX_CONTEXT_CHARS);
                    if index == 3 {
                        assert!(context.recent_turns.len() < 3);
                    }
                    Ok(turn("Okay.", "Can you tell me more?"))
                },
            )
            .unwrap();
    }
}

#[test]
fn active_session_and_all_turns_resume_after_store_restart() {
    let path = temporary_database_path();
    let store = SessionStore::open(&path).unwrap();
    let session = store.start().unwrap();
    for index in 0..10 {
        store
            .send_turn(session.session_id, format!("answer {index}"), |context| {
                assert!(context.recent_turns.len() <= MAX_TURNS);
                Ok(turn("Okay.", &format!("Question {index}?")))
            })
            .unwrap();
    }
    drop(store);

    let resumed = SessionStore::open(&path).unwrap();
    let state = resumed.get_active().unwrap();
    assert_eq!(state.session_id, session.session_id);
    assert_eq!(state.turn_count, 10);
    assert_eq!(state.opening_question, "Question 9?");
    resumed
        .send_turn(state.session_id, "answer after restart".into(), |context| {
            assert_eq!(context.recent_turns.len(), MAX_TURNS);
            assert_eq!(context.recent_turns[0].learner, "answer 2");
            Ok(turn("Sure.", "What else?"))
        })
        .unwrap();
    drop(resumed);
    let _ = std::fs::remove_file(path);
}

#[test]
fn failed_provider_turn_is_not_saved_and_finish_survives_restart() {
    let path = temporary_database_path();
    let store = SessionStore::open(&path).unwrap();
    let session = store.start().unwrap();
    let error = store
        .send_turn(session.session_id, "An answer".into(), |_| {
            Err(ProviderError::new(ProviderErrorCode::Timeout, "retry"))
        })
        .unwrap_err();
    assert_eq!(error.code, ProviderErrorCode::Timeout);
    assert_eq!(
        store
            .lock()
            .database
            .turn_count(session.session_id)
            .unwrap(),
        0
    );
    store
        .send_turn(session.session_id, "A saved answer".into(), |_| {
            Ok(turn("Good.", "Next question?"))
        })
        .unwrap();
    store.finish(session.session_id).unwrap();
    drop(store);

    let reopened = SessionStore::open(&path).unwrap();
    assert!(reopened.get_active().is_none());
    let _ = std::fs::remove_file(path);
}
