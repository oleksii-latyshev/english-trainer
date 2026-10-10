use super::*;
use crate::learning::{LearningItemType, MemoryReviewRun};
use crate::providers::GeneratedReviewMaterial;

fn seed(store: &SessionStore) -> MemoryReviewRun {
    store
        .lock()
        .database
        .seed_recurring_mistake("I work in there", "I work there", 2, 20)
        .unwrap();
    store.start_memory_review().unwrap().unwrap()
}

fn material(_: &ReviewMaterialRequest) -> Result<ReviewMaterialResult, ProviderError> {
    Ok(ReviewMaterialResult {
        items: vec![GeneratedReviewMaterial {
            position: 1,
            situation: "You are describing your regular workplace to a new colleague.".into(),
            model_answer: "I work there as a developer.".into(),
        }],
    })
}

#[test]
fn caches_material_and_masks_example_until_the_first_answer_is_saved() {
    let store = SessionStore::default();
    let run = seed(&store);
    let prepared = store
        .prepare_review_material(run.run_id, false, material)
        .unwrap();
    assert!(matches!(prepared.preparation, ReviewPreparation::Ready));
    assert!(prepared.items[0].situation.is_some());
    assert!(prepared.items[0].model_answer.is_none());
    assert!(prepared.items[0].hint.is_none());
    store
        .prepare_review_material(run.run_id, true, |_| panic!("ready cache must be reused"))
        .unwrap();
    let item = &run.items[0];
    store
        .submit_memory_recall(
            run.run_id,
            item.item_type,
            item.item_id,
            "I do not know.".into(),
        )
        .unwrap();
    let scored = store.get_review_material(run.run_id).unwrap();
    assert_eq!(
        scored.items[0].model_answer.as_deref(),
        Some("I work there as a developer.")
    );
    assert!(!scored.items[0].is_cued);
    assert!(store.reveal_review_phrase(run.run_id, 1).is_err());
}

#[test]
fn provider_failure_is_cached_and_only_explicit_retry_regenerates() {
    let store = SessionStore::default();
    let run = seed(&store);
    let failure = store
        .prepare_review_material(run.run_id, false, |_| {
            Err(ProviderError::new(
                ProviderErrorCode::Timeout,
                "Please retry.",
            ))
        })
        .unwrap();
    assert!(matches!(
        failure.preparation,
        ReviewPreparation::Failed { .. }
    ));
    store
        .prepare_review_material(run.run_id, false, |_| {
            panic!("failed request must not retry automatically")
        })
        .unwrap();
    let retried = store
        .prepare_review_material(run.run_id, true, material)
        .unwrap();
    assert!(matches!(retried.preparation, ReviewPreparation::Ready));
}

#[test]
fn invalid_generated_material_is_never_partially_accepted() {
    let store = SessionStore::default();
    let run = seed(&store);
    let result = store
        .prepare_review_material(run.run_id, false, |request| {
            let mut result = material(request)?;
            result.items[0].situation = "Say I work there.".into();
            Ok(result)
        })
        .unwrap();
    assert!(
        matches!(result.preparation, ReviewPreparation::Failed { error } if error.code == ProviderErrorCode::InvalidOutput)
    );
    assert!(result.items[0].situation.is_none());
}

#[test]
fn cue_and_cached_material_survive_reopen_without_granting_independent_use() {
    let path = std::env::temp_dir().join(format!(
        "review-material-reopen-{}.sqlite3",
        std::process::id()
    ));
    let _ = std::fs::remove_file(&path);
    let store = SessionStore::open(&path).unwrap();
    let run = seed(&store);
    store
        .prepare_review_material(run.run_id, false, material)
        .unwrap();
    let hint = store.reveal_review_phrase(run.run_id, 1).unwrap();
    assert!(hint.items[0].is_cued);
    assert_eq!(hint.items[0].hint.as_deref(), Some("I work there"));
    assert!(hint.items[0].model_answer.is_none());
    assert!(store.reveal_review_phrase(run.run_id, 2).is_err());
    drop(store);
    let reopened = SessionStore::open(&path).unwrap();
    let retained = reopened.get_review_material(run.run_id).unwrap();
    assert!(retained.items[0].is_cued);
    reopened
        .prepare_review_material(run.run_id, false, |_| {
            panic!("cached material must survive restart")
        })
        .unwrap();
    let item = &run.items[0];
    reopened
        .submit_memory_recall(
            run.run_id,
            LearningItemType::Mistake,
            item.item_id,
            "I work there as a developer.".into(),
        )
        .unwrap();
    let memory = reopened.get_learning_memory().unwrap();
    assert_eq!(memory.mistakes[0].times_correct_afterwards, 0);
    drop(reopened);
    std::fs::remove_file(path).unwrap();
}

#[test]
fn slow_generation_does_not_hold_session_lock_and_cannot_revive_an_ended_run() {
    let store = SessionStore::default();
    let run = seed(&store);
    let (entered_tx, entered_rx) = std::sync::mpsc::channel();
    let (release_tx, release_rx) = std::sync::mpsc::channel();
    let worker = store.clone();
    let task = std::thread::spawn(move || {
        worker.prepare_review_material(run.run_id, false, |request| {
            entered_tx.send(()).unwrap();
            release_rx
                .recv_timeout(std::time::Duration::from_secs(5))
                .unwrap();
            material(request)
        })
    });
    entered_rx
        .recv_timeout(std::time::Duration::from_secs(5))
        .unwrap();
    assert_eq!(
        store
            .prepare_review_material(run.run_id, false, material)
            .unwrap_err()
            .code,
        ProviderErrorCode::Busy
    );
    store.reveal_review_phrase(run.run_id, 1).unwrap();
    store.finish_memory_review(run.run_id).unwrap();
    release_tx.send(()).unwrap();
    assert!(task.join().unwrap().is_err());
    assert!(store.get_memory_review().unwrap().is_none());
    let next = store.start_memory_review().unwrap().unwrap();
    assert_ne!(next.run_id, run.run_id);
    assert!(matches!(
        store.get_review_material(next.run_id).unwrap().preparation,
        ReviewPreparation::Legacy
    ));
    assert!(!store.get_review_material(next.run_id).unwrap().items[0].is_cued);
}

#[test]
fn interrupted_preparation_can_resume_after_restart() {
    let path = std::env::temp_dir().join(format!(
        "review-material-pending-{}.sqlite3",
        std::process::id()
    ));
    let _ = std::fs::remove_file(&path);
    let store = SessionStore::open(&path).unwrap();
    let run = seed(&store);
    store
        .lock()
        .database
        .begin_review_material(run.run_id)
        .unwrap();
    drop(store);
    let store = SessionStore::open(&path).unwrap();
    assert!(matches!(
        store.get_review_material(run.run_id).unwrap().preparation,
        ReviewPreparation::Pending
    ));
    assert!(matches!(
        store
            .prepare_review_material(run.run_id, false, material)
            .unwrap()
            .preparation,
        ReviewPreparation::Ready
    ));
    drop(store);
    std::fs::remove_file(path).unwrap();
}
