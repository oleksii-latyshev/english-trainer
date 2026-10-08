use super::rules::{MAX_CONTEXT_CHARS, MAX_TURNS};
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
        first_token_ms: None,
        answered_by: None,
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
    let finished = reopened.finish(session.session_id).unwrap();
    assert_eq!(finished.turn_count, 1);
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
    let finished = store.finish(session.session_id).unwrap();
    assert!(finished.finished);
    assert_eq!(finished.turn_count, 2);
    assert_eq!(finished.target_turns, DAILY_TARGET_TURNS);
    assert_eq!(
        store.finish(session.session_id).unwrap_err().code,
        ProviderErrorCode::InvalidSession
    );
}

#[test]
fn uncertain_partial_and_already_present_retries_report_their_evidence() {
    let store = SessionStore::default();
    let cases = [
        (
            "the target",
            "the",
            crate::providers::TargetEvidence::Uncertain,
        ),
        (
            "I went home",
            "I would be home",
            crate::providers::TargetEvidence::PartiallyObserved,
        ),
        (
            "I would go home",
            "I would go home",
            crate::providers::TargetEvidence::AlreadyPresentInBoth,
        ),
    ];

    for (original, retry, expected_evidence) in cases {
        let session = store.start().unwrap();
        store
            .send_turn(session.session_id, original.into(), |_| {
                Ok(turn("Thanks.", "Next?"))
            })
            .unwrap();
        let mut feedback = sample_feedback();
        feedback.focus_feedback[0].improved = match expected_evidence {
            crate::providers::TargetEvidence::Uncertain => "the".into(),
            _ => "I would go home".into(),
        };
        store
            .save_feedback(session.session_id, 1, original, &feedback)
            .unwrap();
        let comparison = store
            .retry_turn(session.session_id, 1, retry.into())
            .unwrap();
        assert_eq!(comparison.target_evidence, expected_evidence);
        store.finish(session.session_id).unwrap();
    }
}

#[test]
fn summary_evidence_database_failure_keeps_the_session_active() {
    let path = temporary_database_path();
    let store = SessionStore::open(&path).unwrap();
    let session = store.start().unwrap();
    store
        .send_turn(session.session_id, "A saved answer".into(), |_| {
            Ok(turn("Thanks.", "Next?"))
        })
        .unwrap();
    rusqlite::Connection::open(&path)
        .unwrap()
        .execute("DROP TABLE phrase_cards", [])
        .unwrap();

    let error = store.finish(session.session_id).unwrap_err();
    assert_eq!(error.code, ProviderErrorCode::DatabaseError);
    assert_eq!(
        store.get_active().unwrap().unwrap().session_id,
        session.session_id
    );
    drop(store);
    std::fs::remove_file(path).unwrap();
}

#[test]
fn failed_coach_continue_database_update_clears_in_flight_and_can_retry() {
    let path = temporary_database_path();
    let store = SessionStore::open(&path).unwrap();
    let session = store.start_session(Some(SessionMode::Coach)).unwrap();
    store
        .save_coach_answer(session.session_id, "Saved answer".into())
        .unwrap();
    rusqlite::Connection::open(&path)
        .unwrap()
        .execute("DROP TABLE turns", [])
        .unwrap();

    let error = store
        .continue_turn(session.session_id, 1, |_| Ok(turn("Reply", "Next?")))
        .unwrap_err();
    assert_eq!(error.code, ProviderErrorCode::DatabaseError);
    assert_eq!(
        store
            .save_coach_answer(session.session_id, "Duplicate".into())
            .unwrap_err()
            .code,
        ProviderErrorCode::InvalidRequest
    );

    rusqlite::Connection::open(&path).unwrap().execute(
        "CREATE TABLE turns (session_id INTEGER NOT NULL, sequence INTEGER NOT NULL, user_transcript TEXT NOT NULL, assistant_reply TEXT NOT NULL, assistant_question TEXT NOT NULL, created_at INTEGER NOT NULL, answered_by_provider TEXT, answered_by_model TEXT, answered_by_backup INTEGER, reply_ms INTEGER, answer_duration_ms INTEGER, PRIMARY KEY(session_id, sequence))",
        [],
    ).unwrap();
    rusqlite::Connection::open(&path).unwrap().execute(
        "INSERT INTO turns (session_id, sequence, user_transcript, assistant_reply, assistant_question, created_at) VALUES (?1, 1, 'Saved answer', '', '', 0)",
        [session.session_id as i64],
    ).unwrap();

    assert_eq!(
        store
            .continue_turn(session.session_id, 1, |_| Ok(turn("Reply", "Next?")))
            .unwrap()
            .question
            .as_deref(),
        Some("Next?")
    );
    drop(store);
    std::fs::remove_file(path).unwrap();
}

#[test]
fn coach_mutations_are_rejected_while_continue_provider_is_in_flight() {
    let store = SessionStore::default();
    let session = store.start_session(Some(SessionMode::Coach)).unwrap();
    store
        .save_coach_answer(session.session_id, "Saved answer".into())
        .unwrap();
    let worker_store = store.clone();
    let (started_tx, started_rx) = mpsc::channel();
    let (release_tx, release_rx) = mpsc::channel();
    let worker = thread::spawn(move || {
        worker_store.continue_turn(session.session_id, 1, |_| {
            started_tx.send(()).unwrap();
            release_rx.recv().unwrap();
            Ok(turn("Reply", "Next?"))
        })
    });
    started_rx.recv_timeout(Duration::from_secs(2)).unwrap();
    assert_eq!(
        store
            .save_coach_answer(session.session_id, "Duplicate".into())
            .unwrap_err()
            .code,
        ProviderErrorCode::Busy
    );
    assert!(
        store
            .get_active()
            .unwrap()
            .unwrap()
            .coach_state
            .unwrap()
            .is_pending
    );
    release_tx.send(()).unwrap();
    worker.join().unwrap().unwrap();
}

#[test]
fn spoken_recall_opens_after_speaking_goal_and_keeps_empty_queue_finishable() {
    let store = SessionStore::default();
    let session = store.start().unwrap();
    assert_eq!(
        store
            .daily_recall_plan(session.session_id)
            .unwrap_err()
            .code,
        ProviderErrorCode::InvalidRequest
    );
    for index in 0..DAILY_TARGET_TURNS {
        store
            .send_turn(session.session_id, format!("Answer {index}"), |_| {
                Ok(turn("Continue.", "Another question?"))
            })
            .unwrap();
    }
    let plan = store.daily_recall_plan(session.session_id).unwrap();
    assert!(plan.items.is_empty());
    assert_eq!(plan.completed_count, 0);
    store.finish(session.session_id).unwrap();
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
fn context_history_is_bounded_to_the_recent_window_with_older_answers_condensed() {
    let store = SessionStore::default();
    let session = store.start().unwrap();
    for index in 0..24 {
        store
            .send_turn(session.session_id, format!("answer {index}"), |context| {
                assert!(context.recent_turns.len() <= MAX_TURNS);
                if index == 23 {
                    assert_eq!(context.recent_turns.len(), MAX_TURNS);
                    assert_eq!(context.recent_turns[0].learner, "answer 3");
                    assert_eq!(context.recent_turns.last().unwrap().learner, "answer 22");
                    assert_eq!(
                        context.earlier_answers,
                        ["answer 0", "answer 1", "answer 2"]
                    );
                    assert!(context.asked_questions.contains(&"Question 0?".to_string()));
                    assert!(context
                        .asked_questions
                        .contains(&"Question 22?".to_string()));
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
                    let chars = context.char_count();
                    assert!(chars <= MAX_CONTEXT_CHARS);
                    if index == 3 {
                        assert_eq!(context.recent_turns.len(), 3);
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
    for index in 0..22 {
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
    assert_eq!(state.turn_count, 22);
    assert_eq!(state.target_turns, DAILY_TARGET_TURNS);
    assert_eq!(state.opening_question, "Question 21?");
    resumed
        .send_turn(state.session_id, "answer after restart".into(), |context| {
            assert_eq!(context.recent_turns.len(), MAX_TURNS);
            assert_eq!(context.recent_turns[0].learner, "answer 2");
            assert_eq!(context.earlier_answers, ["answer 0", "answer 1"]);
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

    std::fs::remove_file(path).unwrap();
}

#[test]
fn due_memory_returns_as_a_bounded_later_session_conversation_cue() {
    let path = temporary_database_path();
    let store = SessionStore::open(&path).unwrap();
    let first = store.start().unwrap();
    store
        .send_turn(first.session_id, "I work in there".into(), |_| {
            Ok(turn("I see.", "What do you do?"))
        })
        .unwrap();
    store
        .save_feedback(first.session_id, 1, "I work in there", &sample_feedback())
        .unwrap();
    store
        .save_phrase(
            "The main trade-off was".into(),
            "A way to discuss a decision".into(),
            Some(first.session_id),
            Some(1),
        )
        .unwrap();
    store.finish(first.session_id).unwrap();
    drop(store);

    let db = rusqlite::Connection::open(&path).unwrap();
    db.execute("UPDATE mistakes SET next_review_at = 0", [])
        .unwrap();
    db.execute("UPDATE phrase_cards SET next_review_at = 0", [])
        .unwrap();
    drop(db);

    let later = SessionStore::open(&path).unwrap();
    let second = later.start().unwrap();
    later
        .send_turn(second.session_id, "First answer".into(), |context| {
            assert!(context.learning_targets.is_empty());
            Ok(turn("Thanks.", "What else?"))
        })
        .unwrap();
    drop(later);
    let resumed = SessionStore::open(&path).unwrap();
    resumed
        .send_turn(second.session_id, "Second answer".into(), |context| {
            assert_eq!(context.learning_targets.len(), 2);
            assert_eq!(context.learning_targets[0].kind, "mistake");
            assert_eq!(context.learning_targets[0].target, "I work there");
            assert_eq!(context.learning_targets[1].kind, "phrase");
            assert_eq!(context.learning_targets[1].target, "The main trade-off was");
            Ok(turn("Thanks.", "What else?"))
        })
        .unwrap();
    resumed
        .send_turn(second.session_id, "Third answer".into(), |context| {
            assert!(context.learning_targets.is_empty());
            Ok(turn("Thanks.", "What else?"))
        })
        .unwrap();
    drop(resumed);
    std::fs::remove_file(path).unwrap();
}

#[test]
fn memory_query_failure_does_not_leave_conversation_busy() {
    let path = temporary_database_path();
    let store = SessionStore::open(&path).unwrap();
    let session = store.start().unwrap();
    store
        .send_turn(session.session_id, "First answer".into(), |_| {
            Ok(turn("Thanks.", "What else?"))
        })
        .unwrap();
    rusqlite::Connection::open(&path)
        .unwrap()
        .execute("DROP TABLE phrase_cards", [])
        .unwrap();

    for _ in 0..2 {
        let error = store
            .send_turn(session.session_id, "Second answer".into(), |_| {
                panic!("provider should not run when memory lookup fails")
            })
            .unwrap_err();
        assert_eq!(error.code, ProviderErrorCode::DatabaseError);
    }
    drop(store);
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

#[test]
fn coach_session_lifecycle_target_turns_answer_save_and_continue() {
    let store = SessionStore::default();
    let session = store.start_session(Some(SessionMode::Coach)).unwrap();
    assert_eq!(session.mode, SessionMode::Coach);
    assert_eq!(session.target_turns, COACH_TARGET_TURNS);
    assert_eq!(session.turn_count, 0);
    assert!(session.coach_state.is_none());

    // Save first answer locally without provider
    let saved = store
        .save_coach_answer(session.session_id, "I worked on the migration.".into())
        .unwrap();
    assert_eq!(saved.sequence, 1);
    assert_eq!(saved.answered_question, session.opening_question);
    assert_eq!(saved.original_transcript, "I worked on the migration.");
    assert!(saved.is_pending);

    // Session reflects pending coach answer, question unchanged, turn count 1
    let active = store.get_active().unwrap().unwrap();
    assert_eq!(active.turn_count, 1);
    assert_eq!(active.opening_question, session.opening_question);
    let coach_state = active.coach_state.unwrap();
    assert_eq!(coach_state.sequence, 1);
    assert!(coach_state.is_pending);

    // Continue explicitly generates follow up and updates the turn in place
    let follow_up = store
        .continue_turn(session.session_id, 1, |context| {
            assert_eq!(context.opening_question, session.opening_question);
            assert_eq!(context.latest_transcript, "I worked on the migration.");
            assert!(context.recent_turns.is_empty());
            Ok(turn("Great work.", "What was the main trade-off?"))
        })
        .unwrap();
    assert_eq!(
        follow_up.question.as_deref(),
        Some("What was the main trade-off?")
    );

    // After continue, turn count remains 1, new question is active, no pending answer
    let after_continue = store.get_active().unwrap().unwrap();
    assert_eq!(after_continue.turn_count, 1);
    assert_eq!(
        after_continue.opening_question,
        "What was the main trade-off?"
    );
    let state_after = after_continue.coach_state.unwrap();
    assert_eq!(state_after.sequence, 1);
    assert!(!state_after.is_pending);
}

#[test]
fn persisted_coach_mode_and_pending_state_on_reopen() {
    let path = temporary_database_path();
    let store = SessionStore::open(&path).unwrap();
    let session = store.start_session(Some(SessionMode::Coach)).unwrap();
    store
        .save_coach_answer(session.session_id, "I work in there".into())
        .unwrap();
    store
        .save_feedback(session.session_id, 1, "I work in there", &sample_feedback())
        .unwrap();
    let comparison = store
        .retry_turn(session.session_id, 1, "I work there now".into())
        .unwrap();
    assert_eq!(
        comparison.target_evidence,
        crate::providers::TargetEvidence::NewlyObservedInRetry
    );
    drop(store);

    let reopened = SessionStore::open(&path).unwrap();
    let resumed = reopened.get_active().unwrap().unwrap();
    assert_eq!(resumed.mode, SessionMode::Coach);
    assert_eq!(resumed.target_turns, COACH_TARGET_TURNS);
    assert_eq!(resumed.turn_count, 1);
    assert_eq!(resumed.retry_evidence.len(), 1);
    let coach = resumed.coach_state.unwrap();
    assert_eq!(coach.sequence, 1);
    assert!(coach.is_pending);
    assert_eq!(coach.original_transcript, "I work in there");
    assert!(coach.feedback.is_some());

    let finished = reopened.finish(session.session_id).unwrap();
    assert_eq!(finished.target_turns, COACH_TARGET_TURNS);
    assert_eq!(finished.turn_count, 1);
    std::fs::remove_file(path).unwrap();
}

#[test]
fn legacy_conversation_session_resumes_with_mode_conversation() {
    let path = temporary_database_path();
    let mut db = SessionDatabase::open(&path).unwrap();
    let sid = db.create_session("Legacy question?").unwrap();
    drop(db);

    let store = SessionStore::open(&path).unwrap();
    let resumed = store.get_active().unwrap().unwrap();
    assert_eq!(resumed.session_id, sid);
    assert_eq!(resumed.mode, SessionMode::Conversation);
    assert_eq!(resumed.target_turns, DAILY_TARGET_TURNS);
    std::fs::remove_file(path).unwrap();
}

#[test]
fn conflicting_mode_start_rejected_with_typed_error() {
    let store = SessionStore::default();
    let conv = store
        .start_session(Some(SessionMode::Conversation))
        .unwrap();
    assert_eq!(conv.mode, SessionMode::Conversation);

    // Requesting coach while conversation is active is rejected with typed error
    let err = store.start_session(Some(SessionMode::Coach)).unwrap_err();
    assert_eq!(err.code, ProviderErrorCode::InvalidRequest);
    assert!(err.message.contains("conversation"));
    assert!(err.message.contains("Finish the existing session first"));

    // Requesting conversation again returns the active session
    let resumed = store
        .start_session(Some(SessionMode::Conversation))
        .unwrap();
    assert_eq!(resumed.session_id, conv.session_id);

    // Finish conversation session
    store.finish(conv.session_id).unwrap();

    // Now coach mode can be started
    let coach = store.start_session(Some(SessionMode::Coach)).unwrap();
    assert_eq!(coach.mode, SessionMode::Coach);

    // Requesting conversation while coach is active is rejected
    let err2 = store
        .start_session(Some(SessionMode::Conversation))
        .unwrap_err();
    assert_eq!(err2.code, ProviderErrorCode::InvalidRequest);
    assert!(err2.message.contains("coach"));
}

#[test]
fn failed_continue_preserves_pending_review_and_retry_and_can_be_retried() {
    let store = SessionStore::default();
    let session = store.start_session(Some(SessionMode::Coach)).unwrap();
    store
        .save_coach_answer(session.session_id, "I work in there".into())
        .unwrap();
    store
        .save_feedback(session.session_id, 1, "I work in there", &sample_feedback())
        .unwrap();
    store
        .retry_turn(session.session_id, 1, "I work there now".into())
        .unwrap();

    // Continue provider fails
    let err = store
        .continue_turn(session.session_id, 1, |_| {
            Err(ProviderError::new(ProviderErrorCode::Timeout, "Timeout"))
        })
        .unwrap_err();
    assert_eq!(err.code, ProviderErrorCode::Timeout);

    // Pending answer and all feedback/retry evidence remain completely available
    let active = store.get_active().unwrap().unwrap();
    assert_eq!(active.turn_count, 1);
    assert_eq!(active.retry_evidence.len(), 1);
    let coach = active.coach_state.unwrap();
    assert!(coach.is_pending);
    assert!(coach.feedback.is_some());

    // Retrying continue succeeds and updates the turn without duplicating
    let ok = store
        .continue_turn(session.session_id, 1, |_| {
            Ok(turn("Follow up response.", "Next question?"))
        })
        .unwrap();
    assert_eq!(ok.spoken_reply, "Follow up response.");

    let active_after = store.get_active().unwrap().unwrap();
    assert_eq!(active_after.turn_count, 1);
    assert_eq!(active_after.opening_question, "Next question?");
    assert!(!active_after.coach_state.unwrap().is_pending);
}

#[test]
fn mode_specific_target_and_recall_gates() {
    let store = SessionStore::default();
    let session = store.start_session(Some(SessionMode::Coach)).unwrap();

    for i in 1..=COACH_TARGET_TURNS {
        store
            .save_coach_answer(session.session_id, format!("Answer {i}"))
            .unwrap();
        store
            .continue_turn(session.session_id, i, |_| {
                Ok(turn("Reply.", &format!("Question {}?", i + 1)))
            })
            .unwrap();
    }

    // Daily recall is gated to conversation mode only
    let recall_err = store.daily_recall_plan(session.session_id).unwrap_err();
    assert_eq!(recall_err.code, ProviderErrorCode::InvalidRequest);
    assert!(recall_err.message.contains("conversation"));

    let submit_err = store
        .submit_daily_recall(session.session_id, 1, "transcript".into())
        .unwrap_err();
    assert_eq!(submit_err.code, ProviderErrorCode::InvalidRequest);

    // Finished session uses coach target of 4
    let finished = store.finish(session.session_id).unwrap();
    assert_eq!(finished.target_turns, COACH_TARGET_TURNS);
    assert_eq!(finished.turn_count, COACH_TARGET_TURNS);
}

#[test]
fn typed_ipc_guards_and_state_transitions() {
    let store = SessionStore::default();
    let session = store.start_session(Some(SessionMode::Coach)).unwrap();

    // Normal send_practice_turn is rejected on coach session
    let send_err = store
        .send_turn(session.session_id, "Answer".into(), |_| unreachable!())
        .unwrap_err();
    assert_eq!(send_err.code, ProviderErrorCode::InvalidRequest);

    // Save first answer
    store
        .save_coach_answer(session.session_id, "Answer 1".into())
        .unwrap();

    // Duplicate save while awaiting continue is rejected
    let dup_err = store
        .save_coach_answer(session.session_id, "Duplicate answer".into())
        .unwrap_err();
    assert_eq!(dup_err.code, ProviderErrorCode::InvalidRequest);

    // Continue with stale sequence is rejected
    let stale_err = store
        .continue_turn(session.session_id, 999, |_| unreachable!())
        .unwrap_err();
    assert_eq!(stale_err.code, ProviderErrorCode::InvalidRequest);

    // Continue succeeds
    store
        .continue_turn(session.session_id, 1, |_| Ok(turn("Reply.", "Next?")))
        .unwrap();

    // Continue when no answer is pending is rejected
    let no_pending_err = store
        .continue_turn(session.session_id, 1, |_| unreachable!())
        .unwrap_err();
    assert_eq!(no_pending_err.code, ProviderErrorCode::InvalidRequest);

    // Finish session and test conversation session guards
    store.finish(session.session_id).unwrap();
    let conv = store
        .start_session(Some(SessionMode::Conversation))
        .unwrap();

    // Coach save on conversation session is rejected
    let coach_err = store
        .save_coach_answer(conv.session_id, "Answer".into())
        .unwrap_err();
    assert_eq!(coach_err.code, ProviderErrorCode::InvalidRequest);

    // Coach continue on conversation session is rejected
    let coach_cont_err = store
        .continue_turn(conv.session_id, 1, |_| unreachable!())
        .unwrap_err();
    assert_eq!(coach_cont_err.code, ProviderErrorCode::InvalidRequest);
}

#[test]
fn dialogue_restores_all_saved_turns_and_rejects_finished_or_other_sessions() {
    let path = temporary_database_path();
    let store = SessionStore::open(&path).unwrap();
    let session = store.start().unwrap();
    store
        .send_turn(session.session_id, "First answer".into(), |_| {
            Ok(turn("First reply", "Second question"))
        })
        .unwrap();
    store
        .send_turn(session.session_id, "Second answer".into(), |_| {
            Ok(turn("Second reply", "Third question"))
        })
        .unwrap();
    let dialogue = store.dialogue(session.session_id).unwrap();
    assert_eq!(dialogue.opening_question, session.opening_question);
    assert_eq!(dialogue.turns.len(), 2);
    assert_eq!(dialogue.turns[0].learner, "First answer");
    assert_eq!(dialogue.turns[1].assistant_question, "Third question");
    assert!(store.dialogue(session.session_id + 1).is_err());
    drop(store);
    let reopened = SessionStore::open(&path).unwrap();
    assert_eq!(reopened.dialogue(session.session_id).unwrap(), dialogue);
    reopened.finish(session.session_id).unwrap();
    assert!(reopened.dialogue(session.session_id).is_err());
    std::fs::remove_file(path).unwrap();
}

#[test]
fn dialogue_returns_the_recorded_origin_of_each_reply_after_reopen() {
    let path = temporary_database_path();
    let store = SessionStore::open(&path).unwrap();
    let session = store.start().unwrap();
    store
        .send_turn(session.session_id, "First answer".into(), |_| {
            let mut reply = turn("First reply", "Second question");
            reply.answered_by = Some(crate::providers::AnsweredBy::gemini());
            Ok(reply)
        })
        .unwrap();
    store
        .send_turn(session.session_id, "Second answer".into(), |_| {
            let mut reply = turn("Second reply", "Third question");
            reply.answered_by = Some(crate::providers::AnsweredBy::apple(true));
            Ok(reply)
        })
        .unwrap();
    store
        .send_turn(session.session_id, "Third answer".into(), |_| {
            Ok(turn("Third reply", "Fourth question"))
        })
        .unwrap();
    drop(store);
    let reopened = SessionStore::open(&path).unwrap();
    let dialogue = reopened.dialogue(session.session_id).unwrap();
    assert_eq!(
        dialogue.turns[0].answered_by,
        Some(crate::providers::AnsweredBy::gemini())
    );
    assert_eq!(
        dialogue.turns[1].answered_by,
        Some(crate::providers::AnsweredBy::apple(true))
    );
    assert_eq!(dialogue.turns[2].answered_by, None);
    let json = serde_json::to_value(&dialogue).unwrap();
    assert_eq!(json["turns"][0]["answered_by"]["provider"], "gemini");
    assert_eq!(
        json["turns"][0]["answered_by"]["model"],
        "gemini-3.5-flash-lite"
    );
    assert_eq!(json["turns"][1]["answered_by"]["is_backup"], true);
    assert!(json["turns"][2]["answered_by"].is_null());
    std::fs::remove_file(path).unwrap();
}

#[test]
fn coach_dialogue_shows_saved_answer_before_explicit_continue() {
    let store = SessionStore::default();
    let session = store.start_session(Some(SessionMode::Coach)).unwrap();
    store
        .save_coach_answer_with_source(
            session.session_id,
            "My answer".into(),
            InputSource::Text,
            None,
        )
        .unwrap();
    let dialogue = store.dialogue(session.session_id).unwrap();
    assert_eq!(dialogue.turns.len(), 1);
    assert_eq!(dialogue.input_sources, vec!["text"]);
    assert_eq!(dialogue.turns[0].learner, "My answer");
    assert!(dialogue.turns[0].assistant_reply.is_empty());
    assert!(dialogue.turns[0].assistant_question.is_empty());
}

#[test]
fn text_and_edited_answers_cannot_be_reviewed_as_independent_spoken_evidence() {
    for source in [InputSource::Text, InputSource::Edited] {
        let store = SessionStore::default();
        let session = store.start().unwrap();
        store
            .send_turn_with_source(
                session.session_id,
                "Written answer".into(),
                source,
                None,
                |_| Ok(turn("Thanks", "Next?")),
            )
            .unwrap();
        let error = store
            .review_memory_usage(session.session_id, 1, |_| {
                panic!("Non-voice answers must never reach the assessor")
            })
            .unwrap_err();
        assert_eq!(error.code, ProviderErrorCode::InvalidRequest);
        assert_eq!(
            store.dialogue(session.session_id).unwrap().turns[0].learner,
            "Written answer"
        );
    }
}

#[test]
fn failed_text_send_preserves_session_and_saves_no_provenance_or_turn() {
    let store = SessionStore::default();
    let session = store.start().unwrap();
    assert!(store
        .send_turn_with_source(
            session.session_id,
            "Written answer".into(),
            InputSource::Text,
            None,
            |_| Err(ProviderError::new(ProviderErrorCode::Timeout, "Retry"))
        )
        .is_err());
    assert!(store.dialogue(session.session_id).unwrap().turns.is_empty());
    store
        .send_turn(session.session_id, "Spoken retry".into(), |_| {
            Ok(turn("Thanks", "Next?"))
        })
        .unwrap();
    assert!(store
        .lock()
        .database
        .is_voice_turn(session.session_id, 1)
        .unwrap());
}

#[test]
fn streamed_deltas_reach_the_listener_and_the_complete_turn_is_saved_once() {
    let store = SessionStore::default();
    let session = store.start().unwrap();
    let mut deltas = Vec::new();
    let returned = store
        .send_turn(session.session_id, "I walked a lot.".into(), |_| {
            for piece in ["That sounds ", "healthy. ", "Where did you walk?"] {
                deltas.push(piece.to_string());
                assert_eq!(store.get_active().unwrap().unwrap().turn_count, 0);
            }
            Ok(turn("That sounds healthy.", "Where did you walk?"))
        })
        .unwrap();
    assert_eq!(deltas.concat(), "That sounds healthy. Where did you walk?");
    assert_eq!(returned.question.as_deref(), Some("Where did you walk?"));
    let active = store.get_active().unwrap().unwrap();
    assert_eq!(active.turn_count, 1);
    assert_eq!(active.opening_question, "Where did you walk?");
}

#[test]
fn failure_after_partial_deltas_saves_nothing_and_keeps_the_answer_retryable() {
    let store = SessionStore::default();
    let session = store.start().unwrap();
    let error = store
        .send_turn(session.session_id, "I walked a lot.".into(), |_| {
            assert!(store.lock().active.as_ref().unwrap().turns.is_empty());
            Err(ProviderError::new(ProviderErrorCode::Timeout, "cut off"))
        })
        .unwrap_err();
    assert_eq!(error.code, ProviderErrorCode::Timeout);
    assert_eq!(store.get_active().unwrap().unwrap().turn_count, 0);
    store
        .send_turn(session.session_id, "I walked a lot.".into(), |_| {
            Ok(turn("Nice.", "Why?"))
        })
        .unwrap();
}

#[test]
fn a_reply_without_a_question_becomes_the_prompt_the_learner_answers() {
    let store = SessionStore::default();
    let session = store.start().unwrap();
    store
        .send_turn(session.session_id, "I like tea.".into(), |_| {
            Ok(ConversationTurn {
                question: None,
                ..turn("Tea is lovely. Tell me more.", "")
            })
        })
        .unwrap();
    let active = store.get_active().unwrap().unwrap();
    assert_eq!(active.opening_question, "Tea is lovely. Tell me more.");
    let dialogue = store.dialogue(session.session_id).unwrap();
    assert_eq!(dialogue.turns[0].assistant_question, "");
    assert!(store
        .send_turn(session.session_id, "It is calming.".into(), |context| {
            assert_eq!(
                context.recent_turns[0].assistant_reply,
                "Tea is lovely. Tell me more."
            );
            Ok(turn("Good.", "Why?"))
        })
        .is_ok());
}

fn feedback_for(original: &str, improved: &str, rewrite: &str) -> TurnFeedback {
    TurnFeedback {
        focus_feedback: vec![crate::providers::FocusFeedback {
            category: crate::providers::FocusCategory::Grammar,
            original: original.into(),
            improved: improved.into(),
            explanation: "Use for with a length of time.".into(),
        }],
        b2_rewrite: rewrite.into(),
    }
}

fn answer_with_duration(store: &SessionStore, session_id: u64, text: &str, duration_ms: u64) {
    store
        .send_turn_with_source(
            session_id,
            text.into(),
            InputSource::Voice,
            Some(duration_ms),
            |_| Ok(turn("Thanks.", "Next?")),
        )
        .unwrap();
}

#[test]
fn finished_summary_carries_numbers_trends_phrases_and_recurring_mistakes() {
    let store = SessionStore::default();

    let earlier = store.start().unwrap();
    answer_with_duration(&store, earlier.session_id, &"word ".repeat(50), 25_000);
    store.finish(earlier.session_id).unwrap();

    let current = store.start().unwrap();
    let id = current.session_id;
    answer_with_duration(&store, id, "I am working here since two weeks", 10_000);
    answer_with_duration(&store, id, "I live here since two weeks too", 12_000);
    answer_with_duration(&store, id, "It was fine", 6_000);
    store
        .save_feedback(
            id,
            1,
            "I am working here since two weeks",
            &feedback_for(
                "since two weeks",
                "for two weeks",
                "I have worked here for two weeks.",
            ),
        )
        .unwrap();
    store
        .save_feedback(
            id,
            2,
            "I live here since two weeks too",
            &feedback_for(
                "since two weeks",
                "for two weeks",
                "I have lived here for two weeks.",
            ),
        )
        .unwrap();
    store
        .save_phrase(
            "I have worked here for two weeks.".into(),
            String::new(),
            Some(id),
            Some(1),
        )
        .unwrap();

    let summary = store.finish(id).unwrap();

    assert_eq!(summary.numbers.speaking_time.duration_ms, Some(28_000));
    assert_eq!(
        summary.numbers.speaking_time.trend,
        crate::learning::session_stats::Trend::Percent { change: 12 }
    );
    assert_eq!(summary.numbers.average_answer.words, Some(6));
    assert_eq!(
        summary.numbers.average_answer.trend,
        crate::learning::session_stats::Trend::Words { change: -44 }
    );
    // The rewrite saved earlier is skipped; "for two weeks" appears once although given twice.
    let phrases: Vec<_> = summary
        .phrases
        .iter()
        .map(|p| (p.sequence, p.phrase.as_str()))
        .collect();
    assert_eq!(
        phrases,
        [
            (2, "for two weeks"),
            (2, "I have lived here for two weeks.")
        ]
    );
    assert_eq!(summary.phrases[0].you_said, "since two weeks");
    assert_eq!(
        summary.recurring_mistakes,
        vec![RecurringMistake {
            original: "since two weeks".into(),
            improved: "for two weeks".into(),
            explanation: "Use for with a length of time.".into(),
            times: 2,
        }]
    );
    assert!(summary.duration_ms < 60_000);
}

#[test]
fn finished_summary_without_coaching_has_empty_lists() {
    let store = SessionStore::default();
    let session = store.start().unwrap();
    store
        .send_turn(session.session_id, "Just talking".into(), |_| {
            Ok(turn("Thanks.", "Next?"))
        })
        .unwrap();
    let summary = store.finish(session.session_id).unwrap();
    assert!(summary.phrases.is_empty());
    assert!(summary.recurring_mistakes.is_empty());
    assert_eq!(summary.numbers.speaking_time.duration_ms, None);
}

#[test]
fn deleting_a_phrase_card_removes_it_and_tolerates_stale_or_invalid_ids() {
    let store = SessionStore::default();
    let session = store.start().unwrap();
    store
        .send_turn(session.session_id, "An answer".into(), |_| {
            Ok(turn("Thanks.", "Next?"))
        })
        .unwrap();
    let card = store
        .save_phrase(
            "for two weeks".into(),
            "note".into(),
            Some(session.session_id),
            Some(1),
        )
        .unwrap();
    assert_eq!(store.get_learning_memory().unwrap().phrase_cards.len(), 1);

    assert!(store.delete_phrase(card.id).unwrap());
    assert!(store.get_learning_memory().unwrap().phrase_cards.is_empty());
    // A second removal of the same card, and a card that never existed, change nothing.
    assert!(!store.delete_phrase(card.id).unwrap());
    assert!(!store.delete_phrase(card.id + 100).unwrap());
    assert_eq!(
        store.delete_phrase(0).unwrap_err().code,
        ProviderErrorCode::InvalidRequest
    );

    // The same wording can be saved again after an undo.
    let again = store
        .save_phrase("for two weeks".into(), String::new(), None, None)
        .unwrap();
    assert_ne!(again.id, card.id);
}
