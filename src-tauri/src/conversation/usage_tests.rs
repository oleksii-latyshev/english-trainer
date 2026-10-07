use super::*;
use crate::conversation::SessionMode;
use crate::providers::{
    ConversationTurn, FocusCategory, FocusFeedback, TurnFeedback, UsageFinding, UsageOutcome,
    UsageReviewResponse,
};
use std::sync::atomic::{AtomicUsize, Ordering};

#[test]
fn empty_candidates_persists_empty_assessment_without_calling_provider() {
    let store = SessionStore::default();
    let session = store
        .start_session(Some(SessionMode::Conversation))
        .unwrap();
    let _ = store
        .send_turn(
            session.session_id,
            "I love writing code every day.".into(),
            |_| {
                Ok(ConversationTurn {
                    spoken_reply: "Great.".into(),
                    question: Some("What stack?".into()),
                    session_phase: "active".into(),
                    is_complete: false,
                    provider_latency_ms: None,
                    first_token_ms: None,
                    answered_by: None,
                })
            },
        )
        .unwrap();

    let calls = AtomicUsize::new(0);
    let assessment = store
        .review_memory_usage(session.session_id, 1, |_| {
            calls.fetch_add(1, Ordering::SeqCst);
            Ok(UsageReviewResponse { findings: vec![] })
        })
        .unwrap();

    assert_eq!(calls.load(Ordering::SeqCst), 0);
    assert!(assessment.findings.is_empty());

    // Idempotent retrieval
    let saved = store
        .get_practice_memory_usage(session.session_id, 1)
        .unwrap()
        .unwrap();
    assert_eq!(saved.session_id, session.session_id);
    assert_eq!(saved.sequence, 1);
}

#[test]
fn real_provider_in_flight_does_not_block_send_finish_and_rejects_duplicate_review() {
    let store = SessionStore::default();
    let earlier = store
        .start_session(Some(SessionMode::Conversation))
        .unwrap();
    let _ = store
        .send_turn(
            earlier.session_id,
            "I work in there yesterday.".into(),
            |_| {
                Ok(ConversationTurn {
                    spoken_reply: "I see.".into(),
                    question: Some("Where was that?".into()),
                    session_phase: "active".into(),
                    is_complete: false,
                    provider_latency_ms: None,
                    first_token_ms: None,
                    answered_by: None,
                })
            },
        )
        .unwrap();
    store
        .save_feedback(
            earlier.session_id,
            1,
            "I work in there yesterday.",
            &TurnFeedback {
                focus_feedback: vec![FocusFeedback {
                    category: FocusCategory::Grammar,
                    original: "work in there".into(),
                    improved: "work there".into(),
                    explanation: "Use the natural preposition.".into(),
                }],
                b2_rewrite: "I worked there yesterday.".into(),
            },
        )
        .unwrap();
    store.finish(earlier.session_id).unwrap();
    std::thread::sleep(std::time::Duration::from_millis(5));

    let session = store
        .start_session(Some(SessionMode::Conversation))
        .unwrap();
    let _ = store
        .send_turn(session.session_id, "I work there now.".into(), |_| {
            Ok(ConversationTurn {
                spoken_reply: "Good to hear.".into(),
                question: Some("What do you like about it?".into()),
                session_phase: "active".into(),
                is_complete: false,
                provider_latency_ms: None,
                first_token_ms: None,
                answered_by: None,
            })
        })
        .unwrap();

    let (started_tx, started_rx) = std::sync::mpsc::channel();
    let (release_tx, release_rx) = std::sync::mpsc::channel();
    let reviewing = store.clone();
    let handle = std::thread::spawn(move || {
        reviewing.review_memory_usage(session.session_id, 1, |request| {
            started_tx.send(()).unwrap();
            release_rx.recv().unwrap();
            let candidate = &request.candidates[0];
            Ok(UsageReviewResponse {
                findings: vec![UsageFinding {
                    item_type: candidate.item_type,
                    item_id: candidate.item_id,
                    outcome: UsageOutcome::Correct,
                    confidence: 0.95,
                    exact_excerpt: "work there".into(),
                }],
            })
        })
    });
    started_rx
        .recv_timeout(std::time::Duration::from_secs(2))
        .unwrap();

    let duplicate = store.review_memory_usage(session.session_id, 1, |_| {
        panic!("duplicate review must not start another provider request")
    });
    assert_eq!(
        duplicate.unwrap_err().code,
        crate::providers::ProviderErrorCode::Busy
    );

    let turn2 = store.send_turn(
        session.session_id,
        "I enjoy the helpful people.".into(),
        |_| {
            Ok(ConversationTurn {
                spoken_reply: "Nice.".into(),
                question: Some("How often?".into()),
                session_phase: "active".into(),
                is_complete: false,
                provider_latency_ms: None,
                first_token_ms: None,
                answered_by: None,
            })
        },
    );
    assert!(turn2.is_ok());

    let finish = store.finish(session.session_id);
    assert!(finish.is_ok());
    release_tx.send(()).unwrap();
    assert!(handle.join().unwrap().is_ok());
}

#[test]
fn ended_saved_session_can_be_reviewed() {
    let store = SessionStore::default();
    let session = store
        .start_session(Some(SessionMode::Conversation))
        .unwrap();
    let _ = store
        .send_turn(session.session_id, "First turn answer here.".into(), |_| {
            Ok(ConversationTurn {
                spoken_reply: "Understood.".into(),
                question: Some("Second question?".into()),
                session_phase: "active".into(),
                is_complete: false,
                provider_latency_ms: None,
                first_token_ms: None,
                answered_by: None,
            })
        })
        .unwrap();
    let _ = store.finish(session.session_id).unwrap();

    // Ended session can still be reviewed for turn 1
    let assessment = store.review_memory_usage(session.session_id, 1, |_| {
        Ok(UsageReviewResponse { findings: vec![] })
    });
    assert!(assessment.is_ok());
}
