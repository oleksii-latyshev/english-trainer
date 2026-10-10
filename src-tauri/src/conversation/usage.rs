use super::usage_support::{
    mark_active_memory_exposure, mark_assessment_exposure, now_ms, stale_usage_review_error,
    validate_review_response, InFlightGuard,
};
use super::{database_error, invalid_session_error, SessionStore, MAX_SAFE_SESSION_ID};
use crate::learning::{
    LearningItemType, LearningMemoryView, LearningStatus, MemoryUsageEvidence, TurnUsageAssessment,
    UsageAssessmentFinding, UsageEventRecord, UsageOutcome, MIN_CONFIDENCE,
};
use crate::persistence::learning_usage::UsageAssessmentCommit;
use crate::providers::{ProviderError, ProviderErrorCode, UsageReviewRequest, UsageReviewResponse};
impl SessionStore {
    pub fn review_memory_usage<F>(
        &self,
        session_id: u64,
        sequence: usize,
        generate: F,
    ) -> Result<TurnUsageAssessment, ProviderError>
    where
        F: FnOnce(&UsageReviewRequest) -> Result<UsageReviewResponse, ProviderError>,
    {
        if session_id == 0 || session_id > MAX_SAFE_SESSION_ID || sequence == 0 || sequence > 2 {
            return Err(ProviderError::new(
                ProviderErrorCode::InvalidRequest,
                "Usage review is only available for conversation answers 1 and 2.",
            ));
        }

        let _guard = {
            let mut inflight = self
                .usage_in_flight
                .in_flight
                .lock()
                .unwrap_or_else(|p| p.into_inner());
            if inflight.contains(&(session_id, sequence)) {
                return Err(ProviderError::new(
                    ProviderErrorCode::Busy,
                    "A memory usage review is already running for this answer.",
                ));
            }
            inflight.insert((session_id, sequence));
            InFlightGuard {
                tracker: self.usage_in_flight.clone(),
                key: (session_id, sequence),
            }
        };

        let (request, turn_time) = {
            let mut state = self.lock();
            if !state
                .database
                .is_voice_turn(session_id, sequence)
                .map_err(database_error)?
            {
                return Err(ProviderError::new(
                    ProviderErrorCode::InvalidRequest,
                    "Typed or edited answers cannot count as independent spoken memory evidence.",
                ));
            }
            if state
                .database
                .has_answer_help_used(session_id, sequence)
                .map_err(database_error)?
            {
                return Err(ProviderError::new(
                    ProviderErrorCode::InvalidRequest,
                    "This answer used help. Independent evidence needs an answer without help.",
                ));
            }
            if let Some(saved) = state
                .database
                .get_turn_usage_assessment(session_id, sequence)
                .map_err(database_error)?
            {
                mark_assessment_exposure(&mut state, &saved)?;
                return Ok(saved);
            }

            let prepared = state
                .database
                .prepare_usage_review(session_id, sequence)
                .map_err(database_error)?
                .ok_or_else(invalid_session_error)?;
            if !prepared.is_conversation {
                return Err(ProviderError::new(
                    ProviderErrorCode::InvalidRequest,
                    "Usage review is only available for conversation sessions.",
                ));
            }

            let turn_time = prepared.turn_time;
            let request = prepared.request;
            let candidates = &request.candidates;

            if candidates.is_empty() {
                let assessment = TurnUsageAssessment {
                    session_id,
                    sequence,
                    assessed_at: now_ms(),
                    findings: Vec::new(),
                };
                let active_session_id = state.active.as_ref().map(|active| active.id);
                return state
                    .database
                    .save_turn_usage_assessment(UsageAssessmentCommit {
                        session_id,
                        sequence,
                        request: &request,
                        turn_time,
                        assessment,
                        events: &[],
                        active_session_id,
                    })
                    .map_err(database_error)?
                    .ok_or_else(stale_usage_review_error);
            }

            (request, turn_time)
        };

        let response = generate(&request)?;

        validate_review_response(&request, &response)?;

        let mut state = self.lock();
        if let Some(saved) = state
            .database
            .get_turn_usage_assessment(session_id, sequence)
            .map_err(database_error)?
        {
            mark_assessment_exposure(&mut state, &saved)?;
            return Ok(saved);
        }

        let mut findings = Vec::new();
        let mut events = Vec::new();
        let assessed_at = now_ms();

        for candidate in &request.candidates {
            let finding = response
                .findings
                .iter()
                .find(|f| f.item_type == candidate.item_type && f.item_id == candidate.item_id);

            let (outcome, confidence, excerpt) = match finding {
                Some(f) => (f.outcome, f.confidence, f.exact_excerpt.clone()),
                None => (UsageOutcome::Uncertain, 0.0, String::new()),
            };

            let exposed_prior = state
                .database
                .has_session_cue_exposure_before(
                    session_id,
                    Some(match candidate.item_type {
                        LearningItemType::Mistake => "mistake",
                        LearningItemType::Phrase => "phrase",
                    }),
                    Some(candidate.item_id),
                    turn_time,
                )
                .map_err(database_error)?;

            let is_candidate_still_valid = match candidate.item_type {
                LearningItemType::Mistake => {
                    let res = state
                        .database
                        .usage_item_target(candidate.item_type, candidate.item_id)
                        .map_err(database_error)?;
                    match res {
                        Some((corr, status)) => status != "archived" && corr == candidate.target,
                        None => false,
                    }
                }
                LearningItemType::Phrase => {
                    let res = state
                        .database
                        .usage_item_target(candidate.item_type, candidate.item_id)
                        .map_err(database_error)?;
                    match res {
                        Some((phrase, status)) => {
                            status != "archived" && phrase == candidate.target
                        }
                        None => false,
                    }
                }
            };

            let (final_outcome, credited) = if !is_candidate_still_valid {
                (UsageOutcome::Uncertain, false)
            } else if outcome == UsageOutcome::Correct {
                if exposed_prior || confidence < MIN_CONFIDENCE {
                    (UsageOutcome::Uncertain, false)
                } else {
                    (UsageOutcome::Correct, true)
                }
            } else if outcome == UsageOutcome::Incorrect {
                if confidence < MIN_CONFIDENCE {
                    (UsageOutcome::Uncertain, false)
                } else {
                    (UsageOutcome::Incorrect, true)
                }
            } else {
                (UsageOutcome::Uncertain, false)
            };

            if credited {
                events.push(UsageEventRecord {
                    id: 0,
                    item_type: candidate.item_type,
                    item_id: candidate.item_id,
                    session_id,
                    sequence,
                    origin: "assessment".into(),
                    original_turn_time: turn_time,
                    outcome: final_outcome,
                    exact_excerpt: excerpt.clone(),
                    confidence,
                    created_at: assessed_at,
                });
            }

            let status_after = match candidate.item_type {
                LearningItemType::Mistake => {
                    let s = state
                        .database
                        .usage_item_status(candidate.item_type, candidate.item_id)
                        .map_err(database_error)?
                        .unwrap_or_else(|| "new".into());
                    LearningStatus::parse(&s).unwrap_or(LearningStatus::New)
                }
                LearningItemType::Phrase => {
                    let s = state
                        .database
                        .usage_item_status(candidate.item_type, candidate.item_id)
                        .map_err(database_error)?
                        .unwrap_or_else(|| "learning".into());
                    LearningStatus::parse(&s).unwrap_or(LearningStatus::Learning)
                }
            };

            findings.push(UsageAssessmentFinding {
                item_type: candidate.item_type,
                item_id: candidate.item_id,
                target: candidate.target.clone(),
                outcome: final_outcome,
                confidence,
                exact_excerpt: excerpt,
                credited,
                status_after,
            });
        }

        let assessment = TurnUsageAssessment {
            session_id,
            sequence,
            assessed_at,
            findings,
        };

        let active_session_id = state.active.as_ref().map(|active| active.id);
        state
            .database
            .save_turn_usage_assessment(UsageAssessmentCommit {
                session_id,
                sequence,
                request: &request,
                turn_time,
                assessment,
                events: &events,
                active_session_id,
            })
            .map_err(database_error)?
            .ok_or_else(stale_usage_review_error)
    }

    pub fn get_practice_memory_usage(
        &self,
        session_id: u64,
        sequence: usize,
    ) -> Result<Option<TurnUsageAssessment>, ProviderError> {
        if session_id == 0 || session_id > MAX_SAFE_SESSION_ID || sequence == 0 {
            return Err(ProviderError::new(
                ProviderErrorCode::InvalidRequest,
                "Invalid session or turn sequence.",
            ));
        }
        let mut state = self.lock();
        let saved = state
            .database
            .get_turn_usage_assessment(session_id, sequence)
            .map_err(database_error)?;
        if let Some(assessment) = &saved {
            mark_assessment_exposure(&mut state, assessment)?;
        }
        Ok(saved)
    }

    pub fn get_memory_usage_evidence(
        &self,
        item_type: LearningItemType,
        item_id: u64,
    ) -> Result<MemoryUsageEvidence, ProviderError> {
        if item_id == 0 || item_id > MAX_SAFE_SESSION_ID {
            return Err(ProviderError::new(
                ProviderErrorCode::InvalidRequest,
                "Invalid item ID.",
            ));
        }
        let mut state = self.lock();
        mark_active_memory_exposure(&mut state)?;
        match state.database.get_memory_usage_evidence(item_type, item_id) {
            Ok(evidence) => Ok(evidence),
            Err(rusqlite::Error::QueryReturnedNoRows) => Err(ProviderError::new(
                ProviderErrorCode::InvalidRequest,
                "The requested learning item does not exist.",
            )),
            Err(error) => Err(database_error(error)),
        }
    }

    pub fn view_learning_memory(&self) -> Result<LearningMemoryView, ProviderError> {
        let mut state = self.lock();
        mark_active_memory_exposure(&mut state)?;
        state.database.get_learning_memory().map_err(database_error)
    }
}

#[cfg(test)]
#[path = "usage_tests.rs"]
mod tests;
