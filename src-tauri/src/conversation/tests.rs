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
        provider_latency_ms: None,
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

fn sample_feedback() -> TurnFeedback {
    TurnFeedback {
        focus_feedback: vec![crate::providers::FocusFeedback {
            category: crate::providers::FocusCategory::Grammar,
            original: "I work in there".into(),
            improved: "I work there".into(),
            explanation: "Drop the extra preposition.".into(),
        }],
        b2_rewrite: "I work there as an engineer.".into(),
    }
}

#[test]
fn retry_is_paired_with_saved_answer_and_survives_reopen_without_new_turn() {
    let path = temporary_database_path();
    let store = SessionStore::open(&path).unwrap();
    let session = store.start().unwrap();
    let sent = "  I work in there  ";
    store
        .send_turn(session.session_id, sent.into(), |_| {
            Ok(turn("Next?", "Follow up?"))
        })
        .unwrap();
    store
        .save_feedback(session.session_id, 1, sent, &sample_feedback())
        .unwrap();
    let result = store
        .retry_turn(session.session_id, 1, "I work there now".into())
        .unwrap();
    assert_eq!(result.original_transcript, "I work in there");
    assert_eq!(
        result.target_evidence,
        crate::providers::TargetEvidence::NewlyObservedInRetry
    );
    assert_eq!(store.get_active().unwrap().unwrap().turn_count, 1);
    drop(store);

    let reopened = SessionStore::open(&path).unwrap();
    let resumed = reopened.get_active().unwrap().unwrap();
    assert_eq!(resumed.turn_count, 1);
    assert_eq!(resumed.retry_evidence, vec![result]);
    std::fs::remove_file(path).unwrap();
}

#[test]
fn retry_validation_failure_preserves_the_reviewed_answer_and_session() {
    let store = SessionStore::default();
    let session = store.start().unwrap();
    store
        .send_turn(session.session_id, "Original answer".into(), |_| {
            Ok(turn("Next?", "Follow up?"))
        })
        .unwrap();
    store
        .save_feedback(session.session_id, 1, "Original answer", &sample_feedback())
        .unwrap();

    let error = store
        .retry_turn(session.session_id, 2, "Different retry".into())
        .unwrap_err();
    assert_eq!(error.code, ProviderErrorCode::InvalidRequest);
    assert_eq!(store.get_active().unwrap().unwrap().turn_count, 1);
    assert_eq!(
        store
            .lock()
            .database
            .turn(session.session_id, 1)
            .unwrap()
            .unwrap()
            .learner,
        "Original answer"
    );
}

#[test]
fn start_turn_context_resume_and_finish_form_a_session() {
    let store = SessionStore::default();
    let session = store.start().unwrap();
    assert_eq!(session.opening_question, OPENING_QUESTION);
    assert_eq!(session.turn_count, 0);
    assert_eq!(session.target_turns, DAILY_TARGET_TURNS);

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
    assert_eq!(resumed.target_turns, DAILY_TARGET_TURNS);
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
    let state = resumed.get_active().unwrap().unwrap();
    assert_eq!(state.session_id, session.session_id);
    assert_eq!(state.turn_count, 10);
    assert_eq!(state.target_turns, DAILY_TARGET_TURNS);
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
    assert!(reopened.get_active().unwrap().is_none());
    let _ = std::fs::remove_file(path);
}

#[test]
fn feedback_mistake_deduplication_and_idempotency_across_turns() {
    let store = SessionStore::default();
    let session = store.start().unwrap();

    // Turn 1
    store
        .send_turn(session.session_id, "I work in there".into(), |_| {
            Ok(turn("Okay.", "What is next?"))
        })
        .unwrap();

    // Turn 2
    store
        .send_turn(session.session_id, "I worked in there".into(), |_| {
            Ok(turn("Okay.", "Anything else?"))
        })
        .unwrap();

    let feedback1 = sample_feedback();
    let feedback2 = TurnFeedback {
        focus_feedback: vec![crate::providers::FocusFeedback {
            category: crate::providers::FocusCategory::Grammar,
            original: "I worked in there".into(),
            improved: "I work there".into(),
            explanation: "Drop the extra preposition.".into(),
        }],
        b2_rewrite: "I work there now.".into(),
    };

    // Save feedback for turn 1
    store
        .save_feedback(session.session_id, 1, "I work in there", &feedback1)
        .unwrap();

    let memory1 = store.get_learning_memory().unwrap();
    assert_eq!(memory1.mistakes.len(), 1);
    assert_eq!(memory1.mistakes[0].times_seen, 1);
    assert_eq!(memory1.mistakes[0].normalized_key, "grammar:i work there");

    // Saving feedback again for turn 1 does NOT increment times_seen (idempotent)
    store
        .save_feedback(session.session_id, 1, "I work in there", &feedback1)
        .unwrap();
    let memory1_again = store.get_learning_memory().unwrap();
    assert_eq!(memory1_again.mistakes[0].times_seen, 1);

    // Save feedback for turn 2 (same normalized key "grammar:i work there")
    store
        .save_feedback(session.session_id, 2, "I worked in there", &feedback2)
        .unwrap();
    let memory2 = store.get_learning_memory().unwrap();
    assert_eq!(memory2.mistakes.len(), 1);
    assert_eq!(memory2.mistakes[0].times_seen, 2);

    // Saving feedback again for turn 2 does NOT increment times_seen
    store
        .save_feedback(session.session_id, 2, "I worked in there", &feedback2)
        .unwrap();
    let memory2_again = store.get_learning_memory().unwrap();
    assert_eq!(memory2_again.mistakes[0].times_seen, 2);
}

#[test]
fn phrase_saved_in_one_session_persists_and_can_be_reviewed_in_later_session() {
    let path = temporary_database_path();
    let store = SessionStore::open(&path).unwrap();

    // Session 1: save a phrase card
    let session1 = store.start().unwrap();
    store
        .send_turn(session1.session_id, "I work in there".into(), |_| {
            Ok(turn("Got it.", "Next question?"))
        })
        .unwrap();
    let saved_card = store
        .save_phrase(
            "I work there".into(),
            "Drop the extra preposition.".into(),
            Some(session1.session_id),
            Some(1),
        )
        .unwrap();
    assert_eq!(saved_card.phrase, "I work there");
    assert_eq!(saved_card.status, crate::learning::LearningStatus::Learning);

    // Saving the same phrase again deduplicates
    let card_dedup = store
        .save_phrase(
            "  i work there  ".into(),
            "Different note".into(),
            Some(session1.session_id),
            Some(1),
        )
        .unwrap();
    assert_eq!(card_dedup.id, saved_card.id);

    // Finish session 1
    store.finish(session1.session_id).unwrap();
    drop(store);

    // Later session: open store in a new session
    let store2 = SessionStore::open(&path).unwrap();
    let session2 = store2.start().unwrap();
    assert_ne!(session2.session_id, session1.session_id);

    // The phrase card is still present
    let memory = store2.get_learning_memory().unwrap();
    assert_eq!(memory.phrase_cards.len(), 1);
    assert_eq!(memory.phrase_cards[0].phrase, "I work there");

    // Review action: Remembered
    let review_result = store2
        .submit_review(
            crate::learning::LearningItemType::Phrase,
            saved_card.id,
            crate::learning::ReviewResponse::Remembered,
        )
        .unwrap();
    assert_eq!(
        review_result.status,
        crate::learning::LearningStatus::Learning
    );
    assert_eq!(review_result.interval_days, 2);

    let updated_memory = store2.get_learning_memory().unwrap();
    assert_eq!(updated_memory.phrase_cards[0].interval_days, 2);
    assert!(updated_memory.phrase_cards[0].last_reviewed_at.is_some());

    std::fs::remove_file(path).unwrap();
}

#[test]
fn failure_isolation_keeps_conversation_usable() {
    let store = SessionStore::default();
    let session = store.start().unwrap();
    store
        .send_turn(session.session_id, "Valid answer".into(), |_| {
            Ok(turn("Okay.", "Follow-up?"))
        })
        .unwrap();

    // Invalid phrase save does not break session
    let error = store
        .save_phrase("".into(), "Note".into(), Some(session.session_id), Some(1))
        .unwrap_err();
    assert_eq!(error.code, ProviderErrorCode::InvalidRequest);

    // Invalid review submission does not break session
    let review_err = store
        .submit_review(
            crate::learning::LearningItemType::Mistake,
            999999,
            crate::learning::ReviewResponse::Remembered,
        )
        .unwrap_err();
    assert_eq!(review_err.code, ProviderErrorCode::DatabaseError);

    // Conversation is still intact and can continue
    let next_turn = store
        .send_turn(session.session_id, "Another answer".into(), |_| {
            Ok(turn("Continuing.", "Next?"))
        })
        .unwrap();
    assert_eq!(next_turn.spoken_reply, "Continuing.");
    assert_eq!(store.get_active().unwrap().unwrap().turn_count, 2);
}

#[test]
fn empty_focus_feedback_preserves_independent_flow() {
    let store = SessionStore::default();
    let session = store.start().unwrap();
    store
        .send_turn(session.session_id, "Good grammar answer".into(), |_| {
            Ok(turn("Nice.", "Next?"))
        })
        .unwrap();

    let feedback_no_focus = TurnFeedback {
        focus_feedback: Vec::new(),
        b2_rewrite: "Even stronger fluent version.".into(),
    };

    // Saving feedback with empty focus succeeds
    store
        .save_feedback(
            session.session_id,
            1,
            "Good grammar answer",
            &feedback_no_focus,
        )
        .unwrap();

    // No mistakes created
    let memory = store.get_learning_memory().unwrap();
    assert_eq!(memory.mistakes.len(), 0);

    // But phrase card for B2 rewrite can still be saved
    let phrase = store
        .save_phrase(
            feedback_no_focus.b2_rewrite,
            "Saved B2 rewrite".into(),
            Some(session.session_id),
            Some(1),
        )
        .unwrap();
    assert_eq!(phrase.phrase, "Even stronger fluent version.");

    let memory_after = store.get_learning_memory().unwrap();
    assert_eq!(memory_after.phrase_cards.len(), 1);
}
