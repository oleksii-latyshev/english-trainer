use super::exposure::{has_cue_exposure_before, record_cue_exposure};
use super::read::{item_status, item_target_and_status, prepare_usage_review_on, saved_assessment};
use super::write::{save_turn_usage_assessment, UsageAssessmentCommit};
use crate::learning::infra::ids::{now_ms, storage};
use crate::learning::usage_rules::{
    credit_decision, help_used, not_conversation, not_spoken, stale_review, unknown_turn,
    UsagePreparation,
};
use crate::learning::{
    LearningError, LearningItemType, LearningStatus, TurnUsageAssessment, UsageAssessmentFinding,
    UsageEventRecord,
};
use crate::persistence::SessionDatabase;
use crate::providers::{UsageReviewRequest, UsageReviewResponse};
use std::collections::HashSet;

fn type_name(item_type: LearningItemType) -> &'static str {
    match item_type {
        LearningItemType::Mistake => "mistake",
        LearningItemType::Phrase => "phrase",
    }
}

fn mark_assessment_exposure(
    database: &mut SessionDatabase,
    active_session_id: Option<u64>,
    assessment: &TurnUsageAssessment,
) -> Result<(), LearningError> {
    let mut sessions = HashSet::from([assessment.session_id]);
    sessions.extend(active_session_id);
    for session_id in sessions {
        for finding in &assessment.findings {
            record_cue_exposure(
                database.connection_mut(),
                session_id,
                Some(type_name(finding.item_type)),
                Some(finding.item_id),
                now_ms(),
            )
            .map_err(storage("update"))?;
        }
    }
    Ok(())
}

pub(crate) fn read_saved_assessment(
    database: &mut SessionDatabase,
    active_session_id: Option<u64>,
    session_id: u64,
    sequence: usize,
) -> Result<Option<TurnUsageAssessment>, LearningError> {
    let saved = saved_assessment(database.connection_mut(), session_id, sequence)
        .map_err(storage("read"))?;
    if let Some(assessment) = &saved {
        mark_assessment_exposure(database, active_session_id, assessment)?;
    }
    Ok(saved)
}

pub(crate) fn prepare_review(
    database: &mut SessionDatabase,
    active_session_id: Option<u64>,
    session_id: u64,
    sequence: usize,
) -> Result<UsagePreparation, LearningError> {
    if !database
        .is_voice_turn(session_id, sequence)
        .map_err(storage("read"))?
    {
        return Err(not_spoken());
    }
    if database
        .has_answer_help_used(session_id, sequence)
        .map_err(storage("read"))?
    {
        return Err(help_used());
    }
    if let Some(saved) = read_saved_assessment(database, active_session_id, session_id, sequence)? {
        return Ok(UsagePreparation::Saved(saved));
    }
    let prepared = prepare_usage_review_on(database.connection_mut(), session_id, sequence)
        .map_err(storage("read"))?
        .ok_or_else(unknown_turn)?;
    if !prepared.is_conversation {
        return Err(not_conversation());
    }
    if !prepared.request.candidates.is_empty() {
        return Ok(UsagePreparation::NeedsReview {
            request: prepared.request,
            turn_time: prepared.turn_time,
        });
    }
    let assessment = TurnUsageAssessment {
        session_id,
        sequence,
        assessed_at: now_ms(),
        findings: Vec::new(),
    };
    save_turn_usage_assessment(
        database.connection_mut(),
        UsageAssessmentCommit {
            session_id,
            sequence,
            request: &prepared.request,
            turn_time: prepared.turn_time,
            assessment,
            events: &[],
            active_session_id,
        },
    )
    .map_err(storage("update"))?
    .map(UsagePreparation::NothingToAssess)
    .ok_or_else(stale_review)
}

fn is_target_unchanged(
    database: &SessionDatabase,
    item_type: LearningItemType,
    item_id: u64,
    target: &str,
) -> Result<bool, LearningError> {
    let current = item_target_and_status(database.connection(), item_type, item_id)
        .map_err(storage("read"))?;
    Ok(current
        .is_some_and(|(current_target, status)| status != "archived" && current_target == target))
}

fn status_after(
    database: &SessionDatabase,
    item_type: LearningItemType,
    item_id: u64,
) -> Result<LearningStatus, LearningError> {
    let fallback = match item_type {
        LearningItemType::Mistake => LearningStatus::New,
        LearningItemType::Phrase => LearningStatus::Learning,
    };
    let status = item_status(database.connection(), item_type, item_id).map_err(storage("read"))?;
    Ok(status
        .as_deref()
        .and_then(LearningStatus::parse)
        .unwrap_or(fallback))
}

pub(crate) fn finalize_review(
    database: &mut SessionDatabase,
    active_session_id: Option<u64>,
    request: &UsageReviewRequest,
    turn_time: i64,
    response: &UsageReviewResponse,
    turn: (u64, usize),
) -> Result<TurnUsageAssessment, LearningError> {
    let (session_id, sequence) = turn;
    if let Some(saved) = read_saved_assessment(database, active_session_id, session_id, sequence)? {
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
        let (reported, confidence, excerpt) = match finding {
            Some(f) => (f.outcome, f.confidence, f.exact_excerpt.clone()),
            None => (crate::learning::UsageOutcome::Uncertain, 0.0, String::new()),
        };
        let was_cued = has_cue_exposure_before(
            database.connection(),
            session_id,
            Some(type_name(candidate.item_type)),
            Some(candidate.item_id),
            turn_time,
        )
        .map_err(storage("read"))?;
        let unchanged = is_target_unchanged(
            database,
            candidate.item_type,
            candidate.item_id,
            &candidate.target,
        )?;
        let (outcome, credited) = credit_decision(reported, confidence, was_cued, unchanged);
        if credited {
            events.push(UsageEventRecord {
                id: 0,
                item_type: candidate.item_type,
                item_id: candidate.item_id,
                session_id,
                sequence,
                origin: "assessment".into(),
                original_turn_time: turn_time,
                outcome,
                exact_excerpt: excerpt.clone(),
                confidence,
                created_at: assessed_at,
            });
        }
        findings.push(UsageAssessmentFinding {
            item_type: candidate.item_type,
            item_id: candidate.item_id,
            target: candidate.target.clone(),
            outcome,
            confidence,
            exact_excerpt: excerpt,
            credited,
            status_after: status_after(database, candidate.item_type, candidate.item_id)?,
        });
    }
    let assessment = TurnUsageAssessment {
        session_id,
        sequence,
        assessed_at,
        findings,
    };
    save_turn_usage_assessment(
        database.connection_mut(),
        UsageAssessmentCommit {
            session_id,
            sequence,
            request,
            turn_time,
            assessment,
            events: &events,
            active_session_id,
        },
    )
    .map_err(storage("update"))?
    .ok_or_else(stale_review)
}
