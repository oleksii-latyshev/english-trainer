use english_trainer_lib::{
    ConversationContext, ConversationTurn, InputSource, PracticeMode, PracticePhase, ProviderError,
    SessionStore, StartPracticeOptions,
};
use std::sync::atomic::{AtomicUsize, Ordering};

fn temporary_database_path() -> std::path::PathBuf {
    static NEXT_PATH: AtomicUsize = AtomicUsize::new(0);
    let index = NEXT_PATH.fetch_add(1, Ordering::Relaxed);
    std::env::temp_dir().join(format!(
        "english-trainer-f11-pipeline-{}-{index}.sqlite3",
        std::process::id()
    ))
}

fn generated(question: &str) -> ConversationTurn {
    ConversationTurn {
        spoken_reply: "A fast reply.".into(),
        question: Some(question.into()),
        session_phase: "active".into(),
        is_complete: false,
        provider_latency_ms: Some(12),
        first_token_ms: Some(4),
        answered_by: None,
    }
}

#[test]
fn write_then_speak_runs_through_a_real_database_and_reopens_at_the_saved_phase() {
    let path = temporary_database_path();
    let store = SessionStore::open(&path).unwrap();
    let started = store
        .start_practice_session(Some(StartPracticeOptions {
            practice_mode: Some(PracticeMode::WriteThenSpeak),
            ..Default::default()
        }))
        .unwrap();
    assert_eq!(started.practice_phase, PracticePhase::Writing);

    let first = store
        .send_turn_with_source(
            started.session_id,
            "Written response one".into(),
            InputSource::Text,
            None,
            |context: &ConversationContext| -> Result<ConversationTurn, ProviderError> {
                assert!(!context.opening_question.is_empty());
                Ok(generated("Original follow-up?"))
            },
        )
        .unwrap();
    assert_eq!(first.question.as_deref(), Some("Original follow-up?"));
    store
        .send_turn_with_source(
            started.session_id,
            "Written response two".into(),
            InputSource::Text,
            None,
            |_| Ok(generated("Later question?")),
        )
        .unwrap();
    store
        .transition_practice_phase(started.session_id, PracticePhase::WritingReview)
        .unwrap();
    store
        .transition_practice_phase(started.session_id, PracticePhase::Speaking)
        .unwrap();
    store
        .send_turn_with_source(
            started.session_id,
            "Spoken response one".into(),
            InputSource::Voice,
            Some(1_000),
            |_| panic!("the replay stage does not call the conversation provider"),
        )
        .unwrap();
    drop(store);

    let restored = SessionStore::open(&path).unwrap();
    let snapshot = restored.get_active().unwrap().unwrap();
    assert_eq!(snapshot.practice_mode, PracticeMode::WriteThenSpeak);
    assert_eq!(snapshot.practice_phase, PracticePhase::Speaking);
    assert_eq!(snapshot.written_turn_count, 2);
    assert_eq!(snapshot.spoken_turn_count, 1);
    assert_eq!(snapshot.turn_count, 3);
    assert_eq!(snapshot.opening_question, "Original follow-up?");
    drop(restored);
    let _ = std::fs::remove_file(path);
}
