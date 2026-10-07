use super::*;

pub(super) struct UsageFixture {
    pub(super) db: SessionDatabase,
    pub(super) sid2: u64,
    pub(super) request: crate::providers::UsageReviewRequest,
    pub(super) event: UsageEventRecord,
    pub(super) saved: TurnUsageAssessment,
    pub(super) mistake_id: u64,
    pub(super) turn_time: i64,
    pub(super) occurrence_time: i64,
}

pub(super) fn setup_usage_fixture() -> UsageFixture {
    let mut db = SessionDatabase::open_in_memory().unwrap();
    let sid1 = db
        .create_session_with_mode("conversation", "Opening?")
        .unwrap();
    let turn1 = StoredTurn {
        learner: "Original turn.".into(),
        assistant_reply: "Reply.".into(),
        assistant_question: "Question.".into(),
        answered_by: None,
    };
    db.save_turn(sid1, 1, &turn1).unwrap();
    let fb = TurnFeedback {
        focus_feedback: vec![FocusFeedback {
            category: FocusCategory::Grammar,
            original: "bad wording".into(),
            improved: "good phrasing".into(),
            explanation: "Correction.".into(),
        }],
        b2_rewrite: "B2 rewrite.".into(),
    };
    db.save_turn_feedback(sid1, 1, &fb).unwrap();
    db.finish_session(sid1).unwrap();

    let mistake = db.mistake_by_key("grammar:good phrasing").unwrap().unwrap();
    assert_eq!(mistake.status, LearningStatus::New);

    let sid2 = db
        .create_session_with_mode("conversation", "New topic?")
        .unwrap();
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
            "UPDATE sessions SET started_at = ?1 WHERE id = ?2",
            rusqlite::params![occurrence_time + 1, sid2 as i64],
        )
        .unwrap();
    let turn2 = StoredTurn {
        learner: "I used good phrasing here.".into(),
        assistant_reply: "Reply 2.".into(),
        assistant_question: "Next.".into(),
        answered_by: None,
    };
    db.save_turn(sid2, 1, &turn2).unwrap();

    let assessment = TurnUsageAssessment {
        session_id: sid2,
        sequence: 1,
        assessed_at: 5000,
        findings: vec![UsageAssessmentFinding {
            item_type: LearningItemType::Mistake,
            item_id: mistake.id,
            target: "good phrasing".into(),
            outcome: UsageOutcome::Correct,
            confidence: 0.95,
            exact_excerpt: "good phrasing".into(),
            credited: true,
            status_after: LearningStatus::Learning,
        }],
    };
    let mut event = UsageEventRecord {
        id: 0,
        item_type: LearningItemType::Mistake,
        item_id: mistake.id,
        session_id: sid2,
        sequence: 1,
        origin: "assessment".into(),
        original_turn_time: 1000,
        outcome: UsageOutcome::Correct,
        exact_excerpt: "good phrasing".into(),
        confidence: 0.95,
        created_at: 5000,
    };
    let turn_time: i64 = db
        .connection
        .query_row(
            "SELECT created_at FROM turns WHERE session_id = ?1 AND sequence = 1",
            [sid2 as i64],
            |row| row.get(0),
        )
        .unwrap();
    event.original_turn_time = turn_time;
    let request = crate::providers::UsageReviewRequest {
        answered_question: "New topic?".into(),
        transcript: turn2.learner,
        candidates: vec![crate::learning::UsageCandidate {
            item_type: LearningItemType::Mistake,
            item_id: mistake.id,
            target: "good phrasing".into(),
            cue: "bad wording".into(),
        }],
    };
    db.connection
        .execute(
            "UPDATE mistakes SET times_correct_afterwards = 3 WHERE id = ?1",
            [mistake.id as i64],
        )
        .unwrap();
    db.connection
        .execute(
            "INSERT INTO learning_usage_counter_baselines (item_id, baseline_count) VALUES (?1, 3)",
            [mistake.id as i64],
        )
        .unwrap();
    let prior_schedule: (u32, i64) = db
        .connection
        .query_row(
            "SELECT interval_days, next_review_at FROM mistakes WHERE id = ?1",
            [mistake.id as i64],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .unwrap();
    let retry_assessment = assessment.clone();
    let retry_event = event.clone();
    db.connection
        .execute_batch(
            "CREATE TRIGGER reject_usage_event BEFORE INSERT ON learning_usage_events
         BEGIN SELECT RAISE(ABORT, 'forced usage failure'); END;",
        )
        .unwrap();
    let failed = db.save_turn_usage_assessment(UsageAssessmentCommit {
        session_id: sid2,
        sequence: 1,
        request: &request,
        turn_time,
        assessment: assessment.clone(),
        events: std::slice::from_ref(&event),
        active_session_id: Some(sid2),
    });
    assert!(failed.is_err());
    let rolled_back: (i64, i64, String) = db
        .connection
        .query_row(
            "SELECT (SELECT COUNT(*) FROM turn_usage_assessments),
                (SELECT COUNT(*) FROM learning_usage_events), status FROM mistakes WHERE id = ?1",
            [mistake.id as i64],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )
        .unwrap();
    assert_eq!(rolled_back, (0, 0, "new".into()));
    db.connection
        .execute_batch("DROP TRIGGER reject_usage_event;")
        .unwrap();
    let saved = db
        .save_turn_usage_assessment(UsageAssessmentCommit {
            session_id: sid2,
            sequence: 1,
            request: &request,
            turn_time,
            assessment,
            events: std::slice::from_ref(&event),
            active_session_id: Some(sid2),
        })
        .unwrap()
        .unwrap();
    assert_eq!(saved.findings[0].status_after, LearningStatus::Learning);

    let duplicate = db
        .save_turn_usage_assessment(UsageAssessmentCommit {
            session_id: sid2,
            sequence: 1,
            request: &request,
            turn_time,
            assessment: retry_assessment,
            events: &[retry_event],
            active_session_id: None,
        })
        .unwrap()
        .unwrap();
    assert_eq!(duplicate, saved);

    let loaded_assessment = db.get_turn_usage_assessment(sid2, 1).unwrap().unwrap();
    assert_eq!(loaded_assessment.session_id, sid2);
    assert_eq!(loaded_assessment.findings.len(), 1);

    let updated_mistake = db.mistake_by_key("grammar:good phrasing").unwrap().unwrap();
    assert_eq!(updated_mistake.status, LearningStatus::Learning);
    assert_eq!(updated_mistake.times_correct_afterwards, 4);
    assert_eq!(
        (
            updated_mistake.interval_days,
            updated_mistake.next_review_at
        ),
        prior_schedule
    );

    let evidence = db
        .get_memory_usage_evidence(LearningItemType::Mistake, mistake.id)
        .unwrap();
    assert_eq!(evidence.distinct_session_count, 1);
    assert_eq!(evidence.streak, 1);
    assert_eq!(evidence.events.len(), 1);

    UsageFixture {
        db,
        sid2,
        request,
        event,
        saved,
        mistake_id: mistake.id,
        turn_time,
        occurrence_time,
    }
}
