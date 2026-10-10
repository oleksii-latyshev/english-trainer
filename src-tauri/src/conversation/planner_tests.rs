use super::*;
use crate::conversation::InputSource;
use crate::providers::ConversationTurn;

fn plan(_: &str) -> Result<AnswerPlan, ProviderError> {
    Ok(AnswerPlan {
        frame: vec![
            "Answer directly".into(),
            "Give a reason".into(),
            "Add an example".into(),
        ],
        phrases: vec![
            "In my view".into(),
            "For example".into(),
            "That matters because".into(),
        ],
        model_answer: "I enjoy reading. It helps me relax.".into(),
        adaptation: "I enjoy [an activity]. It helps me [a benefit].".into(),
    })
}
fn reply() -> ConversationTurn {
    ConversationTurn {
        spoken_reply: "That sounds useful.".into(),
        question: Some("Why?".into()),
        session_phase: "conversation".into(),
        is_complete: false,
        provider_latency_ms: None,
        first_token_ms: None,
        answered_by: None,
    }
}
#[test]
fn prefetch_is_cached_without_recording_help_or_exposing_a_cue() {
    let store = SessionStore::default();
    let session = store.start().unwrap();
    let expected = store
        .answer_plan(
            session.session_id,
            1,
            &session.opening_question,
            false,
            plan,
        )
        .unwrap();
    assert_eq!(
        store
            .answer_plan(
                session.session_id,
                1,
                &session.opening_question,
                false,
                |_| panic!("same question must use cache")
            )
            .unwrap(),
        expected
    );
    assert!(!store
        .lock()
        .database
        .has_session_cue_exposure_before(session.session_id, None, None, i64::MAX)
        .unwrap());
    assert!(!store
        .lock()
        .database
        .has_answer_help_used(session.session_id, 1)
        .unwrap());
    store
        .record_answer_help_used(session.session_id, 1)
        .unwrap();
    store
        .answer_plan(
            session.session_id,
            1,
            &session.opening_question,
            false,
            |_| panic!("opening cached example must not generate again"),
        )
        .unwrap();
    assert!(store
        .lock()
        .database
        .has_answer_help_used(session.session_id, 1)
        .unwrap());
}
#[test]
fn failed_preparation_is_cached_until_explicit_retry_and_stale_requests_do_not_generate() {
    let store = SessionStore::default();
    let session = store.start().unwrap();
    let error = store
        .answer_plan(
            session.session_id,
            1,
            &session.opening_question,
            false,
            |_| {
                Err(ProviderError::new(
                    ProviderErrorCode::RateLimited,
                    "Retry later",
                ))
            },
        )
        .unwrap_err();
    assert_eq!(
        store
            .answer_plan(
                session.session_id,
                1,
                &session.opening_question,
                false,
                |_| panic!("cached failures must not consume more quota")
            )
            .unwrap_err()
            .code,
        error.code
    );
    assert!(store
        .answer_plan(session.session_id, 1, &session.opening_question, true, plan)
        .is_ok());
    assert!(store
        .answer_plan(
            session.session_id,
            2,
            &session.opening_question,
            false,
            |_| panic!("stale sequence must not generate")
        )
        .is_err());
    assert!(store
        .answer_plan(session.session_id, 1, "Wrong question?", false, |_| panic!(
            "stale question must not generate"
        ))
        .is_err());
}
#[test]
fn slow_planning_does_not_block_the_reply_and_its_late_result_is_rejected() {
    let store = SessionStore::default();
    let session = store.start().unwrap();
    let (began, started) = std::sync::mpsc::channel();
    let (release, wait) = std::sync::mpsc::channel();
    let preparing = store.clone();
    let question = session.opening_question.clone();
    let id = session.session_id;
    let worker = std::thread::spawn(move || {
        preparing.answer_plan(id, 1, &question, false, |q| {
            began.send(()).unwrap();
            wait.recv().unwrap();
            plan(q)
        })
    });
    started.recv().unwrap();
    store
        .send_turn(id, "I enjoy reading.".into(), |_| Ok(reply()))
        .unwrap();
    release.send(()).unwrap();
    assert_eq!(
        worker.join().unwrap().unwrap_err().code,
        ProviderErrorCode::InvalidRequest
    );
    let question = store.get_active().unwrap().unwrap().opening_question;
    assert!(store.answer_plan(id, 2, &question, false, plan).is_ok());
}
#[test]
fn help_excludes_only_the_cued_spoken_answer_and_survives_restart() {
    let dir = crate::providers::agy::runner::ScratchDirectory::new().unwrap();
    let path = dir.path().join("planner.sqlite");
    let store = SessionStore::open(&path).unwrap();
    let session = store.start().unwrap();
    store
        .record_answer_help_used(session.session_id, 1)
        .unwrap();
    store
        .send_turn_with_source(
            session.session_id,
            "I enjoy reading.".into(),
            InputSource::Voice,
            Some(1000),
            |_| Ok(reply()),
        )
        .unwrap();
    drop(store);
    let store = SessionStore::open(&path).unwrap();
    let error = store
        .review_memory_usage(session.session_id, 1, |_| {
            panic!("cued answer must not be sent for independent assessment")
        })
        .unwrap_err();
    assert_eq!(error.code, ProviderErrorCode::InvalidRequest);
    store
        .send_turn_with_source(
            session.session_id,
            "It helps me relax.".into(),
            InputSource::Voice,
            Some(1000),
            |_| Ok(reply()),
        )
        .unwrap();
    assert!(store
        .review_memory_usage(session.session_id, 2, |_| panic!(
            "no learning candidates exist"
        ))
        .is_ok());
    assert_eq!(
        store.dialogue(session.session_id).unwrap().help_used,
        vec![true, false]
    );
}
