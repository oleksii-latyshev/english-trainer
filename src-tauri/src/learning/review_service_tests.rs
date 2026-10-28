use super::review_material::ReviewPreparation;
use super::{LearningItemType, MemoryReviewRun, ReviewService, SessionLearningStore};
use crate::conversation::SessionStore;
use crate::providers::{
    GeneratedReviewMaterial, ProviderError, ProviderErrorCode, ReviewMaterialRequest,
    ReviewMaterialResult,
};

fn service(store: &SessionStore) -> ReviewService {
    ReviewService::new(SessionLearningStore::new(store.clone()))
}

fn seed(store: &SessionStore) -> (ReviewService, MemoryReviewRun) {
    store
        .with_database(|database, _| {
            let card = database.save_phrase_card("I work there", "Where you work", None, None)?;
            database
                .connection()
                .execute("UPDATE phrase_cards SET next_review_at = 0", [])?;
            Ok::<_, rusqlite::Error>(card)
        })
        .unwrap();
    let service = service(store);
    let run = service.start(false).unwrap().unwrap();
    (service, run)
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
    let (service, run) = seed(&store);
    let prepared = service
        .prepare_materials(run.run_id, false, material)
        .unwrap();
    assert!(matches!(prepared.preparation, ReviewPreparation::Ready));
    assert!(prepared.items[0].situation.is_some());
    assert!(prepared.items[0].model_answer.is_none());
    assert!(prepared.items[0].hint.is_none());
    service
        .prepare_materials(run.run_id, true, |_| panic!("ready cache must be reused"))
        .unwrap();
    let item = &run.items[0];
    service
        .submit_recall(run.run_id, item.item_type, item.item_id, "I do not know.")
        .unwrap();
    let scored = service.materials(run.run_id).unwrap();
    assert_eq!(
        scored.items[0].model_answer.as_deref(),
        Some("I work there as a developer.")
    );
    assert!(!scored.items[0].is_cued);
    assert!(service.reveal_phrase(run.run_id, 1).is_err());
}

#[test]
fn provider_failure_is_cached_and_only_explicit_retry_regenerates() {
    let store = SessionStore::default();
    let (service, run) = seed(&store);
    let failure = service
        .prepare_materials(run.run_id, false, |_| {
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
    service
        .prepare_materials(run.run_id, false, |_| {
            panic!("failed request must not retry automatically")
        })
        .unwrap();
    let retried = service
        .prepare_materials(run.run_id, true, material)
        .unwrap();
    assert!(matches!(retried.preparation, ReviewPreparation::Ready));
}

#[test]
fn invalid_generated_material_is_never_partially_accepted() {
    let store = SessionStore::default();
    let (service, run) = seed(&store);
    let result = service
        .prepare_materials(run.run_id, false, |request| {
            let mut result = material(request)?;
            result.items[0].situation = "Say I work there.".into();
            Ok(result)
        })
        .unwrap();
    assert!(matches!(
        result.preparation,
        ReviewPreparation::Failed { error } if error.code == crate::core::IpcErrorCode::InvalidOutput
    ));
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
    let (service, run) = seed(&store);
    service
        .prepare_materials(run.run_id, false, material)
        .unwrap();
    let hint = service.reveal_phrase(run.run_id, 1).unwrap();
    assert!(hint.items[0].is_cued);
    assert_eq!(hint.items[0].hint.as_deref(), Some("I work there"));
    assert!(hint.items[0].model_answer.is_none());
    assert!(service.reveal_phrase(run.run_id, 2).is_err());
    drop(service);
    drop(store);
    let reopened = SessionStore::open(&path).unwrap();
    let service = self::service(&reopened);
    let retained = service.materials(run.run_id).unwrap();
    assert!(retained.items[0].is_cued);
    service
        .prepare_materials(run.run_id, false, |_| {
            panic!("cached material must survive restart")
        })
        .unwrap();
    let item = &run.items[0];
    service
        .submit_recall(
            run.run_id,
            LearningItemType::Phrase,
            item.item_id,
            "I work there as a developer.",
        )
        .unwrap();
    let memory = reopened.get_learning_memory().unwrap();
    assert_eq!(memory.phrase_cards[0].times_used_on_own, 0);
    drop(service);
    drop(reopened);
    std::fs::remove_file(path).unwrap();
}

#[test]
fn slow_generation_does_not_hold_session_lock_and_cannot_revive_an_ended_run() {
    let store = SessionStore::default();
    let (service, run) = seed(&store);
    let (entered_tx, entered_rx) = std::sync::mpsc::channel();
    let (release_tx, release_rx) = std::sync::mpsc::channel();
    let worker = service.clone();
    let task = std::thread::spawn(move || {
        worker.prepare_materials(run.run_id, false, |request| {
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
        crate::core::IpcError::from(
            service
                .prepare_materials(run.run_id, false, material)
                .unwrap_err()
        )
        .code,
        crate::core::IpcErrorCode::Busy
    );
    service.reveal_phrase(run.run_id, 1).unwrap();
    service.finish(run.run_id).unwrap();
    release_tx.send(()).unwrap();
    assert!(task.join().unwrap().is_err());
    assert!(service.active().unwrap().is_none());
    let next = service.start(false).unwrap().unwrap();
    assert_ne!(next.run_id, run.run_id);
    assert!(matches!(
        service.materials(next.run_id).unwrap().preparation,
        ReviewPreparation::Legacy
    ));
    assert!(!service.materials(next.run_id).unwrap().items[0].is_cued);
}

#[test]
fn interrupted_preparation_can_resume_after_restart() {
    let path = std::env::temp_dir().join(format!(
        "review-material-pending-{}.sqlite3",
        std::process::id()
    ));
    let _ = std::fs::remove_file(&path);
    let store = SessionStore::open(&path).unwrap();
    let (service, run) = seed(&store);
    store
        .with_connection(|connection| {
            super::infra::review_material::begin_preparation(connection, run.run_id)
        })
        .unwrap();
    drop(service);
    drop(store);
    let store = SessionStore::open(&path).unwrap();
    let service = self::service(&store);
    assert!(matches!(
        service.materials(run.run_id).unwrap().preparation,
        ReviewPreparation::Pending
    ));
    assert!(matches!(
        service
            .prepare_materials(run.run_id, false, material)
            .unwrap()
            .preparation,
        ReviewPreparation::Ready
    ));
    drop(service);
    drop(store);
    std::fs::remove_file(path).unwrap();
}

#[test]
fn blank_or_oversized_answers_and_unsafe_ids_never_reach_the_store() {
    let store = SessionStore::default();
    let (service, run) = seed(&store);
    let item = &run.items[0];
    for transcript in ["   ", &"x".repeat(4001)] {
        assert!(service
            .submit_recall(run.run_id, item.item_type, item.item_id, transcript)
            .is_err());
    }
    for unsafe_id in [0, 9_007_199_254_740_992] {
        assert!(service
            .submit_recall(run.run_id, item.item_type, unsafe_id, "I work there.")
            .is_err());
        assert!(service
            .skip(unsafe_id, item.item_type, item.item_id)
            .is_err());
        assert!(service.finish(unsafe_id).is_err());
    }
    assert!(service.active().unwrap().unwrap().items[0]
        .saved_response
        .is_none());
}
