use super::*;
use crate::learning::{LearningItemType, LearningStatus, ReviewResponse};
use crate::providers::{FocusCategory, FocusFeedback};
use std::sync::atomic::{AtomicUsize, Ordering};

static NEXT_PATH: AtomicUsize = AtomicUsize::new(0);

fn test_database_path() -> std::path::PathBuf {
    let index = NEXT_PATH.fetch_add(1, Ordering::Relaxed);
    std::env::temp_dir().join(format!(
        "english-trainer-db-{}-{index}.sqlite3",
        std::process::id()
    ))
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
fn creates_versioned_schema_and_enforces_one_active_session() {
    let path = test_database_path();
    let db = SessionDatabase::open(&path).unwrap();
    let version: i64 = db
        .connection
        .pragma_query_value(None, "user_version", |row| row.get(0))
        .unwrap();
    assert_eq!(version, SCHEMA_VERSION);
    drop(db);

    let mut db = SessionDatabase::open(&path).unwrap();
    let first = db.create_session("Opening?").unwrap();
    assert!(db.create_session("Second?").is_err());
    assert!(db.finish_session(first).unwrap());
    assert!(db.create_session("Next?").is_ok());
    drop(db);
    let _ = std::fs::remove_file(path);
}

#[test]
fn migrates_existing_version_two_database_to_current_version() {
    let path = test_database_path();
    let connection = rusqlite::Connection::open(&path).unwrap();
    connection
        .execute_batch(
            "CREATE TABLE sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT, mode TEXT NOT NULL, scenario TEXT NOT NULL,
            started_at INTEGER NOT NULL, ended_at INTEGER, conversation_provider TEXT NOT NULL DEFAULT 'agy',
            opening_question TEXT NOT NULL
        );
        CREATE UNIQUE INDEX one_active_session ON sessions ((1)) WHERE ended_at IS NULL;
        CREATE TABLE turns (
            id INTEGER PRIMARY KEY AUTOINCREMENT, session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
            sequence INTEGER NOT NULL, user_transcript TEXT NOT NULL, assistant_reply TEXT NOT NULL,
            assistant_question TEXT NOT NULL, created_at INTEGER NOT NULL, UNIQUE(session_id, sequence)
        );
        CREATE TABLE turn_feedback (
            session_id INTEGER NOT NULL, sequence INTEGER NOT NULL, feedback_json TEXT NOT NULL,
            PRIMARY KEY(session_id, sequence),
            FOREIGN KEY(session_id, sequence) REFERENCES turns(session_id, sequence) ON DELETE CASCADE
        );
        CREATE TABLE attempt_comparisons (
            session_id INTEGER NOT NULL, sequence INTEGER NOT NULL, comparison_json TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            PRIMARY KEY(session_id, sequence),
            FOREIGN KEY(session_id, sequence) REFERENCES turns(session_id, sequence) ON DELETE CASCADE
        );
        INSERT INTO sessions (mode, scenario, started_at, opening_question) VALUES ('conversation', 'free', 1, 'Question?');
        INSERT INTO turns (session_id, sequence, user_transcript, assistant_reply, assistant_question, created_at)
        VALUES (1, 1, 'Original', 'Reply', 'Next?', 1);
        INSERT INTO attempt_comparisons (session_id, sequence, comparison_json, created_at)
        VALUES (1, 1, '{\"turn_sequence\":1,\"original_transcript\":\"Original\",\"retry_transcript\":\"Retry\",\"target\":\"Target\",\"target_evidence\":\"newly_observed_in_retry\",\"word_count_change\":0,\"hesitation\":\"None\"}', 1);
        PRAGMA user_version = 2;",
        )
        .unwrap();
    drop(connection);

    let mut db = SessionDatabase::open(&path).unwrap();
    let version: i64 = db
        .connection
        .pragma_query_value(None, "user_version", |row| row.get(0))
        .unwrap();
    assert_eq!(version, SCHEMA_VERSION);
    assert_eq!(db.turns(1).unwrap()[0].learner, "Original");
    let comparisons = db.comparisons(1).unwrap();
    assert_eq!(comparisons.len(), 1);
    assert_eq!(comparisons[0].retry_transcript, "Retry");

    // Verify new v3 memory tables work
    let card = db
        .save_phrase_card("I work there", "Work note", Some(1), Some(1))
        .unwrap();
    assert_eq!(card.phrase, "I work there");
    let memory = db.get_learning_memory().unwrap();
    assert_eq!(memory.phrase_cards.len(), 1);

    drop(db);
    let _ = std::fs::remove_file(path);
}

#[test]
fn migrates_version_eight_database_keeping_old_turns_without_an_origin() {
    let path = test_database_path();
    let mut db = SessionDatabase::open(&path).unwrap();
    let session = db.create_session("Question?").unwrap();
    db.save_turn(
        session,
        1,
        &StoredTurn {
            learner: "Original".into(),
            assistant_reply: "Reply".into(),
            assistant_question: "Next?".into(),
            answered_by: None,
        },
    )
    .unwrap();
    // Rewind to the version 8 shape: a turns table without the origin columns.
    db.connection
        .execute_batch(
            "ALTER TABLE turns DROP COLUMN answered_by_provider;
            ALTER TABLE turns DROP COLUMN answered_by_model;
            ALTER TABLE turns DROP COLUMN answered_by_backup;
            PRAGMA user_version = 8;",
        )
        .unwrap();
    drop(db);
    let mut db = SessionDatabase::open(&path).unwrap();
    let version: i64 = db
        .connection
        .pragma_query_value(None, "user_version", |row| row.get(0))
        .unwrap();
    assert_eq!(version, SCHEMA_VERSION);
    assert_eq!(db.turns(1).unwrap()[0].answered_by, None);
    let answered_by = crate::providers::AnsweredBy::apple(true);
    db.save_turn(
        1,
        2,
        &StoredTurn {
            learner: "Next".into(),
            assistant_reply: "Fine.".into(),
            assistant_question: "Why?".into(),
            answered_by: Some(answered_by.clone()),
        },
    )
    .unwrap();
    assert_eq!(db.turns(1).unwrap()[1].answered_by, Some(answered_by));
    drop(db);
    let _ = std::fs::remove_file(path);
}

#[test]
fn migrates_existing_version_three_database_to_recall_storage() {
    let path = test_database_path();
    let db = SessionDatabase::open(&path).unwrap();
    db.connection
        .execute_batch("DROP TABLE ai_settings; DROP TABLE memory_review_items; DROP TABLE memory_review_runs; DROP TABLE session_phrase_recalls; DROP TABLE learning_usage_counter_baselines; DROP TABLE session_cue_exposures; DROP TABLE learning_usage_events; DROP TABLE turn_usage_assessments; PRAGMA user_version = 3;")
        .unwrap();
    drop(db);
    let db = SessionDatabase::open(&path).unwrap();
    let version: i64 = db
        .connection
        .pragma_query_value(None, "user_version", |row| row.get(0))
        .unwrap();
    assert_eq!(version, SCHEMA_VERSION);
    assert!(db.daily_recall_plan(1).is_ok());
    let session = db.active_session().unwrap();
    assert!(session.is_none());
    drop(db);
    std::fs::remove_file(path).unwrap();
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

    // Saving feedback for turn 1 first time creates mistake with times_seen = 1
    db.save_turn_feedback(session_id, 1, &feedback).unwrap();
    let mistake = db.mistake_by_key("grammar:i work there").unwrap().unwrap();
    assert_eq!(mistake.times_seen, 1);

    // Saving feedback for turn 1 second time is idempotent: times_seen remains 1
    db.save_turn_feedback(session_id, 1, &feedback).unwrap();
    let mistake_again = db.mistake_by_key("grammar:i work there").unwrap().unwrap();
    assert_eq!(mistake_again.times_seen, 1);

    // Saving feedback for turn 2 with same normalized correction increments times_seen to 2
    let feedback2 = sample_turn_feedback(FocusCategory::Grammar, "  I work there.  ");
    db.save_turn_feedback(session_id, 2, &feedback2).unwrap();
    let mistake_after_turn2 = db.mistake_by_key("grammar:i work there").unwrap().unwrap();
    assert_eq!(mistake_after_turn2.times_seen, 2);

    // Saving feedback for turn 2 again is idempotent: times_seen remains 2
    db.save_turn_feedback(session_id, 2, &feedback2).unwrap();
    let mistake_after_turn2_again = db.mistake_by_key("grammar:i work there").unwrap().unwrap();
    assert_eq!(mistake_after_turn2_again.times_seen, 2);
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
    db.connection
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
        .connection
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
        .connection
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
        .connection
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
        .connection
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
        .connection
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
        .connection
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
    assert!(!memory.mistakes[0].is_due);
    assert_eq!(memory.due_count, 0);

    db.save_turn_feedback(session_id, 2, &correction).unwrap();
    let revived = db.mistake_by_key("grammar:i work there").unwrap().unwrap();
    assert_eq!(revived.times_seen, 1);
    assert_eq!(revived.status, LearningStatus::New);
}

#[test]
fn phrase_save_rejects_empty_normalized_text_and_incomplete_provenance() {
    let mut db = SessionDatabase::open_in_memory().unwrap();
    assert!(db.save_phrase_card("... !!!", "", None, None).is_err());
    assert!(db
        .save_phrase_card("Useful phrase", "", Some(1), None)
        .is_err());
}

#[test]
fn saving_phrase_card_deduplicates_by_normalized_text() {
    let mut db = SessionDatabase::open_in_memory().unwrap();
    let card1 = db
        .save_phrase_card("The main trade-off was...", "Note 1", None, None)
        .unwrap();
    assert_eq!(card1.id, 1);

    // Saving identical or normalized-equivalent phrase returns existing card
    let card2 = db
        .save_phrase_card("the main trade-off was", "Note 2", None, None)
        .unwrap();
    assert_eq!(card2.id, card1.id);
    assert_eq!(card2.normalized_phrase, card1.normalized_phrase);

    let memory = db.get_learning_memory().unwrap();
    assert_eq!(memory.phrase_cards.len(), 1);
}

#[test]
fn spoken_recall_queue_and_evidence_survive_without_changing_mastery() {
    let path = test_database_path();
    let mut db = SessionDatabase::open(&path).unwrap();
    let first = db.create_session("Earlier question?").unwrap();
    db.save_turn(
        first,
        1,
        &StoredTurn {
            learner: "A trade-off matters.".into(),
            assistant_reply: "Yes.".into(),
            assistant_question: "Why?".into(),
            answered_by: None,
        },
    )
    .unwrap();
    let card = db
        .save_phrase_card(
            "trade-off",
            "A compromise between two benefits",
            Some(first),
            Some(1),
        )
        .unwrap();
    db.connection
        .execute(
            "UPDATE phrase_cards SET next_review_at = 0 WHERE id = ?1",
            [card.id as i64],
        )
        .unwrap();
    assert!(db.finish_session(first).unwrap());
    let second = db.create_session("New question?").unwrap();
    let plan = db.daily_recall_plan(second).unwrap();
    assert_eq!(plan.completed_count, 0);
    assert_eq!(plan.items.len(), 1);
    assert_eq!(plan.items[0].phrase_id, card.id);
    assert_eq!(plan.items[0].cue, "A compromise between two benefits");

    let saved = db
        .record_daily_recall(second, card.id, "The trade off was worth it.")
        .unwrap()
        .unwrap();
    assert!(saved.wording_observed);
    let duplicate = db
        .record_daily_recall(second, card.id, "I changed my answer")
        .unwrap()
        .unwrap();
    assert_eq!(duplicate, saved);
    assert_eq!(db.daily_recall_plan(second).unwrap().completed_count, 1);
    assert!(db.daily_recall_plan(second).unwrap().items.is_empty());
    assert_eq!(db.daily_recall_counts(second).unwrap(), (1, 1));
    let memory = db.get_learning_memory().unwrap();
    assert_eq!(memory.phrase_cards[0].status, LearningStatus::Learning);
    assert!(memory.phrase_cards[0].is_due);
    drop(db);

    let db = SessionDatabase::open(&path).unwrap();
    assert_eq!(db.daily_recall_plan(second).unwrap().completed_count, 1);
    assert_eq!(db.daily_recall_counts(second).unwrap(), (1, 1));
    drop(db);
    std::fs::remove_file(path).unwrap();
}

#[test]
fn spoken_recall_excludes_cues_that_reveal_the_phrase() {
    let mut db = SessionDatabase::open_in_memory().unwrap();
    let first = db.create_session("Earlier?").unwrap();
    db.save_turn(
        first,
        1,
        &StoredTurn {
            learner: "Answer".into(),
            assistant_reply: "Reply".into(),
            assistant_question: "Next?".into(),
            answered_by: None,
        },
    )
    .unwrap();
    let leaked = db
        .save_phrase_card("bottleneck", "A bottleneck slowed us", Some(first), Some(1))
        .unwrap();
    db.connection
        .execute(
            "UPDATE phrase_cards SET next_review_at = 0 WHERE id = ?1",
            [leaked.id as i64],
        )
        .unwrap();
    db.finish_session(first).unwrap();
    let second = db.create_session("Now?").unwrap();
    assert!(db.daily_recall_plan(second).unwrap().items.is_empty());
    assert!(db
        .record_daily_recall(second, leaked.id, "bottleneck")
        .unwrap()
        .is_none());
}

#[test]
fn review_event_updates_schedule_and_persists_event() {
    let mut db = SessionDatabase::open_in_memory().unwrap();
    let card = db
        .save_phrase_card("I work there", "Work note", None, None)
        .unwrap();
    assert_eq!(card.status, LearningStatus::Learning);

    // Record review: Remembered
    let result = db
        .record_review(
            LearningItemType::Phrase,
            card.id,
            ReviewResponse::Remembered,
        )
        .unwrap();
    assert_eq!(result.status, LearningStatus::Learning);
    assert_eq!(result.interval_days, 2);

    // Verify review event was stored
    let count: i64 = db
        .connection
        .query_row("SELECT COUNT(*) FROM review_events", [], |row| row.get(0))
        .unwrap();
    assert_eq!(count, 1);

    // Verify updated state in database
    let memory = db.get_learning_memory().unwrap();
    assert_eq!(memory.phrase_cards[0].interval_days, 2);
    assert!(memory.phrase_cards[0].last_reviewed_at.is_some());
}

#[test]
fn due_target_selection_excludes_future_archived_and_current_session_items() {
    let mut db = SessionDatabase::open_in_memory().unwrap();
    let first = db.create_session("Opening?").unwrap();
    db.save_turn(
        first,
        1,
        &StoredTurn {
            learner: "I work in there".into(),
            assistant_reply: "Reply".into(),
            assistant_question: "Next?".into(),
            answered_by: None,
        },
    )
    .unwrap();
    db.save_turn_feedback(
        first,
        1,
        &sample_turn_feedback(FocusCategory::Grammar, "I work there"),
    )
    .unwrap();
    db.save_phrase_card(
        "The main trade-off was",
        "Decision cue",
        Some(first),
        Some(1),
    )
    .unwrap();
    db.save_phrase_card("Future phrase", "Later", Some(first), Some(1))
        .unwrap();
    db.save_phrase_card("Archived phrase", "Old", Some(first), Some(1))
        .unwrap();
    db.finish_session(first).unwrap();
    let second = db.create_session("Opening?").unwrap();
    db.save_turn(
        second,
        1,
        &StoredTurn {
            learner: "Current answer".into(),
            assistant_reply: "Reply".into(),
            assistant_question: "Next?".into(),
            answered_by: None,
        },
    )
    .unwrap();
    db.save_phrase_card("Current phrase", "Current", Some(second), Some(1))
        .unwrap();
    db.connection
        .execute("UPDATE mistakes SET next_review_at = 0", [])
        .unwrap();
    db.connection
        .execute(
            "UPDATE phrase_cards SET next_review_at = 0 WHERE phrase != 'Future phrase'",
            [],
        )
        .unwrap();
    db.connection
        .execute(
            "UPDATE phrase_cards SET status = 'archived' WHERE phrase = 'Archived phrase'",
            [],
        )
        .unwrap();

    let targets = db.due_learning_targets(second).unwrap();
    assert_eq!(targets.len(), 2);
    assert_eq!(targets[0].target, "I work there");
    assert_eq!(targets[1].target, "The main trade-off was");

    db.connection
        .execute(
            "UPDATE phrase_cards SET meaning_or_note = ?1 WHERE phrase = 'The main trade-off was'",
            ["word ".repeat(50)],
        )
        .unwrap();
    let bounded = db.due_learning_targets(second).unwrap();
    assert_eq!(bounded[1].cue.chars().count(), 160);
}

#[test]
fn session_mode_persists_and_turn_can_be_updated_in_place() {
    let mut db = SessionDatabase::open_in_memory().unwrap();
    let session_id = db
        .create_session_with_mode("coach", "What did you build?")
        .unwrap();
    let active = db.active_session().unwrap().unwrap();
    assert_eq!(active.id, session_id);
    assert_eq!(active.mode, "coach");
    assert_eq!(active.opening_question, "What did you build?");

    let initial_turn = StoredTurn {
        learner: "I built a service.".into(),
        assistant_reply: "".into(),
        assistant_question: "".into(),
        answered_by: None,
    };
    db.save_turn(session_id, 1, &initial_turn).unwrap();
    let loaded = db.turn(session_id, 1).unwrap().unwrap();
    assert_eq!(loaded.learner, "I built a service.");
    assert_eq!(loaded.assistant_reply, "");

    let updated = db
        .update_turn(
            session_id,
            1,
            "Sounds interesting.",
            "What architecture did you use?",
            None,
            None,
        )
        .unwrap();
    assert!(updated);
    let after_update = db.turn(session_id, 1).unwrap().unwrap();
    assert_eq!(after_update.learner, "I built a service.");
    assert_eq!(after_update.assistant_reply, "Sounds interesting.");
    assert_eq!(
        after_update.assistant_question,
        "What architecture did you use?"
    );
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
        db.connection
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
            .connection
            .query_row(
                "SELECT COUNT(*) FROM learning_usage_events WHERE origin = 'feedback'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(events, 0);
    }
}

fn stored(learner: &str) -> StoredTurn {
    StoredTurn {
        learner: learner.into(),
        assistant_reply: "Thanks".into(),
        assistant_question: "Next?".into(),
        answered_by: None,
    }
}

#[test]
fn version_nine_database_migrates_keeping_turns_without_details() {
    let mut db = SessionDatabase::open_in_memory().unwrap();
    let session_id = db.create_session("Opening?").unwrap();
    db.save_turn(session_id, 1, &stored("Old answer")).unwrap();
    db.connection
        .execute_batch(
            "DROP TABLE answer_help_uses;
             ALTER TABLE turns DROP COLUMN reply_ms;
             ALTER TABLE turns DROP COLUMN answer_duration_ms;
             PRAGMA user_version = 9;",
        )
        .unwrap();
    migrate(&db.connection).unwrap();
    let version: i64 = db
        .connection
        .pragma_query_value(None, "user_version", |row| row.get(0))
        .unwrap();
    assert_eq!(version, SCHEMA_VERSION);
    assert_eq!(
        db.turn(session_id, 1).unwrap().unwrap().learner,
        "Old answer"
    );
    assert_eq!(
        db.turn_details(session_id).unwrap(),
        vec![TurnDetails::default()]
    );
}

#[test]
fn turn_details_round_trip_per_turn() {
    let mut db = SessionDatabase::open_in_memory().unwrap();
    let session_id = db.create_session("Opening?").unwrap();
    db.record_answer_help_used(session_id, 1).unwrap();
    db.record_answer_help_used(session_id, 1).unwrap();
    db.save_turn_with_details(
        session_id,
        1,
        &stored("Spoken"),
        "voice",
        Some(800),
        Some(14_000),
    )
    .unwrap();
    db.save_turn_with_details(session_id, 2, &stored("Typed"), "text", None, None)
        .unwrap();
    assert!(db
        .update_turn(session_id, 2, "Reply", "Q?", None, Some(1_100))
        .unwrap());
    assert_eq!(
        db.turn_details(session_id).unwrap(),
        vec![
            TurnDetails {
                reply_ms: Some(800),
                answer_duration_ms: Some(14_000),
                help_used: true
            },
            TurnDetails {
                reply_ms: Some(1_100),
                answer_duration_ms: None,
                help_used: false
            },
        ]
    );
}
