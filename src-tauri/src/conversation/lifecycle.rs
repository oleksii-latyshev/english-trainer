use super::topics;
use super::{
    active_session_mut, database_error, database_error_message, invalid_session_error,
    ActiveSession, PersonalProfile, PracticeSession, ProviderError, SessionStore,
    StartPracticeOptions, State, MAX_SAFE_SESSION_ID, SESSION_MODE,
};
use crate::persistence::session_metadata::NewSession;
use std::time::Instant;

impl SessionStore {
    #[cfg(test)]
    pub fn start_session(&self) -> Result<PracticeSession, ProviderError> {
        self.start_practice_session(None)
    }

    pub fn start_practice_session(
        &self,
        options: Option<StartPracticeOptions>,
    ) -> Result<PracticeSession, ProviderError> {
        let mut state = self.lock();
        if let Some(active) = &state.active {
            return self.build_practice_session(&state, active);
        }
        let session_count = state.database.session_count().map_err(database_error)?;
        let (topic, duration_goal_seconds, opening_question) =
            topics::resolve_start_options(options, session_count)?;
        let session_id = state
            .database
            .create_session_with_options(NewSession {
                mode: SESSION_MODE,
                opening_question: &opening_question,
                topic_id: &topic.topic_id,
                topic_label: &topic.topic_label,
                topic_custom: topic.topic_custom.as_deref(),
                duration_goal_seconds,
            })
            .map_err(database_error)?;
        if session_id > MAX_SAFE_SESSION_ID {
            let _ = state.database.finish_session(session_id);
            return Err(database_error_message());
        }
        let active = ActiveSession {
            id: session_id,
            opening_question: opening_question.clone(),
            turns: Vec::new(),
            in_flight: false,
            topic_id: topic.topic_id,
            topic_label: topic.topic_label,
            topic_custom: topic.topic_custom,
            duration_goal_seconds,
            active_duration_ms: 0,
            started_at: state
                .database
                .session_metadata(session_id)
                .map_err(database_error)?
                .ok_or_else(database_error_message)?
                .started_at,
            clock_anchor: None,
        };
        let practice_session = self.build_practice_session(&state, &active)?;
        state.active = Some(active);
        Ok(practice_session)
    }

    pub fn get_active(&self) -> Result<Option<PracticeSession>, ProviderError> {
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
    ) -> Result<PracticeSession, ProviderError> {
        let mut state = self.lock();
        checkpoint_clock(&mut state, session_id)?;
        let active = active_session_mut(&mut state, session_id)?;
        if running && active.clock_anchor.is_none() {
            active.clock_anchor = Some(Instant::now());
        } else if !running {
            active.clock_anchor = None;
        }
        self.build_practice_session(
            &state,
            state.active.as_ref().ok_or_else(invalid_session_error)?,
        )
    }

    pub fn checkpoint_on_exit(&self) -> Result<(), ProviderError> {
        let mut state = self.lock();
        if let Some(id) = state.active.as_ref().map(|session| session.id) {
            checkpoint_clock(&mut state, id)?;
            if let Some(active) = state.active.as_mut() {
                active.clock_anchor = None;
            }
        }
        Ok(())
    }

    pub fn personal_profile(&self) -> Result<PersonalProfile, ProviderError> {
        self.lock()
            .database
            .get_personal_profile()
            .map_err(database_error)
    }

    pub fn save_personal_profile(
        &self,
        mut profile: PersonalProfile,
    ) -> Result<PersonalProfile, ProviderError> {
        profile.role = profile.role.trim().to_string();
        profile.stack = profile.stack.trim().to_string();
        profile.interests = profile.interests.trim().to_string();
        profile.goals = profile.goals.trim().to_string();
        profile.validate()?;
        let mut state = self.lock();
        state
            .database
            .save_personal_profile(&profile)
            .map_err(database_error)?;
        Ok(profile)
    }

    pub fn effective_glossary_terms(&self) -> Result<Vec<String>, ProviderError> {
        let state = self.lock();
        let mut terms = state.database.glossary_terms().map_err(database_error)?;
        for term in state
            .database
            .get_personal_profile()
            .map_err(database_error)?
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

pub(super) fn elapsed_snapshot_at(session: &ActiveSession, now: Instant) -> u64 {
    session
        .active_duration_ms
        .saturating_add(session.clock_anchor.map_or(0, |anchor| {
            u64::try_from(now.saturating_duration_since(anchor).as_millis()).unwrap_or(u64::MAX)
        }))
}

pub(super) fn checkpoint_clock(state: &mut State, session_id: u64) -> Result<(), ProviderError> {
    checkpoint_clock_at(state, session_id, Instant::now())
}

pub(super) fn checkpoint_clock_at(
    state: &mut State,
    session_id: u64,
    now: Instant,
) -> Result<(), ProviderError> {
    let active = state
        .active
        .as_ref()
        .filter(|session| session.id == session_id)
        .ok_or_else(invalid_session_error)?;
    let was_running = active.clock_anchor.is_some();
    let accumulated = elapsed_snapshot_at(active, now);
    if was_running {
        state
            .database
            .update_session_active_duration(session_id, accumulated)
            .map_err(database_error)?;
        let active = state
            .active
            .as_mut()
            .filter(|session| session.id == session_id)
            .ok_or_else(invalid_session_error)?;
        active.active_duration_ms = accumulated;
        active.clock_anchor = Some(now);
    }
    Ok(())
}
