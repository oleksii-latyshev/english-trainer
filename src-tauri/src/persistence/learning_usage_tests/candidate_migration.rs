use super::*;

#[test]
fn migration_preserves_v5_open_recall_run_and_data() {
    let path = std::env::temp_dir().join(format!("english-trainer-v5-{}.sqlite", now_ms()));
    let db = SessionDatabase::open(&path).unwrap();
    db.connection
        .execute(
            "INSERT INTO memory_review_runs (started_at) VALUES (123)",
            [],
        )
        .unwrap();
    db.connection.execute(
        "INSERT INTO memory_review_items (run_id, position, item_type, item_id, cue, target, transcript)
         VALUES (1, 0, 'phrase', 77, 'a cue', 'a target', 'saved response')",
        [],
    ).unwrap();
    db.connection.execute_batch(
        "DROP TABLE learning_usage_counter_baselines; DROP TABLE session_cue_exposures; DROP TABLE learning_usage_events; DROP TABLE ai_settings; DROP TABLE turn_usage_assessments;
         PRAGMA user_version = 5;",
    ).unwrap();
    drop(db);

    let db = SessionDatabase::open(&path).unwrap();
    let version: i64 = db
        .connection
        .pragma_query_value(None, "user_version", |row| row.get(0))
        .unwrap();
    assert_eq!(version, crate::persistence::SCHEMA_VERSION);
    let preserved: (i64, String) = db
        .connection
        .query_row(
            "SELECT run_id, transcript FROM memory_review_items WHERE item_id = 77",
            [],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .unwrap();
    assert_eq!(preserved, (1, "saved response".into()));
    let tables: i64 = db.connection.query_row(
        "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name IN ('turn_usage_assessments', 'learning_usage_events', 'session_cue_exposures')",
        [],
        |row| row.get(0),
    ).unwrap();
    assert_eq!(tables, 3);
    drop(db);
    let _ = std::fs::remove_file(path);
}

#[test]
fn eligible_candidates_filters_sources_and_requires_transcript_match() {
    let mut db = SessionDatabase::open_in_memory().unwrap();
    let sid1 = db
        .create_session_with_mode("conversation", "How was your day?")
        .unwrap();
    let turn1 = StoredTurn {
        learner: "I work in there yesterday.".into(),
        assistant_reply: "I see.".into(),
        assistant_question: "Why did you go there?".into(),
    };
    db.save_turn(sid1, 1, &turn1).unwrap();

    let fb = TurnFeedback {
        focus_feedback: vec![FocusFeedback {
            category: FocusCategory::Grammar,
            original: "in there".into(),
            improved: "work there".into(),
            explanation: "Do not use 'in' before 'there'.".into(),
        }],
        b2_rewrite: "I worked there yesterday.".into(),
    };
    db.save_turn_feedback(sid1, 1, &fb).unwrap();
    let _ = db
        .save_phrase_card("trade off", "A compromise", Some(sid1), Some(1))
        .unwrap();
    let _ = db.finish_session(sid1).unwrap();

    // Now session 2 started AFTER session 1
    let sid2 = db
        .create_session_with_mode("conversation", "Tell me about your job.")
        .unwrap();
    let occurrence_time: i64 = db
        .connection
        .query_row(
            "SELECT created_at FROM mistake_occurrences WHERE session_id = ?1",
            [sid1 as i64],
            |row| row.get(0),
        )
        .unwrap();
    db.connection
        .execute(
            "UPDATE phrase_cards SET created_at = ?1 WHERE phrase = 'trade off'",
            [occurrence_time],
        )
        .unwrap();
    db.connection
        .execute(
            "UPDATE sessions SET started_at = ?1 WHERE id = ?2",
            rusqlite::params![occurrence_time + 1, sid2 as i64],
        )
        .unwrap();
    let turn2_1 = StoredTurn {
        learner: "The main trade off is speed and I work there now.".into(),
        assistant_reply: "That makes sense.".into(),
        assistant_question: "What else?".into(),
    };
    db.save_turn(sid2, 1, &turn2_1).unwrap();

    let candidates = db.eligible_usage_candidates(sid2, 1).unwrap();
    assert_eq!(candidates.len(), 2);
    assert!(candidates.iter().any(|c| c.target == "work there"));
    assert!(candidates.iter().any(|c| c.target == "trade off"));
    db.finish_session(sid2).unwrap();

    // Reject candidates if wording was in opening question
    let sid3 = db
        .create_session_with_mode("conversation", "Do you work there often?")
        .unwrap();
    let turn3_1 = StoredTurn {
        learner: "Yes, I work there every day.".into(),
        assistant_reply: "Great.".into(),
        assistant_question: "And trade off?".into(),
    };
    db.save_turn(sid3, 1, &turn3_1).unwrap();

    let candidates3 = db.eligible_usage_candidates(sid3, 1).unwrap();
    // "work there" is in opening question -> rejected!
    assert!(!candidates3.iter().any(|c| c.target == "work there"));
}
