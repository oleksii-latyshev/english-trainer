use super::error::LearningError;
use super::ports::UsageStore;
use super::usage::TurnUsageAssessment;
use super::usage_rules::{
    already_running, validate_findings, validate_review_turn, validate_saved_turn, UsagePreparation,
};
use crate::providers::{ProviderError, UsageReviewRequest, UsageReviewResponse};
use std::collections::HashSet;
use std::sync::{Arc, Mutex};

type TurnKey = (u64, usize);

struct ReviewGuard {
    in_flight: Arc<Mutex<HashSet<TurnKey>>>,
    key: TurnKey,
}

impl ReviewGuard {
    fn acquire(
        in_flight: &Arc<Mutex<HashSet<TurnKey>>>,
        key: TurnKey,
    ) -> Result<Self, LearningError> {
        let mut running = in_flight
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        if !running.insert(key) {
            return Err(already_running());
        }
        Ok(Self {
            in_flight: in_flight.clone(),
            key,
        })
    }
}

impl Drop for ReviewGuard {
    fn drop(&mut self) {
        let mut running = self
            .in_flight
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        running.remove(&self.key);
    }
}

#[derive(Clone)]
pub struct UsageReviewService {
    store: Arc<dyn UsageStore>,
    in_flight: Arc<Mutex<HashSet<TurnKey>>>,
}

impl UsageReviewService {
    pub fn new(store: impl UsageStore + 'static) -> Self {
        Self {
            store: Arc::new(store),
            in_flight: Arc::new(Mutex::new(HashSet::new())),
        }
    }

    pub fn review<F>(
        &self,
        session_id: u64,
        sequence: usize,
        generate: F,
    ) -> Result<TurnUsageAssessment, LearningError>
    where
        F: FnOnce(&UsageReviewRequest) -> Result<UsageReviewResponse, ProviderError>,
    {
        validate_review_turn(session_id, sequence)?;
        let _guard = ReviewGuard::acquire(&self.in_flight, (session_id, sequence))?;
        let (request, turn_time) = match self.store.prepare(session_id, sequence)? {
            UsagePreparation::Saved(assessment) | UsagePreparation::NothingToAssess(assessment) => {
                return Ok(assessment)
            }
            UsagePreparation::NeedsReview { request, turn_time } => (request, turn_time),
        };
        let response = generate(&request).map_err(LearningError::Provider)?;
        validate_findings(&request, &response)?;
        self.store
            .finalize(&request, turn_time, &response, (session_id, sequence))
    }

    pub fn saved(
        &self,
        session_id: u64,
        sequence: usize,
    ) -> Result<Option<TurnUsageAssessment>, LearningError> {
        validate_saved_turn(session_id, sequence)?;
        self.store.saved(session_id, sequence)
    }
}
