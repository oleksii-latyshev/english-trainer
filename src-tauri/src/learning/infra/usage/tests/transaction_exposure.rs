use super::super::write::UsageAssessmentCommit;
use super::super::{exposure, read, write};
use super::transaction_revalidation::{prepared_turn, PreparedTurn};
use crate::learning::{
    LearningStatus, TurnUsageAssessment, UsageAssessmentFinding, UsageEventRecord, UsageOutcome,
};

fn cue_every_item(turn: &PreparedTurn) {
    exposure::record_cue_exposure(
        turn.db.connection(),
        turn.session_id,
        None,
        None,
        turn.turn_time.saturating_sub(1),
    )
    .unwrap();
}

fn commit_first_candidate(
    turn: &mut PreparedTurn,
    outcome: UsageOutcome,
) -> Option<TurnUsageAssessment> {
    let candidate = turn.request.candidates[0].clone();
    let event = UsageEventRecord {
        id: 0,
        item_type: candidate.item_type,
        item_id: candidate.item_id,
        session_id: turn.session_id,
        sequence: turn.sequence,
        origin: "assessment".into(),
        original_turn_time: turn.turn_time,
        outcome,
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
            outcome,
            confidence: 0.95,
            exact_excerpt: candidate.target,
            credited: true,
            status_after: LearningStatus::New,
        }],
    };
    write::save_turn_usage_assessment(
        turn.db.connection_mut(),
        UsageAssessmentCommit {
            session_id: turn.session_id,
            sequence: turn.sequence,
            request: &turn.request,
            turn_time: turn.turn_time,
            assessment,
            events: std::slice::from_ref(&event),
            active_session_id: None,
        },
    )
    .unwrap()
}

fn stored_events(turn: &PreparedTurn) -> i64 {
    turn.db
        .connection()
        .query_row("SELECT COUNT(*) FROM learning_usage_events", [], |row| {
            row.get(0)
        })
        .unwrap()
}

#[test]
fn a_cued_item_stays_a_candidate_so_its_use_is_recorded_with_help() {
    let turn = prepared_turn(1);
    cue_every_item(&turn);

    let prepared =
        read::prepare_usage_review_on(turn.db.connection(), turn.session_id, turn.sequence)
            .unwrap()
            .unwrap();
    assert_eq!(prepared.request.candidates, turn.request.candidates);
}

#[test]
fn an_own_use_of_a_cued_item_is_rejected_as_stale() {
    let mut turn = prepared_turn(1);
    cue_every_item(&turn);

    assert!(commit_first_candidate(&mut turn, UsageOutcome::Correct).is_none());
    assert_eq!(stored_events(&turn), 0);
}

#[test]
fn a_with_help_use_of_a_cued_item_is_saved_without_progress() {
    let mut turn = prepared_turn(1);
    cue_every_item(&turn);

    assert!(commit_first_candidate(&mut turn, UsageOutcome::WithHelp).is_some());
    assert_eq!(stored_events(&turn), 1);
    let (status, counter): (String, i64) = turn
        .db
        .connection()
        .query_row(
            "SELECT status, times_correct_afterwards FROM mistakes WHERE id = ?1",
            [turn.mistake_id as i64],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .unwrap();
    assert_eq!((status.as_str(), counter), ("new", 0));
}
