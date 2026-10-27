use super::error::LearningError;
use super::memory_recall::{MemoryRecallResult, MemoryReviewRun};
use super::models::LearningItemType;
use super::ports::{ReviewMaterialStore, ReviewRunStore};
use super::review_material::{materials_view, ReviewMaterials};
use super::review_rules::{
    validate_review_id, validate_review_position, validate_transcript, ReviewRejection,
};
use crate::core::{IpcError, IpcErrorCode};
use crate::providers::{
    parse_review_material_result, ProviderError, ReviewMaterialRequest, ReviewMaterialResult,
};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

struct PreparationGuard(Arc<AtomicBool>);

impl PreparationGuard {
    fn acquire(flag: &Arc<AtomicBool>) -> Result<Self, LearningError> {
        flag.compare_exchange(false, true, Ordering::AcqRel, Ordering::Acquire)
            .map_err(|_| LearningError::Review(ReviewRejection::PreparationBusy))?;
        Ok(Self(flag.clone()))
    }
}

impl Drop for PreparationGuard {
    fn drop(&mut self) {
        self.0.store(false, Ordering::Release);
    }
}

#[derive(Clone)]
pub struct ReviewService {
    runs: Arc<dyn ReviewRunStore>,
    material: Arc<dyn ReviewMaterialStore>,
    preparing: Arc<AtomicBool>,
}

fn checked_material(
    request: &ReviewMaterialRequest,
    generated: ReviewMaterialResult,
) -> Result<ReviewMaterialResult, IpcError> {
    let raw = serde_json::to_string(&generated).map_err(|_| {
        IpcError::new(
            IpcErrorCode::InvalidOutput,
            "Could not check review situations. Please retry.",
        )
    })?;
    parse_review_material_result(&raw, request).map_err(IpcError::from)
}

impl ReviewService {
    pub fn new<S>(store: S) -> Self
    where
        S: ReviewRunStore + ReviewMaterialStore + 'static,
    {
        let shared = Arc::new(store);
        Self {
            runs: shared.clone(),
            material: shared,
            preparing: Arc::new(AtomicBool::new(false)),
        }
    }

    pub fn start(&self, is_warmup: bool) -> Result<Option<MemoryReviewRun>, LearningError> {
        self.runs.start(is_warmup)
    }

    pub fn active(&self) -> Result<Option<MemoryReviewRun>, LearningError> {
        self.runs.active()
    }

    pub fn submit_recall(
        &self,
        run_id: u64,
        item_type: LearningItemType,
        item_id: u64,
        transcript: &str,
    ) -> Result<MemoryRecallResult, LearningError> {
        let transcript = validate_transcript(transcript)?;
        validate_review_id(run_id)?;
        validate_review_id(item_id)?;
        self.runs
            .record_recall(run_id, item_type, item_id, transcript)
    }

    pub fn skip(
        &self,
        run_id: u64,
        item_type: LearningItemType,
        item_id: u64,
    ) -> Result<MemoryReviewRun, LearningError> {
        validate_review_id(run_id)?;
        validate_review_id(item_id)?;
        self.runs.skip(run_id, item_type, item_id)
    }

    pub fn finish(&self, run_id: u64) -> Result<(), LearningError> {
        validate_review_id(run_id)?;
        self.runs.finish(run_id)
    }

    pub fn materials(&self, run_id: u64) -> Result<ReviewMaterials, LearningError> {
        let (rows, stored) = self.material.read(run_id)?;
        Ok(materials_view(run_id, rows, stored))
    }

    pub fn prepare_materials<F>(
        &self,
        run_id: u64,
        retry: bool,
        generate: F,
    ) -> Result<ReviewMaterials, LearningError>
    where
        F: FnOnce(&ReviewMaterialRequest) -> Result<ReviewMaterialResult, ProviderError>,
    {
        let existing = self.materials(run_id)?;
        if existing.is_settled(retry) {
            return Ok(existing);
        }
        let _guard = PreparationGuard::acquire(&self.preparing)?;
        let Some(request) = self.material.begin_preparation(run_id, retry)? else {
            return self.materials(run_id);
        };
        let result = generate(&request)
            .map_err(IpcError::from)
            .and_then(|generated| checked_material(&request, generated));
        self.material.complete_preparation(run_id, &result)?;
        self.materials(run_id)
    }

    pub fn reveal_phrase(
        &self,
        run_id: u64,
        position: usize,
    ) -> Result<ReviewMaterials, LearningError> {
        validate_review_position(position)?;
        self.material.reveal_phrase(run_id, position)?;
        self.materials(run_id)
    }
}
