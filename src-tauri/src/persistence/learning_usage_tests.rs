#[path = "learning_usage_tests/candidate_migration.rs"]
mod candidate_migration;
#[path = "learning_usage_tests/transaction_exposure.rs"]
mod transaction_exposure;
#[path = "learning_usage_tests/transaction_revalidation.rs"]
mod transaction_revalidation;
#[path = "learning_usage_tests/transaction_setup.rs"]
mod transaction_setup;

use super::*;
use crate::learning::{
    LearningItemType, LearningStatus, TurnUsageAssessment, UsageAssessmentFinding,
    UsageEventRecord, UsageOutcome,
};
use crate::persistence::learning_usage::UsageAssessmentCommit;
use crate::providers::{FocusCategory, FocusFeedback, TurnFeedback};

#[test]
fn saves_assessment_events_and_updates_mistake_counters_and_status() {
    let transaction_setup::UsageFixture {
        mut db,
        sid2,
        request,
        event,
        saved,
        mistake_id,
        turn_time,
        occurrence_time,
    } = transaction_setup::setup_usage_fixture();
    db.connection
        .execute(
            "UPDATE mistakes SET interval_days = 2, next_review_at = ?1 WHERE id = ?2",
            rusqlite::params![
                turn_time + 20 * crate::learning::MS_PER_DAY,
                mistake_id as i64
            ],
        )
        .unwrap();
    db.finish_session(sid2).unwrap();
    let sid3 = db
        .create_session_with_mode("conversation", "Tell me more.")
        .unwrap();
    db.connection
        .execute(
            "UPDATE sessions SET started_at = ?1 WHERE id = ?2",
            rusqlite::params![occurrence_time + 1, sid3 as i64],
        )
        .unwrap();
    let turn3 = StoredTurn {
        learner: "I used good phrasing again.".into(),
        assistant_reply: "Thanks.".into(),
        assistant_question: "Why?".into(),
    };
    db.save_turn(sid3, 1, &turn3).unwrap();
    let turn3_time = turn_time + 7 * crate::learning::MS_PER_DAY;
    db.connection
        .execute(
            "UPDATE turns SET created_at = ?1 WHERE session_id = ?2 AND sequence = 1",
            rusqlite::params![turn3_time, sid3 as i64],
        )
        .unwrap();
    let request3 = crate::providers::UsageReviewRequest {
        answered_question: "Tell me more.".into(),
        transcript: turn3.learner,
        candidates: request.candidates.clone(),
    };
    let assessment3 = TurnUsageAssessment {
        session_id: sid3,
        sequence: 1,
        assessed_at: turn3_time + 100,
        findings: vec![UsageAssessmentFinding {
            item_type: LearningItemType::Mistake,
            item_id: mistake_id,
            target: "good phrasing".into(),
            outcome: UsageOutcome::Correct,
            confidence: 0.95,
            exact_excerpt: "good phrasing".into(),
            credited: true,
            status_after: LearningStatus::Learning,
        }],
    };
    let event3 = UsageEventRecord {
        id: 0,
        item_type: LearningItemType::Mistake,
        item_id: mistake_id,
        session_id: sid3,
        sequence: 1,
        origin: "assessment".into(),
        original_turn_time: turn3_time,
        outcome: UsageOutcome::Correct,
        exact_excerpt: "good phrasing".into(),
        confidence: 0.95,
        created_at: turn3_time + 100,
    };
    db.save_turn_usage_assessment(UsageAssessmentCommit {
        session_id: sid3,
        sequence: 1,
        request: &request3,
        turn_time: turn3_time,
        assessment: assessment3,
        events: &[event3],
        active_session_id: None,
    })
    .unwrap()
    .unwrap();
    let after_positive: (i64, u32, i64) = db.connection.query_row(
        "SELECT times_correct_afterwards, interval_days, next_review_at FROM mistakes WHERE id = ?1",
        [mistake_id as i64],
        |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
    ).unwrap();
    assert_eq!(
        after_positive,
        (5, 2, turn_time + 20 * crate::learning::MS_PER_DAY)
    );

    db.finish_session(sid3).unwrap();
    let sid4 = db
        .create_session_with_mode("conversation", "How does it sound?")
        .unwrap();
    db.connection
        .execute(
            "UPDATE sessions SET started_at = ?1 WHERE id = ?2",
            rusqlite::params![occurrence_time + 1, sid4 as i64],
        )
        .unwrap();
    let turn4 = StoredTurn {
        learner: "That was bad wording again.".into(),
        assistant_reply: "I understand.".into(),
        assistant_question: "Next?".into(),
    };
    db.save_turn(sid4, 1, &turn4).unwrap();
    let turn4_time = turn_time + 8 * crate::learning::MS_PER_DAY;
    db.connection
        .execute(
            "UPDATE turns SET created_at = ?1 WHERE session_id = ?2 AND sequence = 1",
            rusqlite::params![turn4_time, sid4 as i64],
        )
        .unwrap();
    let request4 = crate::providers::UsageReviewRequest {
        answered_question: "How does it sound?".into(),
        transcript: turn4.learner,
        candidates: request.candidates.clone(),
    };
    let assessment4 = TurnUsageAssessment {
        session_id: sid4,
        sequence: 1,
        assessed_at: turn4_time + 100,
        findings: vec![UsageAssessmentFinding {
            item_type: LearningItemType::Mistake,
            item_id: mistake_id,
            target: "good phrasing".into(),
            outcome: UsageOutcome::Incorrect,
            confidence: 0.95,
            exact_excerpt: "bad wording".into(),
            credited: true,
            status_after: LearningStatus::Learning,
        }],
    };
    let event4 = UsageEventRecord {
        id: 0,
        item_type: LearningItemType::Mistake,
        item_id: mistake_id,
        session_id: sid4,
        sequence: 1,
        origin: "assessment".into(),
        original_turn_time: turn4_time,
        outcome: UsageOutcome::Incorrect,
        exact_excerpt: "bad wording".into(),
        confidence: 0.95,
        created_at: turn4_time + 100,
    };
    db.save_turn_usage_assessment(UsageAssessmentCommit {
        session_id: sid4,
        sequence: 1,
        request: &request4,
        turn_time: turn4_time,
        assessment: assessment4,
        events: &[event4],
        active_session_id: None,
    })
    .unwrap()
    .unwrap();
    let after_relapse: (i64, u32, i64, String) = db.connection.query_row(
        "SELECT times_correct_afterwards, interval_days, next_review_at, status FROM mistakes WHERE id = ?1",
        [mistake_id as i64],
        |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
    ).unwrap();
    assert_eq!(after_relapse, (5, 1, turn4_time, "learning".into()));

    db.connection
        .execute(
            "UPDATE mistakes SET status = 'archived' WHERE id = ?1",
            [mistake_id as i64],
        )
        .unwrap();
    let replay = db
        .save_turn_usage_assessment(UsageAssessmentCommit {
            session_id: sid2,
            sequence: 1,
            request: &request,
            turn_time,
            assessment: saved.clone(),
            events: std::slice::from_ref(&event),
            active_session_id: None,
        })
        .unwrap()
        .unwrap();
    assert_eq!(replay, saved);
    let after_replay: (i64, i64, String) = db
        .connection
        .query_row(
            "SELECT (SELECT COUNT(*) FROM learning_usage_events), times_correct_afterwards, status
         FROM mistakes WHERE id = ?1",
            [mistake_id as i64],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )
        .unwrap();
    assert_eq!(after_replay, (3, 5, "archived".into()));
    let archived_evidence = db
        .get_memory_usage_evidence(LearningItemType::Mistake, mistake_id)
        .unwrap();
    assert_eq!(archived_evidence.distinct_session_count, 2);
    assert_eq!(archived_evidence.events.len(), 3);
}

#[test]
fn session_cue_exposure_is_recorded_and_checked() {
    let mut db = SessionDatabase::open_in_memory().unwrap();
    let sid = db
        .create_session_with_mode("conversation", "Question")
        .unwrap();

    assert!(!db
        .has_session_cue_exposure_before(sid, Some("mistake"), Some(1), 1000)
        .unwrap());

    db.record_session_cue_exposure(sid, None, None, 500)
        .unwrap();

    assert!(db
        .has_session_cue_exposure_before(sid, Some("mistake"), Some(1), 1000)
        .unwrap());
    assert!(!db
        .has_session_cue_exposure_before(sid, Some("mistake"), Some(1), 400)
        .unwrap());
}
