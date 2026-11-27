use super::{SessionLearningStore, UsageReviewService};
use crate::conversation::SessionStore;
use crate::providers::{
    ConversationTurn, UsageBatchAnswer, UsageBatchResult, UsageFinding, UsageOutcome,
    UsageReviewResponse,
};

pub(super) fn usage_service(store: &SessionStore) -> UsageReviewService {
    UsageReviewService::new(SessionLearningStore::new(store.clone()))
}

fn turn(question: &str) -> ConversationTurn {
    ConversationTurn {
        spoken_reply: "Good.".into(),
        question: Some(question.into()),
        session_phase: "active".into(),
        is_complete: false,
        provider_latency_ms: None,
        first_token_ms: None,
        answered_by: None,
    }
}

pub(super) struct Steered {
    pub store: SessionStore,
    pub session_id: u64,
    pub phrase_ids: [u64; 2],
}

/// A finished conversation in which Eva steered toward "save time" in her first question and
/// toward "makes sense" in her fourth. Answers 1, 2 and 5 are reviewable.
pub(super) fn finished_steered_session() -> Steered {
    let store = SessionStore::default();
    let earlier = store.start().unwrap();
    store
        .send_turn(earlier.session_id, "Something earlier.".into(), |_| {
            Ok(turn("What next?"))
        })
        .unwrap();
    let phrase_ids = ["save time", "makes sense"].map(|phrase| {
        store
            .save_phrase(
                phrase.into(),
                "meaning".into(),
                Some(earlier.session_id),
                Some(1),
            )
            .unwrap()
            .id
    });
    store.finish(earlier.session_id).unwrap();
    store
        .lock()
        .database
        .connection()
        .execute("UPDATE phrase_cards SET next_review_at = 0", [])
        .unwrap();
    std::thread::sleep(std::time::Duration::from_millis(5));

    let session = store.start().unwrap();
    for answer in [
        "I like to save time.",
        "Mornings help me save time.",
        "Yes, it does.",
        "Perhaps later.",
        "That really makes sense to me.",
        "All good.",
    ] {
        store
            .send_turn(session.session_id, answer.into(), |_| Ok(turn("Why?")))
            .unwrap();
    }
    store.finish(session.session_id).unwrap();
    Steered {
        store,
        session_id: session.session_id,
        phrase_ids,
    }
}

pub(super) fn all_correct(answers: &[UsageBatchAnswer]) -> Vec<UsageBatchResult> {
    answers.iter().map(correct_for).collect()
}

pub(super) fn correct_for(answer: &UsageBatchAnswer) -> UsageBatchResult {
    UsageBatchResult {
        sequence: answer.sequence,
        response: UsageReviewResponse {
            findings: answer
                .request
                .candidates
                .iter()
                .map(|candidate| UsageFinding {
                    item_type: candidate.item_type,
                    item_id: candidate.item_id,
                    outcome: UsageOutcome::Correct,
                    confidence: 0.95,
                    exact_excerpt: candidate.target.clone(),
                })
                .collect(),
        },
    }
}

pub(super) fn sequences(answers: &[UsageBatchAnswer]) -> Vec<usize> {
    answers.iter().map(|answer| answer.sequence).collect()
}
