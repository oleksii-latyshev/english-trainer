use super::*;

struct Session {
    db: SessionDatabase,
    sid: u64,
    phrase_ids: Vec<u64>,
}

fn turn(learner: &str, question: &str) -> StoredTurn {
    StoredTurn {
        learner: learner.into(),
        assistant_reply: "Reply.".into(),
        assistant_question: question.into(),
        answered_by: None,
    }
}

fn save(db: &mut SessionDatabase, sid: u64, sequence: usize, learner: &str, source: &str) {
    db.save_turn_with_steering(
        sid,
        sequence,
        &turn(learner, "Question?"),
        source,
        (None, None),
        None,
    )
    .unwrap();
}

fn save_steering(db: &mut SessionDatabase, sid: u64, sequence: usize, phrase_id: u64) {
    db.save_turn_with_steering(
        sid,
        sequence,
        &turn(&format!("Answer {sequence}."), "Question?"),
        "voice",
        (None, None),
        Some((crate::persistence::SteeringKind::Phrase, phrase_id)),
    )
    .unwrap();
}

fn session_with_four_taken_phrases() -> Session {
    let mut db = SessionDatabase::open_in_memory().unwrap();
    let earlier = db
        .create_session_with_mode("conversation", "Opening?")
        .unwrap();
    save(&mut db, earlier, 1, "Original.", "voice");
    let phrase_ids = ["save time", "make sense", "take care", "keep going"]
        .iter()
        .map(|phrase| {
            db.save_phrase_card(phrase, "meaning", Some(earlier), Some(1))
                .unwrap()
                .id
        })
        .collect();
    db.finish_session(earlier).unwrap();
    db.connection()
        .execute("UPDATE phrase_cards SET created_at = 100", [])
        .unwrap();
    let sid = db
        .create_session_with_mode("conversation", "Tell me about your week.")
        .unwrap();
    db.connection()
        .execute(
            "UPDATE sessions SET started_at = 200 WHERE id = ?1",
            [sid as i64],
        )
        .unwrap();
    Session {
        db,
        sid,
        phrase_ids,
    }
}

/// Eva steers toward "keep going" in question 1 and toward "take care" in question 4.
fn six_answers(session: &mut Session) {
    let sid = session.sid;
    let ids = session.phrase_ids.clone();
    let db = &mut session.db;
    save_steering(db, sid, 1, ids[3]);
    save(
        db,
        sid,
        2,
        "I save time, it can make sense, I take care and keep going.",
        "voice",
    );
    save(db, sid, 3, "I save time all the time.", "voice");
    save_steering(db, sid, 4, ids[2]);
    save(db, sid, 5, "Please take care of it.", "voice");
    save(db, sid, 6, "I save time again.", "voice");
}

fn candidates_of(session: &Session, sequence: usize) -> Vec<crate::learning::UsageCandidate> {
    candidates::eligible_usage_candidates_on(session.db.connection(), session.sid, sequence)
        .unwrap()
}

#[test]
fn only_answers_one_and_two_and_those_after_a_steered_question_are_reviewable() {
    let mut session = session_with_four_taken_phrases();
    six_answers(&mut session);

    let sequences = candidates::reviewable_sequences_on(session.db.connection(), session.sid);

    assert_eq!(sequences.unwrap(), [1, 2, 5]);
}

#[test]
fn an_unreviewable_answer_has_no_candidates_even_when_it_uses_a_taken_phrase() {
    let mut session = session_with_four_taken_phrases();
    six_answers(&mut session);

    for sequence in [3, 6] {
        assert!(candidates_of(&session, sequence).is_empty(), "{sequence}");
    }
}

#[test]
fn the_steered_target_leads_the_candidates_within_the_limit_of_three() {
    let mut session = session_with_four_taken_phrases();
    six_answers(&mut session);

    let ids: Vec<u64> = candidates_of(&session, 2)
        .iter()
        .map(|candidate| candidate.item_id)
        .collect();

    let taken = &session.phrase_ids;
    assert_eq!(ids, [taken[3], taken[0], taken[1]]);
}

#[test]
fn a_steered_answer_after_the_first_two_gets_its_target_as_a_candidate() {
    let mut session = session_with_four_taken_phrases();
    six_answers(&mut session);

    let candidates = candidates_of(&session, 5);

    assert_eq!(candidates.len(), 1);
    assert_eq!(candidates[0].item_id, session.phrase_ids[2]);
    assert_eq!(candidates[0].target, "take care");
}

#[test]
fn the_request_asks_the_question_the_steered_answer_replied_to() {
    let mut session = session_with_four_taken_phrases();
    six_answers(&mut session);
    session
        .db
        .connection()
        .execute(
            "UPDATE turns SET assistant_question = 'How is the new plan?' WHERE session_id = ?1 AND sequence = 4",
            [session.sid as i64],
        )
        .unwrap();

    let prepared = read::prepare_usage_review_on(session.db.connection(), session.sid, 5)
        .unwrap()
        .unwrap();

    assert_eq!(prepared.request.answered_question, "How is the new plan?");
}

#[test]
fn a_target_in_the_question_asked_before_the_answer_is_rejected() {
    let mut session = session_with_four_taken_phrases();
    six_answers(&mut session);
    session
        .db
        .connection()
        .execute(
            "UPDATE turns SET assistant_question = 'Do you take care of it?' WHERE session_id = ?1 AND sequence = 4",
            [session.sid as i64],
        )
        .unwrap();

    assert!(candidates_of(&session, 5).is_empty());
}

#[test]
fn a_typed_steered_answer_is_not_reviewable() {
    let mut session = session_with_four_taken_phrases();
    let sid = session.sid;
    let first = session.phrase_ids[0];
    save_steering(&mut session.db, sid, 1, first);
    save(&mut session.db, sid, 2, "I save time.", "text");

    let sequences = candidates::reviewable_sequences_on(session.db.connection(), sid).unwrap();

    assert_eq!(sequences, [1]);
}

#[test]
fn a_mistake_practice_session_is_never_reviewed() {
    let mut session = session_with_four_taken_phrases();
    six_answers(&mut session);
    session
        .db
        .connection()
        .execute("UPDATE sessions SET is_mistake_practice = 1", [])
        .unwrap();

    let sequences = candidates::reviewable_sequences_on(session.db.connection(), session.sid);

    assert!(sequences.unwrap().is_empty());
}

#[test]
fn the_steering_link_is_saved_with_the_turn_and_goes_with_it() {
    let mut session = session_with_four_taken_phrases();
    six_answers(&mut session);
    let linked = |session: &Session, sequence: i64| -> Option<(String, i64)> {
        session
            .db
            .connection()
            .query_row(
                "SELECT item_type, item_id FROM turn_steering WHERE session_id = ?1 AND sequence = ?2",
                [session.sid as i64, sequence],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .ok()
    };

    assert_eq!(
        linked(&session, 1),
        Some(("phrase".into(), session.phrase_ids[3] as i64))
    );
    assert_eq!(linked(&session, 2), None);

    session.db.delete_turn(session.sid, 1).unwrap();

    assert_eq!(linked(&session, 1), None);
}

#[test]
fn a_steered_rule_is_saved_but_the_usage_review_never_assesses_it() {
    let mut session = session_with_four_taken_phrases();
    let sid = session.sid;
    let db = &mut session.db;
    save(db, sid, 1, "Original.", "voice");
    save(db, sid, 2, "Second answer, long enough.", "voice");
    save(db, sid, 3, "Third answer.", "voice");
    db.save_turn_with_steering(
        sid,
        4,
        &turn("Fourth answer.", "Question?"),
        "voice",
        (None, None),
        Some((crate::persistence::SteeringKind::Rule, 7)),
    )
    .unwrap();
    save(db, sid, 5, "I save time and take care.", "voice");

    let connection = session.db.connection();
    assert_eq!(
        candidates::steered_target_on(connection, sid, 5).unwrap(),
        None
    );
    assert!(!candidates::is_reviewable_answer_on(connection, sid, 5).unwrap());
    assert!(!candidates::reviewable_sequences_on(connection, sid)
        .unwrap()
        .contains(&5));
    assert!(candidates_of(&session, 5).is_empty());
}
