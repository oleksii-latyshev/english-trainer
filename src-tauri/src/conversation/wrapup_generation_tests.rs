use super::*;
use crate::providers::{ConversationTurn, GeneratedWrapupPhrase};

fn finished() -> (SessionStore, u64, WrapupRequest) {
    let store = SessionStore::default();
    let id = store.start().unwrap().session_id;
    store
        .send_turn(id, "I share progress early".into(), |_| {
            Ok(ConversationTurn {
                spoken_reply: "Thanks.".into(),
                question: Some("What changed?".into()),
                session_phase: "active".into(),
                is_complete: false,
                provider_latency_ms: None,
                first_token_ms: None,
                answered_by: None,
            })
        })
        .unwrap();
    store.finish(id).unwrap();
    let (_, request) = store.next_wrapup_request().unwrap().unwrap();
    (store, id, request)
}

fn result(quote: &str) -> WrapupResult {
    WrapupResult {
        phrases: vec![GeneratedWrapupPhrase {
            sequence: 1,
            phrase: "share progress early".into(),
            note: "Use this to describe proactive updates.".into(),
            you_said: quote.into(),
        }],
    }
}

#[test]
fn invalid_adapter_result_cannot_become_learning_content() {
    let (store, id, request) = finished();
    store
        .complete_session_wrapup(id, &request, Ok(result("invented learner words")))
        .unwrap();
    let summary = store.session_wrapup(id).unwrap();
    assert!(summary.phrases.is_empty());
    assert!(
        matches!(summary.wrapup_preparation, WrapupPreparation::Failed { error }
        if error.code == ProviderErrorCode::InvalidOutput)
    );
}

#[test]
fn cached_phrases_stay_available_after_save_and_undo_and_saves_are_idempotent() {
    let (store, id, request) = finished();
    store
        .complete_session_wrapup(id, &request, Ok(result("share progress early")))
        .unwrap();
    assert!(store
        .save_wrapup_phrases(id, &["unknown phrase".into()])
        .is_err());
    assert!(store.save_wrapup_phrases(id, &[]).is_err());
    let phrases = vec!["share progress early".into()];
    let first = store.save_wrapup_phrases(id, &phrases).unwrap();
    assert_eq!(first.created_ids, vec![first.cards[0].id]);
    let again = store.save_wrapup_phrases(id, &phrases).unwrap();
    assert!(again.created_ids.is_empty());
    assert_eq!(again.cards[0].id, first.cards[0].id);
    assert_eq!(store.session_wrapup(id).unwrap().phrases.len(), 1);
    store.delete_phrase(first.created_ids[0]).unwrap();
    assert_eq!(store.session_wrapup(id).unwrap().phrases.len(), 1);
    assert!(store.get_learning_memory().unwrap().phrase_cards.is_empty());
}

#[test]
fn phrases_saved_while_generation_runs_are_skipped_at_completion() {
    let (store, id, request) = finished();
    store
        .save_phrase(
            "Share progress early!".into(),
            "Already remembered".into(),
            Some(id),
            Some(1),
        )
        .unwrap();
    store
        .complete_session_wrapup(id, &request, Ok(result("share progress early")))
        .unwrap();
    let summary = store.session_wrapup(id).unwrap();
    assert_eq!(summary.wrapup_preparation, WrapupPreparation::Ready);
    assert!(summary.phrases.is_empty());
}
