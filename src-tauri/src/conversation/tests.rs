use super::rules::{MAX_CONTEXT_CHARS, MAX_TURNS, OPENING_QUESTION};
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

fn write_then_speak_options() -> StartPracticeOptions {
    StartPracticeOptions {
        practice_mode: Some(PracticeMode::WriteThenSpeak),
        ..Default::default()
    }
}

fn mistake_plan(
    mistake_id: u64,
) -> Vec<crate::learning::mistake_practice::GeneratedMistakeQuestion> {
    [
        "What kind of projects do you enjoy most?",
        "Which task would you choose for a free afternoon?",
        "What work have you found especially satisfying lately?",
        "How do you decide which project to take on next?",
        "What would make your ideal workday memorable?",
    ]
    .into_iter()
    .map(
        |question| crate::learning::mistake_practice::GeneratedMistakeQuestion {
            mistake_id,
            question: question.into(),
        },
    )
    .collect()
}

fn seed_practice_mistake(store: &SessionStore) -> u64 {
    store
        .lock()
        .database
        .seed_recurring_mistake("I work in there", "I work there", 2, 20)
        .unwrap()
}

#[test]
fn mistake_practice_requires_candidates_without_calling_the_provider() {
    let store = SessionStore::default();
    let called = std::cell::Cell::new(false);
    let error = store
        .start_mistake_practice(|_| {
            called.set(true);
            Ok(mistake_plan(1))
        })
        .unwrap_err();
    assert_eq!(error.code, ProviderErrorCode::InvalidRequest);
    assert!(!called.get());
    assert_eq!(store.get_active().unwrap(), None);
}

#[test]
fn mistake_practice_saves_and_restores_five_cued_voice_questions() {
    let path = temporary_database_path();
    let store = SessionStore::open(&path).unwrap();
    let mistake_id = seed_practice_mistake(&store);
    let started = store
        .start_mistake_practice(|_| Ok(mistake_plan(mistake_id)))
        .unwrap();
    assert!(started.is_mistake_practice);
    assert_eq!(started.target_turns, 5);
    assert_eq!(started.topic_label, "Usual mistakes");
    assert_eq!(started.duration_goal_seconds, 300);
    assert_eq!(started.practice_phase, PracticePhase::Speaking);
    assert!(store
        .lock()
        .database
        .has_session_wide_cue_exposure(started.session_id)
        .unwrap());

    let text_error = store
        .send_turn_with_source(
            started.session_id,
            "Typed answer".into(),
            InputSource::Text,
            None,
            |_| panic!("mistake practice must not call the conversation provider"),
        )
        .unwrap_err();
    assert_eq!(text_error.code, ProviderErrorCode::InvalidRequest);
    let first = store
        .send_turn_with_source(
            started.session_id,
            "I enjoy complex projects.".into(),
            InputSource::Voice,
            Some(900),
            |_| panic!("mistake practice must bypass the conversation provider"),
        )
        .unwrap();
    assert_eq!(
        first.question.as_deref(),
        Some("Which task would you choose for a free afternoon?")
    );
    assert_eq!(first.answered_by, None);
    assert_eq!(
        store
            .lock()
            .database
            .coaching_queue(started.session_id)
            .unwrap()[0]
            .question,
        started.opening_question
    );
    drop(store);

    let resumed = SessionStore::open(&path).unwrap();
    let active = resumed.get_active().unwrap().unwrap();
    assert!(active.is_mistake_practice);
    assert_eq!(active.turn_count, 1);
    assert_eq!(
        active.opening_question,
        "Which task would you choose for a free afternoon?"
    );
    for (index, transcript) in [
        "I like building tools.",
        "I chose a hard task.",
        "I learned a lot.",
        "I plan the next one.",
    ]
    .into_iter()
    .enumerate()
    {
        let result = resumed
            .send_turn_with_source(
                active.session_id,
                transcript.into(),
                InputSource::Edited,
                None,
                |_| panic!("mistake practice must bypass the conversation provider"),
            )
            .unwrap();
        if index == 0 {
            let queued = resumed
                .lock()
                .database
                .coaching_queue(active.session_id)
                .unwrap();
            assert_eq!(
                queued[1].question,
                "Which task would you choose for a free afternoon?"
            );
        }
        if index == 3 {
            assert!(result.is_complete);
            assert_eq!(result.question, None);
            assert_eq!(
                resumed.get_active().unwrap().unwrap().opening_question,
                "You have finished all five questions. You can finish this practice."
            );
        }
    }
    let extra = resumed
        .send_turn_with_source(
            active.session_id,
            "Sixth answer.".into(),
            InputSource::Voice,
            None,
            |_| unreachable!(),
        )
        .unwrap_err();
    assert_eq!(extra.code, ProviderErrorCode::InvalidRequest);
    let summary = resumed.finish(active.session_id).unwrap();
    assert!(summary.is_mistake_practice);
    assert_eq!(summary.target_turns, 5);
    std::fs::remove_file(path).unwrap();
}

#[test]
fn mistake_practice_generation_failure_can_be_retried_and_targets_are_rechecked() {
    let store = SessionStore::default();
    let mistake_id = seed_practice_mistake(&store);
    let failed = store.start_mistake_practice(|_| {
        Err(ProviderError::new(ProviderErrorCode::RateLimited, "retry"))
    });
    assert_eq!(failed.unwrap_err().code, ProviderErrorCode::RateLimited);
    assert_eq!(store.get_active().unwrap(), None);

    let archived = store.clone();
    let error = store
        .start_mistake_practice(move |_| {
            archived
                .archive_learning_item(crate::learning::LearningItemType::Mistake, mistake_id)
                .unwrap();
            Ok(mistake_plan(mistake_id))
        })
        .unwrap_err();
    assert_eq!(error.code, ProviderErrorCode::InvalidRequest);
    assert_eq!(store.get_active().unwrap(), None);
    assert_eq!(store.lock().database.session_count().unwrap(), 0);
}

#[test]
fn mistake_practice_rejects_another_session_and_a_concurrent_preparation() {
    let store = SessionStore::default();
    let ordinary = store.start().unwrap();
    let called = std::cell::Cell::new(false);
    let error = store
        .start_mistake_practice(|_| {
            called.set(true);
            Ok(mistake_plan(1))
        })
        .unwrap_err();
    assert_eq!(error.code, ProviderErrorCode::Busy);
    assert!(!called.get());
    store.finish(ordinary.session_id).unwrap();
    let mistake_id = seed_practice_mistake(&store);
    store.lock().mistake_practice_preparing = true;
    let normal = store.start_practice_session(None).unwrap_err();
    assert_eq!(normal.code, ProviderErrorCode::Busy);
    let drill = store
        .start_mistake_practice(|_| {
            called.set(true);
            Ok(mistake_plan(mistake_id))
        })
        .unwrap_err();
    assert_eq!(drill.code, ProviderErrorCode::Busy);
    assert!(!called.get());
    store.lock().mistake_practice_preparing = false;
}

#[test]
fn mistake_practice_database_failure_clears_preparation_and_rolls_back() {
    let store = SessionStore::default();
    let mistake_id = seed_practice_mistake(&store);
    store.lock().database.reject_mistake_practice_cue().unwrap();
    let error = store
        .start_mistake_practice(|_| Ok(mistake_plan(mistake_id)))
        .unwrap_err();
    assert_eq!(error.code, ProviderErrorCode::DatabaseError);
    assert_eq!(store.lock().database.session_count().unwrap(), 0);
    // The failed preparation released its guard, so an ordinary session can start immediately.
    assert!(store.start_practice_session(None).is_ok());
}

#[test]
fn the_answer_context_follows_the_conversation() {
    let store = SessionStore::default();
    let session = store.start().unwrap();
    store
        .send_turn(session.session_id, "We use Vercel.".into(), |_| {
            Ok(turn("Next?", "Follow up?"))
        })
        .unwrap();
    let context = store.answer_context().unwrap();
    assert_eq!(context.question, "Follow up?");
    assert_eq!(context.recent_answers, ["We use Vercel."]);
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
fn practice_start_options_persist_and_active_reopen_starts_paused() {
    let path = temporary_database_path();
    let store = SessionStore::open(&path).unwrap();
    let session = store
        .start_practice_session(Some(StartPracticeOptions {
            practice_mode: None,
            topic_id: Some(topics::TOPIC_PLANS_STORIES.into()),
            topic_custom: None,
            duration_goal_seconds: Some(300),
        }))
        .unwrap();
    assert_eq!(session.topic_id, topics::TOPIC_PLANS_STORIES);
    assert_eq!(session.topic_label, "Plans & stories");
    assert_eq!(session.duration_goal_seconds, 300);
    assert_eq!(session.active_duration_ms, 0);
    assert!(!session.is_clock_running);
    store.set_practice_clock(session.session_id, true).unwrap();
    let anchor = Instant::now();
    store.lock().active.as_mut().unwrap().clock_anchor = Some(anchor);
    super::lifecycle::checkpoint_clock_at(
        &mut store.lock(),
        session.session_id,
        anchor + Duration::from_secs(2),
    )
    .unwrap();
    let checkpoint = store.set_practice_clock(session.session_id, false).unwrap();
    assert_eq!(checkpoint.active_duration_ms, 2_000);
    drop(store);

    let sqlite = rusqlite::Connection::open(&path).unwrap();
    sqlite
        .execute(
            "UPDATE sessions SET started_at = started_at - 600000 WHERE id = ?1",
            [session.session_id as i64],
        )
        .unwrap();
    drop(sqlite);

    let reopened = SessionStore::open(&path).unwrap();
    let resumed = reopened.get_active().unwrap().unwrap();
    assert_eq!(resumed.topic_id, session.topic_id);
    assert_eq!(resumed.topic_label, session.topic_label);
    assert_eq!(resumed.duration_goal_seconds, 300);
    assert_eq!(resumed.active_duration_ms, checkpoint.active_duration_ms);
    assert!(!resumed.is_clock_running);
    assert_eq!(
        reopened.get_active().unwrap().unwrap().active_duration_ms,
        checkpoint.active_duration_ms
    );
    let finished = reopened.finish(session.session_id).unwrap();
    assert_eq!(finished.duration_ms, 2_000);
    assert_eq!(finished.topic_label, "Plans & stories");
    assert_eq!(finished.duration_goal_seconds, 300);
    std::fs::remove_file(path).unwrap();
}

#[test]
fn finishing_a_new_session_keeps_its_zero_active_duration() {
    let store = SessionStore::default();
    let session = store
        .start_practice_session(Some(StartPracticeOptions {
            practice_mode: None,
            topic_id: Some(topics::TOPIC_DAILY_LIFE.into()),
            topic_custom: None,
            duration_goal_seconds: Some(600),
        }))
        .unwrap();
    let finished = store.finish(session.session_id).unwrap();
    assert_eq!(finished.duration_ms, 0);
}

#[test]
fn write_then_speak_replays_saved_questions_without_calling_generator_and_records_exposure() {
    use std::sync::atomic::{AtomicBool, Ordering};

    let path = temporary_database_path();
    let store = SessionStore::open(&path).unwrap();
    let session = store
        .start_practice_session(Some(write_then_speak_options()))
        .unwrap();
    let opening = session.opening_question.clone();
    let writing_snapshot = store.get_active().unwrap().unwrap();
    assert_eq!(writing_snapshot.practice_phase, PracticePhase::Writing);
    assert_eq!(writing_snapshot.written_turn_count, 0);
    assert_eq!(writing_snapshot.spoken_turn_count, 0);
    store
        .send_turn_with_source(
            session.session_id,
            "Written answer one".into(),
            InputSource::Text,
            None,
            |_| Ok(turn("A short reply.", "What would you add?")),
        )
        .unwrap();
    store
        .send_turn_with_source(
            session.session_id,
            "Written answer two".into(),
            InputSource::Text,
            None,
            |_| Ok(turn("Another reply.", "A later question?")),
        )
        .unwrap();
    let reviewed = store
        .transition_practice_phase(session.session_id, PracticePhase::WritingReview)
        .unwrap();
    assert_eq!(reviewed.written_turn_count, 2);
    assert_eq!(reviewed.spoken_turn_count, 0);
    let speaking = store
        .transition_practice_phase(session.session_id, PracticePhase::Speaking)
        .unwrap();
    assert_eq!(speaking.opening_question, opening);
    assert_eq!(speaking.practice_phase, PracticePhase::Speaking);

    let generator_called = AtomicBool::new(false);
    let replay_one = store
        .send_turn_with_source(
            session.session_id,
            "Spoken answer one".into(),
            InputSource::Voice,
            Some(1_250),
            |_| {
                generator_called.store(true, Ordering::SeqCst);
                Ok(turn("wrong", "wrong"))
            },
        )
        .unwrap();
    assert!(!generator_called.load(Ordering::SeqCst));
    assert_eq!(replay_one.question.as_deref(), Some("What would you add?"));
    assert!(replay_one.answered_by.is_none());
    let replay_two = store
        .send_turn_with_source(
            session.session_id,
            "Spoken answer two".into(),
            InputSource::Edited,
            Some(900),
            |_| panic!("replay must bypass the conversation generator"),
        )
        .unwrap();
    assert!(replay_two.is_complete);
    assert!(replay_two.question.is_none());

    let dialogue = store.dialogue(session.session_id).unwrap();
    assert_eq!(dialogue.opening_question, opening);
    assert_eq!(dialogue.turns.len(), 4);
    assert_eq!(dialogue.input_sources, ["text", "text", "voice", "edited"]);
    assert_eq!(
        dialogue.answer_durations_ms,
        [None, None, Some(1_250), Some(900)]
    );
    let waiting = store
        .lock()
        .database
        .coaching_queue(session.session_id)
        .unwrap();
    assert_eq!(waiting[2].question, opening);
    assert_eq!(waiting[3].question, "What would you add?");
    let connection = rusqlite::Connection::open(&path).unwrap();
    let broad_exposures: i64 = connection
        .query_row(
            "SELECT COUNT(*) FROM session_cue_exposures WHERE session_id = ?1 AND item_type IS NULL AND item_id IS NULL",
            [session.session_id as i64],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(broad_exposures, 1);
    drop(connection);
    drop(store);
    let _ = std::fs::remove_file(path);
}

#[test]
fn write_then_speak_rejects_wrong_sources_reviews_and_skipped_transitions_without_mutation() {
    let store = SessionStore::default();
    let session = store
        .start_practice_session(Some(write_then_speak_options()))
        .unwrap();
    let called = std::cell::Cell::new(false);
    let rejected = store.send_turn_with_source(
        session.session_id,
        "Typed is required here".into(),
        InputSource::Voice,
        None,
        |_| {
            called.set(true);
            Ok(turn("Reply", "Question?"))
        },
    );
    assert!(rejected.is_err());
    assert!(!called.get());
    assert!(store
        .transition_practice_phase(session.session_id, PracticePhase::Speaking)
        .is_err());
    assert_eq!(
        store.get_active().unwrap().unwrap().practice_phase,
        PracticePhase::Writing
    );

    assert!(store
        .send_turn_with_source(
            session.session_id,
            "First answer".into(),
            InputSource::Text,
            None,
            |_| { Err(ProviderError::new(ProviderErrorCode::Unavailable, "retry")) }
        )
        .is_err());
    let after_provider_error = store.get_active().unwrap().unwrap();
    assert_eq!(after_provider_error.turn_count, 0);
    assert_eq!(after_provider_error.practice_phase, PracticePhase::Writing);
    store
        .send_turn_with_source(
            session.session_id,
            "First answer".into(),
            InputSource::Text,
            None,
            |_| Ok(turn("Reply", "Follow-up?")),
        )
        .unwrap();
    store
        .transition_practice_phase(session.session_id, PracticePhase::WritingReview)
        .unwrap();
    assert!(store
        .send_turn_with_source(
            session.session_id,
            "Not during review".into(),
            InputSource::Text,
            None,
            |_| { panic!("review phases must reject answers before generation") }
        )
        .is_err());
    assert!(store.set_practice_clock(session.session_id, true).is_err());
    let after_guard = store.get_active().unwrap().unwrap();
    assert_eq!(after_guard.practice_phase, PracticePhase::WritingReview);
    assert_eq!(after_guard.turn_count, 1);
}

#[test]
fn phase_transition_during_provider_request_is_busy_and_preserves_the_in_flight_session() {
    let store = SessionStore::default();
    let session = store
        .start_practice_session(Some(write_then_speak_options()))
        .unwrap();
    let during_generation = store.clone();
    let attempted_transition = std::cell::RefCell::new(None);
    store
        .send_turn_with_source(
            session.session_id,
            "Writing while the model responds".into(),
            InputSource::Text,
            None,
            |_| {
                *attempted_transition.borrow_mut() = Some(
                    during_generation
                        .transition_practice_phase(session.session_id, PracticePhase::WritingReview)
                        .unwrap_err()
                        .code,
                );
                Ok(turn("Reply", "Next?"))
            },
        )
        .unwrap();
    assert_eq!(
        attempted_transition.into_inner(),
        Some(ProviderErrorCode::Busy)
    );
    let active = store.get_active().unwrap().unwrap();
    assert_eq!(active.practice_phase, PracticePhase::Writing);
    assert_eq!(active.turn_count, 1);
    assert_eq!(active.spoken_turn_count, 0);
}

#[test]
fn early_finish_while_writing_reports_the_written_answers_and_no_spoken_answers() {
    let store = SessionStore::default();
    let session = store
        .start_practice_session(Some(write_then_speak_options()))
        .unwrap();
    store
        .send_turn_with_source(
            session.session_id,
            "Written answer before finishing early".into(),
            InputSource::Text,
            None,
            |_| Ok(turn("Reply", "Follow-up?")),
        )
        .unwrap();
    let finished = store.finish(session.session_id).unwrap();
    assert_eq!(finished.practice_phase, PracticePhase::Writing);
    assert_eq!(finished.written_turn_count, 1);
    assert_eq!(finished.spoken_turn_count, 0);
}

#[test]
fn failed_speaking_transition_rolls_back_phase_and_replay_exposure_together() {
    let path = temporary_database_path();
    let store = SessionStore::open(&path).unwrap();
    let session = store
        .start_practice_session(Some(write_then_speak_options()))
        .unwrap();
    store
        .send_turn_with_source(
            session.session_id,
            "Written answer".into(),
            InputSource::Text,
            None,
            |_| Ok(turn("Reply", "Follow-up?")),
        )
        .unwrap();
    store
        .transition_practice_phase(session.session_id, PracticePhase::WritingReview)
        .unwrap();
    let connection = rusqlite::Connection::open(&path).unwrap();
    connection
        .execute_batch(
            "CREATE TRIGGER reject_replay_exposure BEFORE INSERT ON session_cue_exposures
             BEGIN SELECT RAISE(ABORT, 'blocked for transaction test'); END;",
        )
        .unwrap();
    drop(connection);

    assert!(store
        .transition_practice_phase(session.session_id, PracticePhase::Speaking)
        .is_err());
    let active = store.get_active().unwrap().unwrap();
    assert_eq!(active.practice_phase, PracticePhase::WritingReview);
    assert_eq!(active.written_turn_count, 1);
    let connection = rusqlite::Connection::open(&path).unwrap();
    let (phase, exposure_count): (String, i64) = connection
        .query_row(
            "SELECT practice_phase, (SELECT COUNT(*) FROM session_cue_exposures WHERE session_id = ?1) FROM sessions WHERE id = ?1",
            [session.session_id as i64],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .unwrap();
    assert_eq!(phase, "writing_review");
    assert_eq!(exposure_count, 0);
    drop(connection);
    drop(store);
    let _ = std::fs::remove_file(path);
}

#[test]
fn write_then_speak_restores_next_original_question_and_final_completion_state() {
    let path = temporary_database_path();
    let store = SessionStore::open(&path).unwrap();
    let session = store
        .start_practice_session(Some(write_then_speak_options()))
        .unwrap();
    store
        .send_turn_with_source(
            session.session_id,
            "Written one".into(),
            InputSource::Text,
            None,
            |_| Ok(turn("Reply", "Original follow-up?")),
        )
        .unwrap();
    store
        .send_turn_with_source(
            session.session_id,
            "Written two".into(),
            InputSource::Text,
            None,
            |_| Ok(turn("Reply", "Later follow-up?")),
        )
        .unwrap();
    store
        .transition_practice_phase(session.session_id, PracticePhase::WritingReview)
        .unwrap();
    store
        .transition_practice_phase(session.session_id, PracticePhase::Speaking)
        .unwrap();
    store
        .send_turn_with_source(
            session.session_id,
            "Spoken one".into(),
            InputSource::Voice,
            Some(500),
            |_| panic!("replay must bypass the conversation generator"),
        )
        .unwrap();
    drop(store);

    let reopened = SessionStore::open(&path).unwrap();
    let resumed = reopened.get_active().unwrap().unwrap();
    assert_eq!(resumed.practice_phase, PracticePhase::Speaking);
    assert_eq!(resumed.practice_mode, PracticeMode::WriteThenSpeak);
    assert_eq!(resumed.written_turn_count, 2);
    assert_eq!(resumed.spoken_turn_count, 1);
    assert_eq!(resumed.turn_count, 3);
    assert_eq!(resumed.opening_question, "Original follow-up?");
    reopened
        .send_turn_with_source(
            session.session_id,
            "Spoken two".into(),
            InputSource::Voice,
            Some(600),
            |_| panic!("replay must bypass the conversation generator"),
        )
        .unwrap();
    let complete = reopened.get_active().unwrap().unwrap();
    assert_eq!(
        complete.opening_question,
        "The spoken replay is complete. Review your answers."
    );
    assert_eq!(complete.spoken_turn_count, 2);
    assert!(reopened
        .send_turn_with_source(
            session.session_id,
            "Extra answer".into(),
            InputSource::Voice,
            None,
            |_| { panic!("completed replay must reject extra answers") }
        )
        .is_err());
    let reviewed = reopened
        .transition_practice_phase(session.session_id, PracticePhase::SpeakingReview)
        .unwrap();
    assert_eq!(reviewed.practice_phase, PracticePhase::SpeakingReview);
    assert_eq!(
        reviewed.opening_question,
        "The spoken replay is complete. Review your answers."
    );
    drop(reopened);
    let reviewed_after_restart = SessionStore::open(&path).unwrap();
    let snapshot = reviewed_after_restart.get_active().unwrap().unwrap();
    assert_eq!(snapshot.practice_phase, PracticePhase::SpeakingReview);
    assert_eq!(snapshot.written_turn_count, 2);
    assert_eq!(snapshot.spoken_turn_count, 2);
    assert_eq!(snapshot.turn_count, 4);
    assert_eq!(
        snapshot.opening_question,
        "The spoken replay is complete. Review your answers."
    );
    assert!(reviewed_after_restart
        .send_turn_with_source(
            session.session_id,
            "No turn in review".into(),
            InputSource::Voice,
            None,
            |_| panic!("review phase rejects answers before generation")
        )
        .is_err());
    drop(reviewed_after_restart);
    let _ = std::fs::remove_file(path);
}

#[test]
fn standalone_text_chat_keeps_written_answers_and_can_finish_from_review() {
    let store = SessionStore::default();
    let session = store
        .start_practice_session(Some(StartPracticeOptions {
            practice_mode: Some(PracticeMode::TextChat),
            ..Default::default()
        }))
        .unwrap();
    assert_eq!(session.practice_phase, PracticePhase::Writing);
    assert!(store
        .send_turn_with_source(
            session.session_id,
            "Typed answer".into(),
            InputSource::Text,
            None,
            |_| { Ok(turn("Reply", "Next?")) }
        )
        .is_ok());
    assert!(store
        .send_turn_with_source(
            session.session_id,
            "Voice answer".into(),
            InputSource::Voice,
            None,
            |_| { panic!("text chat accepts text input only") }
        )
        .is_err());
    store
        .transition_practice_phase(session.session_id, PracticePhase::WritingReview)
        .unwrap();
    let finished = store.finish(session.session_id).unwrap();
    assert_eq!(finished.practice_mode, PracticeMode::TextChat);
    assert_eq!(finished.practice_phase, PracticePhase::WritingReview);
    assert_eq!(finished.written_turn_count, 1);
    assert_eq!(finished.spoken_turn_count, 0);
}

#[test]
fn profiles_persist_clear_and_merge_with_the_manual_glossary() {
    let store = SessionStore::default();
    store
        .save_glossary_terms(vec!["ManualTerm".into(), "Rust".into()])
        .unwrap();
    let saved = store
        .save_personal_profile(PersonalProfile {
            role: "  Engineer  ".into(),
            stack: "Rust, Tauri".into(),
            interests: "Tauri, hiking".into(),
            goals: "Speak more naturally".into(),
        })
        .unwrap();
    assert_eq!(saved.role, "Engineer");
    assert_eq!(store.personal_profile().unwrap(), saved);
    assert_eq!(
        store.effective_glossary_terms().unwrap(),
        ["ManualTerm", "Rust", "Engineer", "Tauri", "hiking"]
    );
    store
        .save_personal_profile(PersonalProfile::default())
        .unwrap();
    assert_eq!(
        store.effective_glossary_terms().unwrap(),
        ["ManualTerm", "Rust"]
    );
    assert!(store
        .save_personal_profile(PersonalProfile {
            role: "x".repeat(151),
            ..Default::default()
        })
        .is_err());
}

#[test]
fn migration_from_version_fourteen_keeps_sessions_turns_glossary_and_retry_evidence() {
    let path = temporary_database_path();
    let mut db = SessionDatabase::open(&path).unwrap();
    let sid = db.create_session("Legacy opening?").unwrap();
    db.save_turn(
        sid,
        1,
        &StoredTurn {
            learner: "A retained answer".into(),
            assistant_reply: "Thanks.".into(),
            assistant_question: "Tell me more?".into(),
            answered_by: None,
        },
    )
    .unwrap();
    db.replace_glossary_terms(&["Manual glossary term".into()])
        .unwrap();
    let evidence =
        crate::providers::compare_attempts(1, "I work in there", "I work there", "I work there");
    db.save_comparison(sid, &evidence).unwrap();
    drop(db);

    let legacy = rusqlite::Connection::open(&path).unwrap();
    for column in [
        "active_duration_ms",
        "duration_goal_seconds",
        "topic_custom",
        "topic_label",
        "topic_id",
    ] {
        legacy
            .execute_batch(&format!("ALTER TABLE sessions DROP COLUMN {column};"))
            .unwrap();
    }
    legacy.pragma_update(None, "user_version", 14).unwrap();
    drop(legacy);

    let store = SessionStore::open(&path).unwrap();
    let resumed = store.get_active().unwrap().unwrap();
    assert_eq!(resumed.session_id, sid);
    assert_eq!(resumed.topic_id, topics::TOPIC_FREE_CONVERSATION);
    assert_eq!(resumed.topic_label, "Free conversation");
    assert_eq!(resumed.duration_goal_seconds, 600);
    assert_eq!(resumed.active_duration_ms, 0);
    assert_eq!(
        store.dialogue(sid).unwrap().turns[0].learner,
        "A retained answer"
    );
    assert_eq!(store.glossary_terms().unwrap(), ["Manual glossary term"]);
    assert_eq!(resumed.retry_evidence, [evidence]);
    std::fs::remove_file(path).unwrap();
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
    assert!(memory1.mistakes.is_empty());
    assert_eq!(
        store
            .lock()
            .database
            .mistake_by_key("grammar:i work there")
            .unwrap()
            .unwrap()
            .times_seen,
        1
    );

    // Saving feedback again for turn 1 does NOT increment times_seen (idempotent)
    store
        .save_feedback(session.session_id, 1, "I work in there", &feedback1)
        .unwrap();
    let memory1_again = store.get_learning_memory().unwrap();
    assert!(memory1_again.mistakes.is_empty());

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
        .send_turn(first.session_id, "I work in there again".into(), |_| {
            Ok(turn("I see.", "What changed?"))
        })
        .unwrap();
    store
        .save_feedback(
            first.session_id,
            2,
            "I work in there again",
            &sample_feedback(),
        )
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
fn a_session_saved_before_modes_were_merged_resumes_as_the_one_mode() {
    let path = temporary_database_path();
    let mut db = SessionDatabase::open(&path).unwrap();
    let sid = db.create_session("Legacy question?").unwrap();
    drop(db);

    let store = SessionStore::open(&path).unwrap();
    let resumed = store.get_active().unwrap().unwrap();
    assert_eq!(resumed.session_id, sid);
    assert_eq!(resumed.target_turns, DAILY_TARGET_TURNS);
    std::fs::remove_file(path).unwrap();
}

#[test]
fn an_open_coach_session_with_a_saved_unanswered_answer_continues_as_a_talk_session() {
    let path = temporary_database_path();
    let mut db = SessionDatabase::open(&path).unwrap();
    let sid = db
        .create_session_with_mode("coach", "What did you build?")
        .unwrap();
    // Coach saved the answer first and asked Eva only on Continue, so the reply is still empty.
    let unanswered = StoredTurn {
        learner: "I work in there".into(),
        assistant_reply: String::new(),
        assistant_question: String::new(),
        answered_by: None,
    };
    db.save_turn(sid, 1, &unanswered).unwrap();
    db.save_turn_feedback(sid, 1, &sample_feedback()).unwrap();
    db.save_comparison(
        sid,
        &crate::providers::compare_attempts(
            1,
            "I work in there",
            "I work there now",
            "I work there",
        ),
    )
    .unwrap();
    drop(db);

    let store = SessionStore::open(&path).unwrap();
    let resumed = store.get_active().unwrap().unwrap();
    assert_eq!(resumed.session_id, sid);
    assert_eq!(resumed.turn_count, 1);
    assert_eq!(resumed.target_turns, DAILY_TARGET_TURNS);
    assert_eq!(resumed.opening_question, "What did you build?");
    assert_eq!(resumed.retry_evidence.len(), 1);
    let dialogue = store.dialogue(sid).unwrap();
    assert!(matches!(dialogue.coaching[0], TurnCoaching::Ready { .. }));

    // The next answer is a normal Talk turn that gets a reply right away.
    store
        .send_turn(sid, "I build services".into(), |context| {
            assert_eq!(context.opening_question, "What did you build?");
            Ok(turn("Nice.", "Which ones?"))
        })
        .unwrap();
    assert_eq!(store.get_active().unwrap().unwrap().turn_count, 2);
    assert_eq!(
        store
            .coaching_queue(sid)
            .unwrap()
            .iter()
            .map(|answer| answer.sequence)
            .collect::<Vec<_>>(),
        [2]
    );
    std::fs::remove_file(path).unwrap();
}

#[test]
fn the_dialogue_says_where_the_coaching_of_each_answer_stands() {
    let store = SessionStore::default();
    let session = store.start().unwrap();
    for text in ["I work in there", "Second", "Third"] {
        store
            .send_turn(session.session_id, text.into(), |_| Ok(turn("Ok.", "And?")))
            .unwrap();
    }
    store
        .save_feedback(session.session_id, 1, "I work in there", &sample_feedback())
        .unwrap();
    store
        .record_coaching_failures(session.session_id, &[2])
        .unwrap();
    store
        .record_coaching_failures(session.session_id, &[3, 3])
        .unwrap();

    let coaching = store.dialogue(session.session_id).unwrap().coaching;
    assert!(matches!(coaching[0], TurnCoaching::Ready { .. }));
    assert_eq!(
        coaching[1],
        TurnCoaching::Pending,
        "one failure leaves a retry"
    );
    assert_eq!(coaching[2], TurnCoaching::Failed);
    assert_eq!(
        store
            .coaching_queue(session.session_id)
            .unwrap()
            .iter()
            .map(|answer| (answer.sequence, answer.failed_attempts))
            .collect::<Vec<_>>(),
        [(2, 1)]
    );
}

#[test]
fn coaching_is_saved_for_a_finished_session_only_for_the_answer_it_belongs_to() {
    let store = SessionStore::default();
    let session = store.start().unwrap();
    store
        .send_turn(session.session_id, "I work in there".into(), |_| {
            Ok(turn("Ok.", "And?"))
        })
        .unwrap();
    store.finish(session.session_id).unwrap();
    assert!(store
        .save_feedback(session.session_id, 1, "Another answer", &sample_feedback())
        .is_err());
    store
        .save_feedback(session.session_id, 1, "I work in there", &sample_feedback())
        .unwrap();
    assert!(store
        .session_wrapup(session.session_id)
        .unwrap()
        .phrases
        .is_empty());
    assert!(store.coaching_queue(session.session_id).unwrap().is_empty());
    assert_eq!(
        store
            .lock()
            .database
            .mistake_by_key("grammar:i work there")
            .unwrap()
            .unwrap()
            .times_seen,
        1
    );
    let open = store.start().unwrap();
    assert!(store.session_wrapup(open.session_id).is_err());
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

    let pending = store.finish(id).unwrap();
    assert_eq!(pending.wrapup_preparation, WrapupPreparation::Pending);
    assert!(pending.phrases.is_empty());
    let (_, request) = store.next_wrapup_request().unwrap().unwrap();
    // The earlier session is also pending: complete it before selecting the current snapshot.
    store
        .complete_session_wrapup(
            earlier.session_id,
            &request,
            Ok(crate::providers::WrapupResult {
                phrases: Vec::new(),
            }),
        )
        .unwrap();
    let (_, request) = store.next_wrapup_request().unwrap().unwrap();
    let generated = crate::providers::WrapupResult {
        phrases: vec![
            crate::providers::GeneratedWrapupPhrase {
                sequence: 1,
                phrase: "I have worked here for two weeks.".into(),
                note: "Describe an ongoing situation.".into(),
                you_said: "since two weeks".into(),
            },
            crate::providers::GeneratedWrapupPhrase {
                sequence: 2,
                phrase: "for two weeks".into(),
                note: "Use for with a length of time.".into(),
                you_said: "since two weeks".into(),
            },
            crate::providers::GeneratedWrapupPhrase {
                sequence: 2,
                phrase: "I have lived here for two weeks.".into(),
                note: "Describe where you have been living.".into(),
                you_said: "I live here since two weeks too".into(),
            },
        ],
    };
    store
        .complete_session_wrapup(id, &request, Ok(generated))
        .unwrap();
    let summary = store.session_wrapup(id).unwrap();

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
