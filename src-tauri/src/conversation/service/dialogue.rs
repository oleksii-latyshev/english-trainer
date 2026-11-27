use super::{active_session_mut, lifecycle, wrapup, SessionStore, State};
use crate::conversation::domain::rehearsal::{
    parse_practice_mode, parse_practice_phase, spoken_turn_count,
};
use crate::conversation::domain::rules::DAILY_TARGET_TURNS;
use crate::conversation::domain::{
    pick_debrief_words, ActiveSession, FinishedPracticeSession, PracticeDialogue, PracticePhase,
    PracticeSession,
};
use crate::conversation::error::ConversationError;
use crate::learning::focus_rule::{pick_focus_rule, FocusRule};
use crate::learning::habits::{top_habits, Habit};
use std::time::Instant;

impl SessionStore {
    /// Habits from the finished sessions up to this one. A failed read only hides them.
    pub(crate) fn habits(&self, state: &State, session_id: u64) -> Vec<Habit> {
        state
            .database
            .finished_session_texts(session_id)
            .map(|texts| top_habits(&texts))
            .unwrap_or_default()
    }

    /// The rule to practise after this session. A failed read only hides it.
    fn focus_rule(&self, state: &State, session_id: u64) -> Option<FocusRule> {
        state
            .database
            .session_rule_counts(session_id)
            .ok()
            .and_then(|counts| pick_focus_rule(&counts))
    }

    /// The top habit words as the coaching prompt gets them.
    pub(crate) fn habit_words(&self, session_id: u64) -> Vec<String> {
        let state = self.lock();
        self.habits(&state, session_id)
            .into_iter()
            .map(|habit| habit.word)
            .collect()
    }

    pub fn dialogue(&self, session_id: u64) -> Result<PracticeDialogue, ConversationError> {
        let state = self.lock();
        let (opening_question, turns) = match state
            .active
            .as_ref()
            .filter(|session| session.id == session_id)
        {
            Some(active) => (active.opening_question.clone(), active.turns.clone()),
            None => (
                state
                    .database
                    .session_metadata(session_id)?
                    .ok_or(ConversationError::InvalidSession)?
                    .opening_question,
                state.database.turns(session_id)?,
            ),
        };
        let details = state.database.turn_details(session_id)?;
        let coaching = self.turn_coaching(&state, session_id, turns.len())?;
        let habits = self.habits(&state, session_id);
        let debrief_words = pick_debrief_words(&coaching, &habits);
        Ok(PracticeDialogue {
            session_id,
            opening_question,
            input_sources: state.database.turn_input_sources(session_id)?,
            reply_times_ms: details.iter().map(|turn| turn.reply_ms).collect(),
            answer_durations_ms: details.iter().map(|turn| turn.answer_duration_ms).collect(),
            help_used: details.iter().map(|turn| turn.help_used).collect(),
            coaching,
            debrief_words,
            debrief_wins: state.database.session_wins(session_id)?,
            habits,
            focus_rule: self.focus_rule(&state, session_id),
            turns,
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
        let summary = self.finished_summary(&state, session_id, turn_count)?;
        if !state
            .database
            .finish_session_with_duration(session_id, active_duration_ms)?
        {
            return Err(ConversationError::InvalidSession);
        }
        state.active = None;
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
            recurring_mistakes: wrapup.recurring_mistakes,
            pending_coaching: if is_paused { 0 } else { waiting },
            is_coaching_paused: is_paused,
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
