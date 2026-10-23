use super::{active_session_mut, SessionStore, State, SESSION_MODE};
use crate::conversation::domain::rules::MAX_SAFE_SESSION_ID;
use crate::conversation::domain::topics::resolve_start_options;
use crate::conversation::domain::{
    ActiveSession, PracticeMode, PracticePhase, PracticeSession, StartPracticeOptions,
};
use crate::conversation::error::ConversationError;
use crate::conversation::ports::MistakeQuestionSource;
use crate::learning::mistake_practice::MistakePracticeQuestion;
#[cfg(test)]
use crate::learning::mistake_practice::{GeneratedMistakeQuestion, MistakePracticeCandidate};
use crate::persistence::session_metadata::{NewSession, PracticePhaseTransition};
use std::sync::atomic::AtomicBool;
use std::sync::Arc;
use std::time::Instant;

struct MistakePracticePreparationGuard {
    state: Arc<std::sync::Mutex<State>>,
}

impl Drop for MistakePracticePreparationGuard {
    fn drop(&mut self) {
        let mut state = self
            .state
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        state.mistake_practice_preparing = false;
    }
}

impl SessionStore {
    #[cfg(test)]
    pub fn start(&self) -> Result<PracticeSession, ConversationError> {
        self.start_practice_session(None)
    }

    pub fn start_practice_session(
        &self,
        options: Option<StartPracticeOptions>,
    ) -> Result<PracticeSession, ConversationError> {
        let mut state = self.lock();
        if state.mistake_practice_preparing {
            return Err(ConversationError::Busy);
        }
        if let Some(active) = &state.active {
            return self.build_practice_session(&state, active);
        }
        let session_count = state.database.session_count()?;
        let practice_mode = options
            .as_ref()
            .and_then(|options| options.practice_mode)
            .unwrap_or_default();
        let practice_phase = match practice_mode {
            PracticeMode::Voice => PracticePhase::Speaking,
            PracticeMode::TextChat | PracticeMode::WriteThenSpeak => PracticePhase::Writing,
        };
        let (topic, duration_goal_seconds, opening_question) =
            resolve_start_options(options, session_count)?;
        let session_id = state.database.create_session_with_options(NewSession {
            mode: SESSION_MODE,
            opening_question: &opening_question,
            topic_id: &topic.topic_id,
            topic_label: &topic.topic_label,
            topic_custom: topic.topic_custom.as_deref(),
            duration_goal_seconds,
            practice_mode: practice_mode.as_str(),
            practice_phase: practice_phase.as_str(),
            written_turn_count: 0,
            is_mistake_practice: false,
        })?;
        if session_id > MAX_SAFE_SESSION_ID {
            discard_unusable_session(&mut state, session_id);
            return Err(ConversationError::Storage(rusqlite::Error::InvalidQuery));
        }
        let active = ActiveSession {
            id: session_id,
            opening_question,
            turns: Vec::new(),
            in_flight: false,
            reply_cancelled: Arc::new(AtomicBool::new(false)),
            topic_id: topic.topic_id,
            topic_label: topic.topic_label,
            topic_custom: topic.topic_custom,
            duration_goal_seconds,
            active_duration_ms: 0,
            started_at: state
                .database
                .session_metadata(session_id)?
                .ok_or(rusqlite::Error::QueryReturnedNoRows)?
                .started_at,
            clock_anchor: None,
            practice_mode,
            practice_phase,
            written_turn_count: 0,
            is_mistake_practice: false,
            mistake_questions: Vec::new(),
        };
        let practice_session = self.build_practice_session(&state, &active)?;
        state.active = Some(active);
        Ok(practice_session)
    }

    pub(crate) fn start_mistake_practice_with_source(
        &self,
        questions: &mut dyn MistakeQuestionSource,
    ) -> Result<PracticeSession, ConversationError> {
        let candidates = {
            let mut state = self.lock();
            if let Some(active) = &state.active {
                if active.is_mistake_practice {
                    return self.build_practice_session(&state, active);
                }
                return Err(ConversationError::Busy);
            }
            if state.mistake_practice_preparing {
                return Err(ConversationError::Busy);
            }
            let candidates = state.database.recurring_mistakes()?;
            if candidates.is_empty() {
                return Err(ConversationError::NoRepeatedMistakes);
            }
            state.mistake_practice_preparing = true;
            candidates
        };
        let _preparation_guard = MistakePracticePreparationGuard {
            state: self.state.clone(),
        };
        let generated = questions.generate(&candidates);
        let mut state = self.lock();
        let result = (|| {
            let generated = match generated {
                Ok(questions) if questions.len() == 5 => questions,
                Ok(_) => return Err(ConversationError::MistakePlanInvalid),
                Err(error) => return Err(ConversationError::from(error)),
            };
            let mut snapshots = Vec::with_capacity(5);
            for item in generated {
                let Some(target) = candidates
                    .iter()
                    .find(|candidate| candidate.id == item.mistake_id)
                else {
                    return Err(ConversationError::MistakeTargetUnknown);
                };
                snapshots.push(MistakePracticeQuestion {
                    mistake_id: target.id,
                    original: target.original.clone(),
                    corrected: target.corrected.clone(),
                    question: item.question,
                });
            }
            let opening_question = snapshots[0].question.clone();
            let session_id = state
                .database
                .create_mistake_practice_session(
                    NewSession {
                        mode: SESSION_MODE,
                        opening_question: &opening_question,
                        topic_id: "free_conversation",
                        topic_label: "Usual mistakes",
                        topic_custom: None,
                        duration_goal_seconds: 300,
                        practice_mode: "voice",
                        practice_phase: "speaking",
                        written_turn_count: 0,
                        is_mistake_practice: true,
                    },
                    &snapshots,
                    &candidates,
                )?
                .ok_or(ConversationError::MistakeChanged)?;
            let metadata = state
                .database
                .session_metadata(session_id)?
                .ok_or(rusqlite::Error::QueryReturnedNoRows)?;
            let active = ActiveSession {
                id: session_id,
                opening_question,
                turns: Vec::new(),
                in_flight: false,
                reply_cancelled: Arc::new(AtomicBool::new(false)),
                topic_id: metadata.topic_id,
                topic_label: metadata.topic_label,
                topic_custom: metadata.topic_custom,
                duration_goal_seconds: metadata.duration_goal_seconds,
                active_duration_ms: 0,
                started_at: metadata.started_at,
                clock_anchor: None,
                practice_mode: PracticeMode::Voice,
                practice_phase: PracticePhase::Speaking,
                written_turn_count: 0,
                is_mistake_practice: true,
                mistake_questions: snapshots,
            };
            state.active = Some(active);
            let active = state
                .active
                .as_ref()
                .ok_or(ConversationError::InvalidSession)?;
            self.build_practice_session(&state, active)
        })();
        state.mistake_practice_preparing = false;
        result
    }

    #[cfg(test)]
    pub(crate) fn start_mistake_practice<F>(
        &self,
        generate: F,
    ) -> Result<PracticeSession, ConversationError>
    where
        F: FnOnce(
            &[MistakePracticeCandidate],
        )
            -> Result<Vec<GeneratedMistakeQuestion>, crate::providers::ProviderError>,
    {
        self.start_mistake_practice_with_source(&mut OnceQuestions(Some(generate)))
    }

    pub fn get_active(&self) -> Result<Option<PracticeSession>, ConversationError> {
        let mut state = self.lock();
        if let Some(id) = state.active.as_ref().map(|session| session.id) {
            checkpoint_clock(&mut state, id)?;
        }
        state
            .active
            .as_ref()
            .map(|active| self.build_practice_session(&state, active))
            .transpose()
    }

    pub fn set_practice_clock(
        &self,
        session_id: u64,
        running: bool,
    ) -> Result<PracticeSession, ConversationError> {
        let mut state = self.lock();
        checkpoint_clock(&mut state, session_id)?;
        let active = active_session_mut(&mut state, session_id)?;
        if running && active.practice_phase.is_review() {
            return Err(ConversationError::InvalidPhaseTransition);
        }
        if running && active.clock_anchor.is_none() {
            active.clock_anchor = Some(Instant::now());
        } else if !running {
            active.clock_anchor = None;
        }
        self.build_practice_session(
            &state,
            state
                .active
                .as_ref()
                .ok_or(ConversationError::InvalidSession)?,
        )
    }

    pub fn transition_practice_phase(
        &self,
        session_id: u64,
        phase: PracticePhase,
    ) -> Result<PracticeSession, ConversationError> {
        let mut state = self.lock();
        let active = state
            .active
            .as_ref()
            .filter(|active| active.id == session_id)
            .ok_or(ConversationError::InvalidSession)?;
        if active.in_flight {
            return Err(ConversationError::Busy);
        }
        let turn_count = active.turns.len();
        let mode = active.practice_mode;
        let current = active.practice_phase;
        let frozen_count = active.written_turn_count;
        let spoken_count = turn_count.saturating_sub(frozen_count);
        let (next_written_count, expose_session_cues) = match (mode, current, phase) {
            (
                PracticeMode::WriteThenSpeak,
                PracticePhase::Writing,
                PracticePhase::WritingReview,
            )
            | (PracticeMode::TextChat, PracticePhase::Writing, PracticePhase::WritingReview)
                if turn_count > 0 =>
            {
                (turn_count, false)
            }
            (
                PracticeMode::WriteThenSpeak,
                PracticePhase::WritingReview,
                PracticePhase::Speaking,
            ) => (frozen_count, true),
            (
                PracticeMode::WriteThenSpeak,
                PracticePhase::Speaking,
                PracticePhase::SpeakingReview,
            ) if spoken_count == frozen_count => (frozen_count, false),
            _ => return Err(ConversationError::InvalidPhaseTransition),
        };
        let now = Instant::now();
        let target_is_review = phase.is_review();
        let elapsed = if target_is_review && active.clock_anchor.is_some() {
            Some(elapsed_snapshot_at(active, now))
        } else {
            None
        };
        state
            .database
            .transition_practice_phase(PracticePhaseTransition {
                session_id,
                phase: phase.as_str(),
                written_turn_count: next_written_count,
                expose_session_cues,
                active_duration_ms: elapsed,
            })?
            .then_some(())
            .ok_or(ConversationError::InvalidSession)?;
        let active = active_session_mut(&mut state, session_id)?;
        active.practice_phase = phase;
        active.written_turn_count = next_written_count;
        if let Some(elapsed) = elapsed {
            active.active_duration_ms = elapsed;
        }
        if target_is_review {
            active.clock_anchor = None;
        }
        self.build_practice_session(
            &state,
            state
                .active
                .as_ref()
                .ok_or(ConversationError::InvalidSession)?,
        )
    }

    pub fn checkpoint_on_exit(&self) -> Result<(), ConversationError> {
        let mut state = self.lock();
        if let Some(id) = state.active.as_ref().map(|session| session.id) {
            checkpoint_clock(&mut state, id)?;
            if let Some(active) = state.active.as_mut() {
                active.clock_anchor = None;
            }
        }
        Ok(())
    }

    pub fn effective_glossary_terms(&self) -> Result<Vec<String>, ConversationError> {
        let state = self.lock();
        let mut terms = state.database.glossary_terms()?;
        for term in state
            .database
            .get_personal_profile()?
            .extract_glossary_terms()
        {
            if !terms
                .iter()
                .any(|existing| existing.eq_ignore_ascii_case(&term))
            {
                terms.push(term);
            }
        }
        Ok(terms)
    }
}

#[cfg(test)]
struct OnceQuestions<F>(Option<F>);

#[cfg(test)]
impl<F> MistakeQuestionSource for OnceQuestions<F>
where
    F: FnOnce(
        &[MistakePracticeCandidate],
    ) -> Result<Vec<GeneratedMistakeQuestion>, crate::providers::ProviderError>,
{
    fn generate(
        &mut self,
        candidates: &[MistakePracticeCandidate],
    ) -> Result<Vec<GeneratedMistakeQuestion>, crate::providers::ProviderError> {
        match self.0.take() {
            Some(generate) => generate(candidates),
            None => Err(crate::providers::ProviderError::new(
                crate::providers::ProviderErrorCode::Unavailable,
                "The question source was already used.",
            )),
        }
    }
}

fn discard_unusable_session(state: &mut State, session_id: u64) {
    drop(state.database.finish_session(session_id));
}

pub(super) fn elapsed_snapshot_at(session: &ActiveSession, now: Instant) -> u64 {
    session
        .active_duration_ms
        .saturating_add(session.clock_anchor.map_or(0, |anchor| {
            u64::try_from(now.saturating_duration_since(anchor).as_millis()).unwrap_or(u64::MAX)
        }))
}

pub(super) fn checkpoint_clock(
    state: &mut State,
    session_id: u64,
) -> Result<(), ConversationError> {
    checkpoint_clock_at(state, session_id, Instant::now())
}

pub(super) fn checkpoint_clock_at(
    state: &mut State,
    session_id: u64,
    now: Instant,
) -> Result<(), ConversationError> {
    let active = state
        .active
        .as_ref()
        .filter(|session| session.id == session_id)
        .ok_or(ConversationError::InvalidSession)?;
    let was_running = active.clock_anchor.is_some();
    let accumulated = elapsed_snapshot_at(active, now);
    if was_running {
        state
            .database
            .update_session_active_duration(session_id, accumulated)?;
        let active = active_session_mut(state, session_id)?;
        active.active_duration_ms = accumulated;
        active.clock_anchor = Some(now);
    }
    Ok(())
}
