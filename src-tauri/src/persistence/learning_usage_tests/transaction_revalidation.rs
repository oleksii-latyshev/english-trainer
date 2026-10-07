use super::*;
use crate::learning::{UsageCandidate, UsageEventRecord};
use crate::persistence::learning_usage::UsageAssessmentCommit;
use crate::providers::UsageReviewRequest;

pub(super) struct PreparedTurn {
    pub(super) db: SessionDatabase,
    pub(super) session_id: u64,
    pub(super) sequence: usize,
    pub(super) mistake_id: u64,
    pub(super) turn_time: i64,
    pub(super) request: UsageReviewRequest,
}

pub(super) fn prepared_turn(sequence: usize) -> PreparedTurn {
    let mut db = SessionDatabase::open_in_memory().unwrap();
    let source = db
        .create_session_with_mode("conversation", "Tell me about your day.")
        .unwrap();
    db.save_turn(
        source,
        1,
        &StoredTurn {
            learner: "I used bad wording and work in tandem yesterday.".into(),
            assistant_reply: "I see.".into(),
            assistant_question: "Next?".into(),
            answered_by: None,
        },
    )
    .unwrap();
    db.save_turn_feedback(
        source,
        1,
        &TurnFeedback {
            focus_feedback: vec![FocusFeedback {
                category: FocusCategory::Grammar,
                original: "bad wording".into(),
                improved: "good wording".into(),
                explanation: "Correction.".into(),
            }],
            b2_rewrite: "I used better words yesterday.".into(),
        },
    )
    .unwrap();
    let phrase = db
        .save_phrase_card("work in tandem", "Together", Some(source), Some(1))
        .unwrap();
    db.finish_session(source).unwrap();
    let mistake = db.mistake_by_key("grammar:good wording").unwrap().unwrap();
    let occurrence_time: i64 = db
        .connection
        .query_row(
            "SELECT created_at FROM mistake_occurrences WHERE mistake_id = ?1",
            [mistake.id as i64],
            |row| row.get(0),
        )
        .unwrap();
    db.connection
        .execute(
            "UPDATE phrase_cards SET created_at = ?1 WHERE id = ?2",
            rusqlite::params![occurrence_time, phrase.id as i64],
        )
        .unwrap();

    let session_id = db
        .create_session_with_mode("conversation", "A separate question.")
        .unwrap();
    db.connection
        .execute(
            "UPDATE sessions SET started_at = ?1 WHERE id = ?2",
            rusqlite::params![occurrence_time + 1, session_id as i64],
        )
        .unwrap();
    if sequence == 1 {
        db.save_turn(
            session_id,
            1,
            &StoredTurn {
                learner: "I used good wording and work in tandem today.".into(),
                assistant_reply: "Thanks.".into(),
                assistant_question: "What happened next?".into(),
                answered_by: None,
            },
        )
        .unwrap();
    } else {
        db.save_turn(
            session_id,
            1,
            &StoredTurn {
                learner: "A first answer.".into(),
                assistant_reply: "Go on.".into(),
                assistant_question: "What did you do?".into(),
                answered_by: None,
            },
        )
        .unwrap();
        db.save_turn(
            session_id,
            2,
            &StoredTurn {
                learner: "I used good wording and work in tandem today.".into(),
                assistant_reply: "Thanks.".into(),
                assistant_question: "Anything else?".into(),
                answered_by: None,
            },
        )
        .unwrap();
    }
    let prepared = db
        .prepare_usage_review(session_id, sequence)
        .unwrap()
        .unwrap();
    assert!(!prepared.request.candidates.is_empty());
    PreparedTurn {
        db,
        session_id,
        sequence,
        mistake_id: mistake.id,
        turn_time: prepared.turn_time,
        request: prepared.request,
    }
}

#[derive(Debug, PartialEq, Eq)]
struct Snapshot {
    status: String,
    interval: u32,
    due: i64,
    counter: i64,
    assessments: i64,
    events: i64,
}

fn snapshot(turn: &PreparedTurn) -> Snapshot {
    turn.db
        .connection
        .query_row(
            "SELECT status, interval_days, next_review_at, times_correct_afterwards,
                (SELECT COUNT(*) FROM turn_usage_assessments),
                (SELECT COUNT(*) FROM learning_usage_events)
             FROM mistakes WHERE id = ?1",
            [turn.mistake_id as i64],
            |row| {
                Ok(Snapshot {
                    status: row.get(0)?,
                    interval: row.get(1)?,
                    due: row.get(2)?,
                    counter: row.get(3)?,
                    assessments: row.get(4)?,
                    events: row.get(5)?,
                })
            },
        )
        .unwrap()
}

fn reject_stale_request(mut turn: PreparedTurn, mutate: impl FnOnce(&mut PreparedTurn)) {
    mutate(&mut turn);
    let before = snapshot(&turn);
    let assessment = TurnUsageAssessment {
        session_id: turn.session_id,
        sequence: turn.sequence,
        assessed_at: turn.turn_time + 10,
        findings: Vec::new(),
    };
    let result = turn
        .db
        .save_turn_usage_assessment(UsageAssessmentCommit {
            session_id: turn.session_id,
            sequence: turn.sequence,
            request: &turn.request,
            turn_time: turn.turn_time,
            assessment,
            events: &[],
            active_session_id: None,
        })
        .unwrap();
    assert!(result.is_none());
    assert_eq!(snapshot(&turn), before);
}

#[test]
fn commit_rejects_changed_question_candidate_status_feedback_and_prior_exposure() {
    reject_stale_request(prepared_turn(1), |turn| {
        turn.db
            .connection
            .execute(
                "UPDATE sessions SET opening_question = 'Changed question.' WHERE id = ?1",
                [turn.session_id as i64],
            )
            .unwrap();
    });
    reject_stale_request(prepared_turn(1), |turn| {
        turn.db
            .connection
            .execute(
                "UPDATE mistakes SET corrected_example = 'better wording' WHERE id = ?1",
                [turn.mistake_id as i64],
            )
            .unwrap();
    });
    reject_stale_request(prepared_turn(1), |turn| {
        turn.db
            .connection
            .execute(
                "UPDATE mistakes SET status = 'archived' WHERE id = ?1",
                [turn.mistake_id as i64],
            )
            .unwrap();
    });
    reject_stale_request(prepared_turn(2), |turn| {
        let feedback = TurnFeedback {
            focus_feedback: Vec::new(),
            b2_rewrite: "good wording".into(),
        };
        turn.db
            .connection
            .execute(
                "INSERT INTO turn_feedback (session_id, sequence, feedback_json) VALUES (?1, 1, ?2)",
                rusqlite::params![
                    turn.session_id as i64,
                    serde_json::to_string(&feedback).unwrap()
                ],
            )
            .unwrap();
    });
    reject_stale_request(prepared_turn(1), |turn| {
        turn.db
            .record_session_cue_exposure(
                turn.session_id,
                Some("mistake"),
                Some(turn.mistake_id),
                turn.turn_time - 1,
            )
            .unwrap();
    });
}

#[test]
fn exposure_write_failure_rolls_back_assessment_event_counter_and_projection() {
    let mut turn = prepared_turn(1);
    let candidate: &UsageCandidate = &turn.request.candidates[0];
    turn.db
        .connection
        .execute(
            "UPDATE mistakes SET times_correct_afterwards = 7 WHERE id = ?1",
            [turn.mistake_id as i64],
        )
        .unwrap();
    turn.db
        .connection
        .execute(
            "INSERT INTO learning_usage_counter_baselines (item_id, baseline_count) VALUES (?1, 7)",
            [turn.mistake_id as i64],
        )
        .unwrap();
    turn.db
        .connection
        .execute_batch(
            "CREATE TRIGGER reject_usage_exposure BEFORE INSERT ON session_cue_exposures
             BEGIN SELECT RAISE(ABORT, 'forced exposure failure'); END;",
        )
        .unwrap();
    let event = UsageEventRecord {
        id: 0,
        item_type: candidate.item_type,
        item_id: candidate.item_id,
        session_id: turn.session_id,
        sequence: turn.sequence,
        origin: "assessment".into(),
        original_turn_time: turn.turn_time,
        outcome: UsageOutcome::Correct,
        exact_excerpt: candidate.target.clone(),
        confidence: 0.95,
        created_at: turn.turn_time + 10,
    };
    let assessment = TurnUsageAssessment {
        session_id: turn.session_id,
        sequence: turn.sequence,
        assessed_at: turn.turn_time + 10,
        findings: vec![UsageAssessmentFinding {
            item_type: candidate.item_type,
            item_id: candidate.item_id,
            target: candidate.target.clone(),
            outcome: UsageOutcome::Correct,
            confidence: 0.95,
            exact_excerpt: candidate.target.clone(),
            credited: true,
            status_after: LearningStatus::New,
        }],
    };
    let before = snapshot(&turn);
    assert!(turn
        .db
        .save_turn_usage_assessment(UsageAssessmentCommit {
            session_id: turn.session_id,
            sequence: turn.sequence,
            request: &turn.request,
            turn_time: turn.turn_time,
            assessment,
            events: std::slice::from_ref(&event),
            active_session_id: Some(turn.session_id),
        })
        .is_err());
    assert_eq!(snapshot(&turn), before);
}
