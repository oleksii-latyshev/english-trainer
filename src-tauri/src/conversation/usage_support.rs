use super::{database_error, State};
use crate::learning::{
    contains_normalized_words, LearningItemType, TurnUsageAssessment, UsageOutcome,
    MAX_EXCERPT_CHARS, MIN_CONFIDENCE,
};
use crate::providers::{ProviderError, ProviderErrorCode, UsageReviewRequest, UsageReviewResponse};
use std::collections::HashSet;
use std::sync::{Arc, Mutex};

pub(crate) struct UsageInFlightTracker {
    pub(crate) in_flight: Mutex<HashSet<(u64, usize)>>,
}

impl UsageInFlightTracker {
    pub(crate) fn new() -> Self {
        Self {
            in_flight: Mutex::new(HashSet::new()),
        }
    }
}

pub(super) struct InFlightGuard {
    pub(super) tracker: Arc<UsageInFlightTracker>,
    pub(super) key: (u64, usize),
}

impl Drop for InFlightGuard {
    fn drop(&mut self) {
        if let Ok(mut set) = self.tracker.in_flight.lock() {
            set.remove(&self.key);
        }
    }
}

pub(super) fn stale_usage_review_error() -> ProviderError {
    ProviderError::new(
        ProviderErrorCode::InvalidRequest,
        "The saved answer or learning targets changed during review. Please try again.",
    )
}

pub(super) fn mark_assessment_exposure(
    state: &mut State,
    assessment: &TurnUsageAssessment,
) -> Result<(), ProviderError> {
    let mut sessions = HashSet::from([assessment.session_id]);
    if let Some(active) = &state.active {
        sessions.insert(active.id);
    }
    for session_id in sessions {
        for finding in &assessment.findings {
            state
                .database
                .record_session_cue_exposure(
                    session_id,
                    Some(match finding.item_type {
                        LearningItemType::Mistake => "mistake",
                        LearningItemType::Phrase => "phrase",
                    }),
                    Some(finding.item_id),
                    now_ms(),
                )
                .map_err(database_error)?;
        }
    }
    Ok(())
}

pub(super) fn mark_active_memory_exposure(state: &mut State) -> Result<(), ProviderError> {
    if let Some(active) = &state.active {
        state
            .database
            .record_session_cue_exposure(active.id, None, None, now_ms())
            .map_err(database_error)?;
    }
    Ok(())
}

pub(super) fn now_ms() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64
}

pub(super) fn validate_review_response(
    request: &UsageReviewRequest,
    response: &UsageReviewResponse,
) -> Result<(), ProviderError> {
    use std::collections::HashSet;

    let invalid = || {
        ProviderError::new(
            ProviderErrorCode::InvalidOutput,
            "The AI review returned findings that could not be verified. Please retry.",
        )
    };
    if request.candidates.is_empty()
        || request.candidates.len() > 3
        || response.findings.len() != request.candidates.len()
    {
        return Err(invalid());
    }
    let mut candidates = HashSet::new();
    for candidate in &request.candidates {
        if candidate.item_id == 0 || !candidates.insert((candidate.item_type, candidate.item_id)) {
            return Err(invalid());
        }
    }
    let mut seen = HashSet::new();
    for finding in &response.findings {
        let Some(candidate) = request.candidates.iter().find(|candidate| {
            candidate.item_type == finding.item_type && candidate.item_id == finding.item_id
        }) else {
            return Err(invalid());
        };
        if !seen.insert((finding.item_type, finding.item_id))
            || !finding.confidence.is_finite()
            || !(0.0..=1.0).contains(&finding.confidence)
            || finding.exact_excerpt.chars().count() > MAX_EXCERPT_CHARS
        {
            return Err(invalid());
        }
        match finding.outcome {
            UsageOutcome::Correct => {
                if finding.confidence < MIN_CONFIDENCE
                    || finding.exact_excerpt.is_empty()
                    || !request.transcript.contains(&finding.exact_excerpt)
                    || !contains_normalized_words(&finding.exact_excerpt, &candidate.target)
                {
                    return Err(invalid());
                }
            }
            UsageOutcome::Incorrect => {
                let has_original_mistake = candidate.item_type == LearningItemType::Mistake
                    && contains_normalized_words(&finding.exact_excerpt, &candidate.cue);
                if finding.confidence < MIN_CONFIDENCE
                    || finding.exact_excerpt.is_empty()
                    || !request.transcript.contains(&finding.exact_excerpt)
                    || (!contains_normalized_words(&finding.exact_excerpt, &candidate.target)
                        && !has_original_mistake)
                {
                    return Err(invalid());
                }
            }
            UsageOutcome::Uncertain => {
                if !finding.exact_excerpt.is_empty()
                    && !request.transcript.contains(&finding.exact_excerpt)
                {
                    return Err(invalid());
                }
            }
        }
    }
    Ok(())
}
