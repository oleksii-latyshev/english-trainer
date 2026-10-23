use super::{active_session_mut, lifecycle, wrapup, SessionStore, State};
use crate::conversation::domain::rehearsal::{
    parse_practice_mode, parse_practice_phase, spoken_turn_count,
};
use crate::conversation::domain::rules::DAILY_TARGET_TURNS;
use crate::conversation::domain::{
    ActiveSession, FinishedPracticeSession, PracticeDialogue, PracticePhase, PracticeSession,
    WrapupPreparation,
};
use crate::conversation::error::ConversationError;
use crate::persistence::wrapup_generation::PreparedWrapup;
use std::time::Instant;

impl SessionStore {
    pub fn dialogue(&self, session_id: u64) -> Result<PracticeDialogue, ConversationError> {
        let state = self.lock();
        let session = state
            .active
            .as_ref()
            .filter(|session| session.id == session_id)
            .ok_or(ConversationError::InvalidSession)?;
        let details = state.database.turn_details(session_id)?;
        Ok(PracticeDialogue {
            session_id,
            opening_question: session.opening_question.clone(),
            turns: session.turns.clone(),
            input_sources: state.database.turn_input_sources(session_id)?,
            reply_times_ms: details.iter().map(|turn| turn.reply_ms).collect(),
            answer_durations_ms: details.iter().map(|turn| turn.answer_duration_ms).collect(),
            help_used: details.iter().map(|turn| turn.help_used).collect(),
            coaching: self.turn_coaching(&state, session_id, session.turns.len())?,
        })
    }

    pub fn finish(&self, session_id: u64) -> Result<FinishedPracticeSession, ConversationError> {
        let mut state = self.lock();
        lifecycle::checkpoint_clock(&mut state, session_id)?;
        let session = active_session_mut(&mut state, session_id)?;
        if session.in_flight {
            return Err(ConversationError::Busy);
        }
        let turn_count = session.turns.len();
        let active_duration_ms = session.active_duration_ms;
        let mut summary = self.finished_summary(&state, session_id, turn_count)?;
        if !state
            .database
            .finish_session_with_duration(session_id, active_duration_ms)?
        {
            return Err(ConversationError::InvalidSession);
        }
        state.active = None;
        summary.phrases.clear();
        summary.wrapup_preparation = if turn_count == 0 {
            WrapupPreparation::Ready
        } else {
            WrapupPreparation::Pending
        };
        Ok(summary)
    }

    pub fn session_wrapup(
        &self,
        session_id: u64,
    ) -> Result<FinishedPracticeSession, ConversationError> {
        let state = self.lock();
        if state
            .active
            .as_ref()
            .is_some_and(|active| active.id == session_id)
        {
            return Err(ConversationError::SessionStillOpen);
        }
        let turn_count = state.database.turns(session_id)?.len();
        self.finished_summary(&state, session_id, turn_count)
    }

    fn finished_summary(
        &self,
        state: &State,
        session_id: u64,
        turn_count: usize,
    ) -> Result<FinishedPracticeSession, ConversationError> {
        let wrapup = wrapup::build(&state.database, session_id)?;
        let waiting = self.waiting_coaching(state, session_id, turn_count)?;
        let is_paused = self.coaching.is_paused() && waiting > 0;
        let metadata = state
            .database
            .session_metadata(session_id)?
            .ok_or(ConversationError::InvalidSession)?;
        let practice_mode = parse_practice_mode(&metadata.practice_mode);
        let practice_phase = parse_practice_phase(&metadata.practice_phase);
        let written_turn_count = if practice_phase == PracticePhase::Writing {
            turn_count
        } else {
            metadata.written_turn_count
        };
        Ok(FinishedPracticeSession {
            session_id,
            finished: true,
            turn_count,
            target_turns: if metadata.is_mistake_practice {
                5
            } else {
                DAILY_TARGET_TURNS
            },
            duration_ms: state.database.session_elapsed_ms(session_id)?,
            topic_label: metadata.topic_label,
            duration_goal_seconds: metadata.duration_goal_seconds,
            numbers: wrapup.numbers,
            phrases: wrapup.phrases,
            recurring_mistakes: wrapup.recurring_mistakes,
            pending_coaching: if is_paused { 0 } else { waiting },
            is_coaching_paused: is_paused,
            wrapup_preparation: match state.database.wrapup_record(session_id)? {
                None => WrapupPreparation::Legacy,
                Some(PreparedWrapup::Pending) => WrapupPreparation::Pending,
                Some(PreparedWrapup::Ready(_)) => WrapupPreparation::Ready,
                Some(PreparedWrapup::Failed(error)) => WrapupPreparation::Failed { error },
            },
            practice_mode,
            practice_phase,
            written_turn_count,
            spoken_turn_count: spoken_turn_count(
                practice_mode,
                practice_phase,
                turn_count,
                written_turn_count,
            ),
            is_mistake_practice: metadata.is_mistake_practice,
        })
    }

    pub(super) fn build_practice_session(
        &self,
        state: &State,
        active: &ActiveSession,
    ) -> Result<PracticeSession, ConversationError> {
        Ok(PracticeSession {
            session_id: active.id,
            opening_question: active.current_question(),
            turn_count: active.turns.len(),
            target_turns: if active.is_mistake_practice {
                5
            } else {
                DAILY_TARGET_TURNS
            },
            retry_evidence: state.database.comparisons(active.id)?,
            topic_id: active.topic_id.clone(),
            topic_label: active.topic_label.clone(),
            topic_custom: active.topic_custom.clone(),
            duration_goal_seconds: active.duration_goal_seconds,
            active_duration_ms: lifecycle::elapsed_snapshot_at(active, Instant::now()),
            started_at: active.started_at,
            is_clock_running: active.clock_anchor.is_some(),
            practice_mode: active.practice_mode,
            practice_phase: active.practice_phase,
            written_turn_count: active.written_turn_count,
            spoken_turn_count: spoken_turn_count(
                active.practice_mode,
                active.practice_phase,
                active.turns.len(),
                active.written_turn_count,
            ),
            is_mistake_practice: active.is_mistake_practice,
        })
    }
}
