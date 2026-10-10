use super::*;
use crate::{
    conversation::InputSource,
    providers::{ConversationTurn, RescueKind},
};

fn request(question: String) -> RescueRequest {
    RescueRequest {
        kind: RescueKind::NextStep,
        question,
        partial_transcript: "I use a notebook because".into(),
        description: String::new(),
    }
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
fn rescue_records_only_the_current_answer_before_generation_even_if_generation_fails() {
    let store = SessionStore::default();
    let session = store.start().unwrap();
    let input = request(session.opening_question);
    let error = store
        .rescue_answer(session.session_id, 1, &input, |_| {
            assert!(store
                .lock()
                .database
                .has_answer_help_used(session.session_id, 1)
                .unwrap());
            Err(ProviderError::new(
                ProviderErrorCode::Timeout,
                "Retry Stuck.",
            ))
        })
        .unwrap_err();
    assert_eq!(error.code, ProviderErrorCode::Timeout);
    store
        .send_turn_with_source(
            session.session_id,
            "I use a notebook.".into(),
            InputSource::Voice,
            Some(2000),
            |_| Ok(reply()),
        )
        .unwrap();
    store
        .send_turn_with_source(
            session.session_id,
            "It saves time.".into(),
            InputSource::Voice,
            Some(1000),
            |_| Ok(reply()),
        )
        .unwrap();
    assert_eq!(
        store.dialogue(session.session_id).unwrap().help_used,
        vec![true, false]
    );
    assert!(store
        .review_memory_usage(session.session_id, 1, |_| panic!("cued answer"))
        .is_err());
}
#[test]
fn malformed_and_stale_rescue_requests_never_record_a_cue_or_call_the_provider() {
    let store = SessionStore::default();
    let session = store.start().unwrap();
    let mut input = request(session.opening_question);
    input.partial_transcript.clear();
    assert!(store
        .rescue_answer(session.session_id, 1, &input, |_| panic!("invalid request"))
        .is_err());
    input.partial_transcript = "I use a tool".into();
    input.question = "Another question?".into();
    assert!(store
        .rescue_answer(session.session_id, 1, &input, |_| panic!("stale question"))
        .is_err());
    assert!(!store
        .lock()
        .database
        .has_answer_help_used(session.session_id, 1)
        .unwrap());
}
#[test]
fn slow_rescue_does_not_block_a_turn_and_a_late_result_is_discarded() {
    let store = SessionStore::default();
    let session = store.start().unwrap();
    let input = request(session.opening_question);
    let (began, started) = std::sync::mpsc::channel();
    let (release, wait) = std::sync::mpsc::channel();
    let preparing = store.clone();
    let id = session.session_id;
    let worker = std::thread::spawn(move || {
        preparing.rescue_answer(id, 1, &input, |_| {
            began.send(()).unwrap();
            wait.recv().unwrap();
            Ok(RescueResponse::NextStep {
                suggestion: "For example, it helps me organize my day.".into(),
            })
        })
    });
    started.recv().unwrap();
    assert_eq!(
        store
            .rescue_answer(
                id,
                1,
                &request(store.get_active().unwrap().unwrap().opening_question),
                |_| panic!("duplicate rescue must not launch")
            )
            .unwrap_err()
            .code,
        ProviderErrorCode::Busy
    );
    store
        .send_turn(id, "I use a notebook.".into(), |_| Ok(reply()))
        .unwrap();
    release.send(()).unwrap();
    assert_eq!(
        worker.join().unwrap().unwrap_err().code,
        ProviderErrorCode::InvalidRequest
    );
    let current = store
        .lock()
        .active
        .as_ref()
        .unwrap()
        .current_question()
        .to_string();
    assert!(store
        .rescue_answer(id, 2, &request(current), |_| Ok(RescueResponse::NextStep {
            suggestion: "Another reason is the flexibility.".into(),
        }))
        .is_ok());
}

#[test]
fn writing_review_and_mistake_practice_reject_rescue_without_a_cue() {
    for phase in [
        PracticePhase::Writing,
        PracticePhase::WritingReview,
        PracticePhase::SpeakingReview,
    ] {
        let store = SessionStore::default();
        let session = store.start().unwrap();
        store.lock().active.as_mut().unwrap().practice_phase = phase;
        assert!(store
            .rescue_answer(
                session.session_id,
                1,
                &request(session.opening_question),
                |_| panic!("non-spoken question")
            )
            .is_err());
        assert!(!store
            .lock()
            .database
            .has_answer_help_used(session.session_id, 1)
            .unwrap());
    }
    let store = SessionStore::default();
    let session = store.start().unwrap();
    store.lock().active.as_mut().unwrap().is_mistake_practice = true;
    assert!(store
        .rescue_answer(
            session.session_id,
            1,
            &request(session.opening_question),
            |_| panic!("mistake practice")
        )
        .is_err());
}
