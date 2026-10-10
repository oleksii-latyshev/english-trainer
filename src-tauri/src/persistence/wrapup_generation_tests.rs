use super::*;
use crate::conversation::WrapupPhrase;
use crate::providers::{GeneratedWrapupPhrase, ProviderErrorCode, WrapupRequest};

fn setup() -> (SessionDatabase, u64) {
    let mut db = SessionDatabase::open_in_memory().unwrap();
    let id = db.create_session("What changed?").unwrap();
    db.save_turn(
        id,
        1,
        &super::super::StoredTurn {
            learner: "I share progress early".into(),
            assistant_reply: "Thanks.".into(),
            assistant_question: "What comes next?".into(),
            answered_by: None,
        },
    )
    .unwrap();
    (db, id)
}

fn phrase(text: &str) -> WrapupPhrase {
    WrapupPhrase {
        sequence: 1,
        phrase: text.into(),
        note: "Use this when giving an update.".into(),
        you_said: "share progress early".into(),
    }
}

#[test]
fn finish_and_job_insertion_roll_back_together() {
    let (mut db, id) = setup();
    db.connection.execute_batch("CREATE TRIGGER reject_wrapup BEFORE INSERT ON session_wrapups BEGIN SELECT RAISE(ABORT, 'test failure'); END;").unwrap();
    assert!(db.finish_session_with_duration(id, 50).is_err());
    assert_eq!(db.active_session().unwrap().unwrap().id, id);
    assert!(db.wrapup_record(id).unwrap().is_none());
    db.connection
        .execute_batch("DROP TRIGGER reject_wrapup;")
        .unwrap();
    assert!(db.finish_session_with_duration(id, 50).unwrap());
    assert!(!db.finish_session_with_duration(id, 50).unwrap());
    assert_eq!(db.next_wrapup_id().unwrap(), Some(id));
}

#[test]
fn batch_save_rolls_back_all_cards_and_reports_only_new_ids() {
    let (db, id) = setup();
    let existing = db
        .save_phrase_card("share progress early", "Existing note", Some(id), Some(1))
        .unwrap();
    db.connection.execute_batch("CREATE TRIGGER reject_second BEFORE INSERT ON phrase_cards WHEN NEW.phrase = 'keep people informed' BEGIN SELECT RAISE(ABORT, 'test failure'); END;").unwrap();
    assert!(db
        .save_wrapup_phrase_cards(
            id,
            &[
                phrase("give a quick update"),
                phrase("keep people informed")
            ]
        )
        .is_err());
    assert_eq!(db.get_learning_memory().unwrap().phrase_cards.len(), 1);
    db.connection
        .execute_batch("DROP TRIGGER reject_second;")
        .unwrap();
    let saved = db
        .save_wrapup_phrase_cards(
            id,
            &[
                phrase("share progress early"),
                phrase("give a quick update"),
            ],
        )
        .unwrap();
    assert_eq!(saved.cards[0].id, existing.id);
    assert_eq!(saved.created_ids, vec![saved.cards[1].id]);
    assert_eq!(saved.cards[0].meaning_or_note, "Existing note");
}

#[test]
fn legacy_failed_and_ready_retry_rules_and_late_results_are_persisted() {
    let (mut db, id) = setup();
    assert!(!db.retry_wrapup(id).unwrap());
    db.finish_session(id).unwrap();
    assert!(db.retry_wrapup(id).unwrap());
    assert!(!db.retry_wrapup(id).unwrap());
    let error = ProviderError::new(ProviderErrorCode::RateLimited, "Try later.");
    assert!(db.complete_wrapup(id, &Err(error.clone())).unwrap());
    assert!(
        matches!(db.wrapup_record(id).unwrap(), Some(PreparedWrapup::Failed(value)) if value == error)
    );
    assert!(db.retry_wrapup(id).unwrap());
    let result = WrapupResult {
        phrases: vec![GeneratedWrapupPhrase {
            sequence: 1,
            phrase: "share progress early".into(),
            note: "Use this to describe proactive updates.".into(),
            you_said: "share progress early".into(),
        }],
    };
    assert!(db.complete_wrapup(id, &Ok(result.clone())).unwrap());
    assert!(!db
        .complete_wrapup(
            id,
            &Ok(WrapupResult {
                phrases: Vec::new()
            })
        )
        .unwrap());
    assert!(!db.retry_wrapup(id).unwrap());
    assert!(
        matches!(db.wrapup_record(id).unwrap(), Some(PreparedWrapup::Ready(value)) if value == result)
    );
}

#[test]
fn spoken_rehearsal_reuses_written_questions_in_the_bounded_snapshot() {
    let (mut db, id) = setup();
    db.connection.execute("UPDATE sessions SET practice_mode = 'write_then_speak', written_turn_count = 2 WHERE id = ?1", [to_sql_id(id).unwrap()]).unwrap();
    for sequence in 2..=4 {
        db.save_turn(
            id,
            sequence,
            &super::super::StoredTurn {
                learner: "A second answer".into(),
                assistant_reply: "Thanks.".into(),
                assistant_question: format!("Question after {sequence}?"),
                answered_by: None,
            },
        )
        .unwrap();
    }
    let answers = db.wrapup_answers(id).unwrap();
    assert_eq!(answers[0].question, "What changed?");
    assert_eq!(answers[1].question, "What comes next?");
    assert_eq!(answers[2].question, "What changed?");
    assert_eq!(answers[3].question, "What comes next?");
}

#[test]
fn long_sessions_send_only_bounded_recent_excerpts_without_changing_saved_answers() {
    let (mut db, id) = setup();
    let long_answer = "word ".repeat(400);
    for sequence in 2..=31 {
        db.save_turn(
            id,
            sequence,
            &super::super::StoredTurn {
                learner: long_answer.clone(),
                assistant_reply: "Thanks.".into(),
                assistant_question: "question ".repeat(100),
                answered_by: None,
            },
        )
        .unwrap();
    }
    let answers = db.wrapup_answers(id).unwrap();
    assert_eq!(answers.len(), 8);
    assert_eq!(answers[0].sequence, 24);
    assert_eq!(answers[7].sequence, 31);
    assert_eq!(
        answers
            .iter()
            .map(|answer| answer.transcript.chars().count())
            .sum::<usize>(),
        12_000
    );
    for answer in &answers {
        assert_eq!(answer.transcript.chars().count(), 1500);
        assert_eq!(answer.question.chars().count(), 500);
        assert!(long_answer.starts_with(&answer.transcript));
    }
    WrapupRequest { answers }.validate().unwrap();
    assert_eq!(db.turns(id).unwrap()[30].learner, long_answer);
}
