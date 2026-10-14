use super::{review_answers, review_runs};
use crate::conversation::StoredTurn;
use crate::learning::{LearningError, LearningStatus};
use crate::persistence::SessionDatabase;
use crate::providers::{FocusCategory, FocusFeedback, TurnFeedback};

fn finish(db: &mut SessionDatabase, run_id: u64) -> Result<bool, LearningError> {
    review_answers::finish_run(db.connection_mut(), run_id).map(|()| true)
}

fn sample_turn_feedback(category: FocusCategory, improved: &str) -> TurnFeedback {
    TurnFeedback {
        focus_feedback: vec![FocusFeedback {
            category,
            original: "Original text".into(),
            improved: improved.into(),
            explanation: "Explanation note".into(),
        }],
        b2_rewrite: "Stronger rewrite.".into(),
    }
}

#[test]
fn mistake_observation_is_idempotent_for_same_turn_and_increments_for_distinct_turn() {
    let mut db = SessionDatabase::open_in_memory().unwrap();
    let session_id = db.create_session("Opening?").unwrap();
    let turn1 = StoredTurn {
        learner: "I work in there".into(),
        assistant_reply: "Reply".into(),
        assistant_question: "Next?".into(),
        answered_by: None,
    };
    db.save_turn(session_id, 1, &turn1).unwrap();
    let turn2 = StoredTurn {
        learner: "I worked in there".into(),
        assistant_reply: "Reply".into(),
        assistant_question: "Next?".into(),
        answered_by: None,
    };
    db.save_turn(session_id, 2, &turn2).unwrap();

    let feedback = sample_turn_feedback(FocusCategory::Grammar, "I work there");

    db.save_turn_feedback(session_id, 1, &feedback).unwrap();
    let mistake = db.mistake_by_key("grammar:i work there").unwrap().unwrap();
    assert_eq!(mistake.times_seen, 1);

    db.save_turn_feedback(session_id, 1, &feedback).unwrap();
    let mistake_again = db.mistake_by_key("grammar:i work there").unwrap().unwrap();
    assert_eq!(mistake_again.times_seen, 1);

    let feedback2 = sample_turn_feedback(FocusCategory::Grammar, "  I work there.  ");
    db.save_turn_feedback(session_id, 2, &feedback2).unwrap();
    let mistake_after_turn2 = db.mistake_by_key("grammar:i work there").unwrap().unwrap();
    assert_eq!(mistake_after_turn2.times_seen, 2);

    db.save_turn_feedback(session_id, 2, &feedback2).unwrap();
    let mistake_after_turn2_again = db.mistake_by_key("grammar:i work there").unwrap().unwrap();
    assert_eq!(mistake_after_turn2_again.times_seen, 2);
}

#[test]
fn mistake_needs_two_observations_for_learning_surfaces_and_replacement_removes_eligibility() {
    let mut db = SessionDatabase::open_in_memory().unwrap();
    let first = db.create_session("First question?").unwrap();
    let turn = StoredTurn {
        learner: "I work in there".into(),
        assistant_reply: "Reply".into(),
        assistant_question: "Next?".into(),
        answered_by: None,
    };
    db.save_turn(first, 1, &turn).unwrap();
    let original = sample_turn_feedback(FocusCategory::Grammar, "I work there");
    db.save_turn_feedback(first, 1, &original).unwrap();
    let initial = db.mistake_by_key("grammar:i work there").unwrap().unwrap();
    assert_eq!(initial.times_seen, 1);
    db.connection()
        .execute("UPDATE mistakes SET next_review_at = 0", [])
        .unwrap();
    db.save_turn_feedback(first, 1, &original).unwrap();
    assert_eq!(
        db.mistake_by_key("grammar:i work there")
            .unwrap()
            .unwrap()
            .times_seen,
        1
    );
    assert!(db.get_learning_memory().unwrap().mistakes.is_empty());
    assert!(review_runs::start_run(db.connection_mut(), false)
        .unwrap()
        .is_none());
    db.finish_session(first).unwrap();

    let second = db.create_session("Second question?").unwrap();
    db.save_turn(second, 1, &turn).unwrap();
    assert!(db.due_learning_targets(second).unwrap().is_empty());
    db.save_turn_feedback(second, 1, &original).unwrap();
    let repeated = db.mistake_by_key("grammar:i work there").unwrap().unwrap();
    assert_eq!(repeated.times_seen, 2);
    db.connection()
        .execute("UPDATE mistakes SET next_review_at = 0", [])
        .unwrap();
    let memory = db.get_learning_memory().unwrap();
    assert_eq!(memory.mistakes.len(), 1);
    assert!(memory.mistakes[0].is_due);
    let targets = db.due_learning_targets(second).unwrap();
    assert_eq!(targets.len(), 1);
    assert_eq!(targets[0].kind, "mistake");
    let run = review_runs::start_run(db.connection_mut(), false)
        .unwrap()
        .unwrap();
    assert_eq!(run.items.len(), 1);
    assert_eq!(run.items[0].item_id, repeated.id);
    finish(&mut db, run.run_id).unwrap();

    let replacement = sample_turn_feedback(FocusCategory::Grammar, "I work at that location");
    db.save_turn_feedback(second, 1, &replacement).unwrap();
    let old = db.mistake_by_key("grammar:i work there").unwrap().unwrap();
    assert_eq!(old.times_seen, 1);
    db.connection()
        .execute("UPDATE mistakes SET next_review_at = 0", [])
        .unwrap();
    assert!(db.get_learning_memory().unwrap().mistakes.is_empty());
    assert!(db
        .due_learning_targets(second)
        .unwrap()
        .iter()
        .all(|target| target.kind != "mistake"));
    assert!(review_runs::start_run(db.connection_mut(), false)
        .unwrap()
        .is_none());
}

#[test]
fn changing_feedback_for_a_turn_replaces_its_single_mistake_observation() {
    let mut db = SessionDatabase::open_in_memory().unwrap();
    let session_id = db.create_session("Opening?").unwrap();
    db.save_turn(
        session_id,
        1,
        &StoredTurn {
            learner: "I work there".into(),
            assistant_reply: "Reply".into(),
            assistant_question: "Next?".into(),
            answered_by: None,
        },
    )
    .unwrap();
    db.save_turn_feedback(
        session_id,
        1,
        &sample_turn_feedback(FocusCategory::Grammar, "I work at there"),
    )
    .unwrap();
    db.save_turn_feedback(
        session_id,
        1,
        &sample_turn_feedback(FocusCategory::Grammar, "I work in that place"),
    )
    .unwrap();

    let old = db
        .mistake_by_key("grammar:i work at there")
        .unwrap()
        .unwrap();
    let replacement = db
        .mistake_by_key("grammar:i work in that place")
        .unwrap()
        .unwrap();
    assert_eq!(old.times_seen, 0);
    assert_eq!(old.status, LearningStatus::Archived);
    assert_eq!(replacement.times_seen, 1);

    db.save_turn_feedback(
        session_id,
        1,
        &sample_turn_feedback(FocusCategory::Grammar, "I work in that place."),
    )
    .unwrap();
    assert_eq!(
        db.mistake_by_key("grammar:i work in that place")
            .unwrap()
            .unwrap()
            .times_seen,
        1
    );
}

#[test]
fn conversation_feedback_relapse_uses_turn_time_and_revalidates_replacements() {
    let mut db = SessionDatabase::open_in_memory().unwrap();
    let first = db
        .create_session_with_mode("conversation", "First question?")
        .unwrap();
    db.save_turn(
        first,
        1,
        &StoredTurn {
            learner: "I said bad wording.".into(),
            assistant_reply: "Thanks.".into(),
            assistant_question: "Next?".into(),
            answered_by: None,
        },
    )
    .unwrap();
    let initial_feedback = TurnFeedback {
        focus_feedback: vec![FocusFeedback {
            category: FocusCategory::Grammar,
            original: "bad wording".into(),
            improved: "good wording".into(),
            explanation: "Correction.".into(),
        }],
        b2_rewrite: "I chose better words.".into(),
    };
    db.save_turn_feedback(first, 1, &initial_feedback).unwrap();
    db.finish_session(first).unwrap();
    let mistake = db.mistake_by_key("grammar:good wording").unwrap().unwrap();
    db.connection()
        .execute(
            "UPDATE mistakes SET status = 'stable' WHERE id = ?1",
            [mistake.id as i64],
        )
        .unwrap();

    let recurrence = db
        .create_session_with_mode("conversation", "Another question?")
        .unwrap();
    db.save_turn(
        recurrence,
        1,
        &StoredTurn {
            learner: "I used very bad wording again.".into(),
            assistant_reply: "I understand.".into(),
            assistant_question: "Why?".into(),
            answered_by: None,
        },
    )
    .unwrap();
    let turn_time: i64 = db
        .connection()
        .query_row(
            "SELECT created_at FROM turns WHERE session_id = ?1 AND sequence = 1",
            [recurrence as i64],
            |row| row.get(0),
        )
        .unwrap();
    let feedback = TurnFeedback {
        focus_feedback: vec![FocusFeedback {
            category: FocusCategory::Grammar,
            original: "bad wording".into(),
            improved: "good wording".into(),
            explanation: "Correction.".into(),
        }],
        b2_rewrite: "I selected better words.".into(),
    };
    db.save_turn_feedback(recurrence, 1, &feedback).unwrap();
    let relapse: (String, i64, String) = db
        .connection()
        .query_row(
            "SELECT outcome, original_turn_time, exact_excerpt FROM learning_usage_events
             WHERE item_id = ?1 AND origin = 'feedback'",
            [mistake.id as i64],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )
        .unwrap();
    assert_eq!(
        relapse,
        ("incorrect".into(), turn_time, "bad wording".into())
    );

    db.save_turn_feedback(recurrence, 1, &feedback).unwrap();
    let count: i64 = db
        .connection()
        .query_row(
            "SELECT COUNT(*) FROM learning_usage_events WHERE item_id = ?1 AND origin = 'feedback'",
            [mistake.id as i64],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(count, 1);

    let changed = TurnFeedback {
        focus_feedback: vec![FocusFeedback {
            category: FocusCategory::Grammar,
            original: "very bad wording".into(),
            improved: "good wording".into(),
            explanation: "Updated correction.".into(),
        }],
        b2_rewrite: "I selected much better words.".into(),
    };
    db.save_turn_feedback(recurrence, 1, &changed).unwrap();
    let replacement: (i64, String) = db
        .connection()
        .query_row(
            "SELECT original_turn_time, exact_excerpt FROM learning_usage_events
             WHERE item_id = ?1 AND origin = 'feedback'",
            [mistake.id as i64],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .unwrap();
    assert_eq!(replacement, (turn_time, "very bad wording".into()));

    let explanation_change = TurnFeedback {
        focus_feedback: vec![FocusFeedback {
            category: FocusCategory::Grammar,
            original: "very bad wording".into(),
            improved: "good wording".into(),
            explanation: "More specific explanation.".into(),
        }],
        b2_rewrite: "I selected much better words indeed.".into(),
    };
    db.save_turn_feedback(recurrence, 1, &explanation_change)
        .unwrap();
    let count: i64 = db
        .connection()
        .query_row(
            "SELECT COUNT(*) FROM learning_usage_events WHERE item_id = ?1 AND origin = 'feedback'",
            [mistake.id as i64],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(count, 1);

    let ungrounded = TurnFeedback {
        focus_feedback: vec![FocusFeedback {
            category: FocusCategory::Grammar,
            original: "bad phrased".into(),
            improved: "good wording".into(),
            explanation: "Ungrounded wording.".into(),
        }],
        b2_rewrite: "I selected much better words indeed.".into(),
    };
    db.save_turn_feedback(recurrence, 1, &ungrounded).unwrap();
    let count: i64 = db
        .connection()
        .query_row(
            "SELECT COUNT(*) FROM learning_usage_events WHERE item_id = ?1 AND origin = 'feedback'",
            [mistake.id as i64],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(count, 0);
}

#[test]
fn removing_a_turn_correction_archives_its_observation_until_it_recurs() {
    let mut db = SessionDatabase::open_in_memory().unwrap();
    let session_id = db.create_session("Opening?").unwrap();
    for sequence in 1..=2 {
        db.save_turn(
            session_id,
            sequence,
            &StoredTurn {
                learner: "I work in there".into(),
                assistant_reply: "Reply".into(),
                assistant_question: "Next?".into(),
                answered_by: None,
            },
        )
        .unwrap();
    }
    let correction = sample_turn_feedback(FocusCategory::Grammar, "I work there");
    db.save_turn_feedback(session_id, 1, &correction).unwrap();
    db.save_turn_feedback(
        session_id,
        1,
        &TurnFeedback {
            focus_feedback: vec![],
            b2_rewrite: "I work there".into(),
        },
    )
    .unwrap();

    let old = db.mistake_by_key("grammar:i work there").unwrap().unwrap();
    assert_eq!(old.times_seen, 0);
    assert_eq!(old.status, LearningStatus::Archived);
    let memory = db.get_learning_memory().unwrap();
    assert!(memory.mistakes.is_empty());
    assert_eq!(memory.due_count, 0);

    db.save_turn_feedback(session_id, 2, &correction).unwrap();
    let revived = db.mistake_by_key("grammar:i work there").unwrap().unwrap();
    assert_eq!(revived.times_seen, 1);
    assert_eq!(revived.status, LearningStatus::New);
}

#[test]
fn typed_and_edited_feedback_does_not_create_spoken_mastery_relapse() {
    for source in ["text", "edited"] {
        let mut db = SessionDatabase::open_in_memory().unwrap();
        let first = db.create_session("Opening?").unwrap();
        let turn = StoredTurn {
            learner: "Original text".into(),
            assistant_reply: "Thanks".into(),
            assistant_question: "Next?".into(),
            answered_by: None,
        };
        let feedback = sample_turn_feedback(FocusCategory::Grammar, "Improved text");
        db.save_turn(first, 1, &turn).unwrap();
        db.save_turn_feedback(first, 1, &feedback).unwrap();
        db.finish_session(first).unwrap();
        db.connection()
            .execute("UPDATE mistakes SET status = 'stable'", [])
            .unwrap();
        let second = db.create_session("Another opening?").unwrap();
        db.save_turn_with_source(second, 1, &turn, source).unwrap();
        db.save_turn_feedback(second, 1, &feedback).unwrap();
        assert_eq!(
            db.mistake_by_key("grammar:improved text")
                .unwrap()
                .unwrap()
                .status,
            LearningStatus::Stable
        );
        let events: i64 = db
            .connection()
            .query_row(
                "SELECT COUNT(*) FROM learning_usage_events WHERE origin = 'feedback'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(events, 0);
    }
}
