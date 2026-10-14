use super::super::{exposure, read};
use super::transaction_revalidation::prepared_turn;
use crate::learning::LearningItemType;

#[test]
fn pre_turn_global_memory_exposure_excludes_candidates_during_preparation() {
    let turn = prepared_turn(1);
    assert!(!turn.request.candidates.is_empty());
    exposure::record_cue_exposure(
        turn.db.connection(),
        turn.session_id,
        None,
        None,
        turn.turn_time.saturating_sub(1),
    )
    .unwrap();

    let prepared =
        read::prepare_usage_review_on(turn.db.connection(), turn.session_id, turn.sequence)
            .unwrap()
            .unwrap();
    assert!(prepared.request.candidates.is_empty());
}

#[test]
fn per_item_exposure_excludes_only_the_exposed_candidate() {
    let turn = prepared_turn(1);
    assert!(turn.request.candidates.iter().any(|candidate| {
        candidate.item_type == LearningItemType::Mistake && candidate.item_id == turn.mistake_id
    }));
    assert!(turn.request.candidates.len() >= 2);
    exposure::record_cue_exposure(
        turn.db.connection(),
        turn.session_id,
        Some("mistake"),
        Some(turn.mistake_id),
        turn.turn_time.saturating_sub(1),
    )
    .unwrap();

    let prepared =
        read::prepare_usage_review_on(turn.db.connection(), turn.session_id, turn.sequence)
            .unwrap()
            .unwrap();
    assert_eq!(prepared.request.candidates.len(), 1);
    assert_eq!(
        prepared.request.candidates[0].item_type,
        LearningItemType::Phrase
    );
}
