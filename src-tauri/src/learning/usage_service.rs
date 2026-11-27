use super::error::LearningError;
use super::ports::UsageStore;
use super::usage::TurnUsageAssessment;
#[cfg(test)]
use super::usage_rules::validate_saved_turn;
use super::usage_rules::{
    already_running, validate_findings, validate_review_turn, UsagePreparation,
};
use crate::providers::{
    ProviderError, UsageBatchAnswer, UsageBatchResult, UsageReviewRequest, UsageReviewResponse,
};
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

/// How many answers one provider call reviews; a longer session is reviewed in several calls.
pub const MAX_BATCH_ANSWERS: usize = 12;

/// What one run over a finished session settled: the assessment of every answer now saved. A
/// `failed` answer is still unreviewed and a later run reviews it.
#[derive(Debug, Clone, PartialEq, Default)]
pub struct SessionReviewReport {
    pub assessments: Vec<TurnUsageAssessment>,
    pub failed: usize,
}

struct WaitingAnswer {
    sequence: usize,
    request: UsageReviewRequest,
    turn_time: i64,
    _guard: ReviewGuard,
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

    #[cfg(test)]
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

    /// Sessions that ended since `ended_since` (ms) and still have a reviewable answer without an
    /// assessment.
    pub fn unreviewed_sessions(&self, ended_since: i64) -> Result<Vec<u64>, LearningError> {
        self.store.unreviewed_sessions(ended_since)
    }

    /// Reviews every answer of the session the usage review covers (answers 1 and 2, and each
    /// answer that followed a steered question) with one provider call per `MAX_BATCH_ANSWERS`.
    /// An answer assessed before is not asked again, so a repeated run costs nothing.
    pub fn review_session<F>(
        &self,
        session_id: u64,
        mut generate: F,
    ) -> Result<SessionReviewReport, LearningError>
    where
        F: FnMut(&[UsageBatchAnswer]) -> Result<Vec<UsageBatchResult>, ProviderError>,
    {
        validate_review_turn(session_id, 1)?;
        let mut report = SessionReviewReport::default();
        let mut waiting = Vec::new();
        for sequence in self.store.reviewable_answers(session_id)? {
            let guard = ReviewGuard::acquire(&self.in_flight, (session_id, sequence))?;
            match self.store.prepare(session_id, sequence) {
                Ok(UsagePreparation::NeedsReview { request, turn_time }) => {
                    waiting.push(WaitingAnswer {
                        sequence,
                        request,
                        turn_time,
                        _guard: guard,
                    });
                }
                Ok(UsagePreparation::Saved(assessment))
                | Ok(UsagePreparation::NothingToAssess(assessment)) => {
                    report.assessments.push(assessment);
                }
                Err(_) => report.failed += 1,
            }
        }
        for chunk in waiting.chunks(MAX_BATCH_ANSWERS) {
            let answers: Vec<UsageBatchAnswer> = chunk
                .iter()
                .map(|answer| UsageBatchAnswer {
                    sequence: answer.sequence,
                    request: answer.request.clone(),
                })
                .collect();
            let results = generate(&answers).map_err(LearningError::Provider)?;
            for answer in chunk {
                let committed = results
                    .iter()
                    .find(|result| result.sequence == answer.sequence)
                    .map(|result| self.commit(session_id, answer, &result.response));
                match committed {
                    Some(Ok(assessment)) => report.assessments.push(assessment),
                    _ => report.failed += 1,
                }
            }
        }
        Ok(report)
    }

    fn commit(
        &self,
        session_id: u64,
        answer: &WaitingAnswer,
        response: &UsageReviewResponse,
    ) -> Result<TurnUsageAssessment, LearningError> {
        validate_findings(&answer.request, response)?;
        self.store.finalize(
            &answer.request,
            answer.turn_time,
            response,
            (session_id, answer.sequence),
        )
    }

    #[cfg(test)]
    pub fn saved(
        &self,
        session_id: u64,
        sequence: usize,
    ) -> Result<Option<TurnUsageAssessment>, LearningError> {
        validate_saved_turn(session_id, sequence)?;
        self.store.saved(session_id, sequence)
    }
}
