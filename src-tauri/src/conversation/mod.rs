use crate::persistence::SessionDatabase;
use crate::providers::{
    compare_attempts, AttemptComparison, ConversationContext, ConversationTurn, ProviderError,
    ProviderErrorCode, TurnFeedback,
};
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::sync::{Arc, Mutex};
use std::time::Instant;
mod ai_settings;
mod api_usage;
mod coaching;
pub(crate) mod coaching_queue;
mod context_builder;
mod guided;
mod lifecycle;
pub(crate) mod memory_recall;
mod profile;
pub(crate) mod recall;
mod rehearsal;
mod rules;
mod scaffold;
mod speech_settings;
mod topics;
pub(crate) mod usage;
mod usage_support;
mod wrapup;
pub use coaching::TurnCoaching;
pub use coaching_queue::{CoachingQueue, IDLE_FLUSH, QUOTA_PAUSE};
pub use profile::PersonalProfile;
pub use recall::{DailyRecallItem, DailyRecallPlan, SpokenRecallResult};
use rehearsal::{
    invalid_phase_transition_error, parse_practice_mode, parse_practice_phase, replay_questions,
    spoken_turn_count, validate_answer_source,
};
use rules::{validate_transcript, DAILY_TARGET_TURNS, MAX_SAFE_SESSION_ID, MAX_TRANSCRIPT_CHARS};
pub use scaffold::{question_scaffold, QuestionScaffold};
pub use topics::{PracticeMode, PracticePhase, StartPracticeOptions};
pub use wrapup::{RecurringMistake, WrapupPhrase};

/// The mode column of every new session. Conversation and Coach are one mode now; sessions saved
/// as "coach" by older versions are read the same way.
const SESSION_MODE: &str = "conversation";

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct PracticeSession {
    pub session_id: u64,
    pub opening_question: String,
    pub turn_count: usize,
    pub target_turns: usize,
    pub retry_evidence: Vec<AttemptComparison>,
    pub topic_id: String,
    pub topic_label: String,
    pub topic_custom: Option<String>,
    pub duration_goal_seconds: u32,
    pub active_duration_ms: u64,
    pub started_at: i64,
    pub is_clock_running: bool,
    pub practice_mode: PracticeMode,
    pub practice_phase: PracticePhase,
    pub written_turn_count: usize,
    pub spoken_turn_count: usize,
    pub is_mistake_practice: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "snake_case")]
pub enum InputSource {
    Voice,
    Edited,
    #[default]
    Text,
}

impl InputSource {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Voice => "voice",
            Self::Edited => "edited",
            Self::Text => "text",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct PracticeDialogue {
    pub session_id: u64,
    pub opening_question: String,
    pub turns: Vec<StoredTurn>,
    pub input_sources: Vec<String>,
    /// Per turn: time to Eva's first words in ms; absent for turns stored before it was kept.
    pub reply_times_ms: Vec<Option<u64>>,
    /// Per turn: how long a spoken answer lasted in ms; absent for typed or older answers.
    pub answer_durations_ms: Vec<Option<u64>>,
    /// Per turn: the learner opened a help level for the answer before sending it.
    pub help_used: Vec<bool>,
    /// Per turn: where the background coaching of the learner's answer stands.
    pub coaching: Vec<TurnCoaching>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct FinishedPracticeSession {
    pub session_id: u64,
    pub finished: bool,
    pub turn_count: usize,
    pub target_turns: usize,
    /// Session length, from start to finish, in ms.
    pub duration_ms: u64,
    pub topic_label: String,
    pub duration_goal_seconds: u32,
    pub numbers: crate::learning::session_stats::SessionNumbers,
    /// Up to three phrases from the session's coaching that are not saved yet.
    pub phrases: Vec<WrapupPhrase>,
    /// Up to two mistakes observed more than once in the session.
    pub recurring_mistakes: Vec<RecurringMistake>,
    /// Answers whose coaching has not landed yet; the lists above grow when it does.
    pub pending_coaching: usize,
    /// Coaching is paused because the Antigravity quota ran out, so nothing more will land.
    pub is_coaching_paused: bool,
    pub practice_mode: PracticeMode,
    pub practice_phase: PracticePhase,
    pub written_turn_count: usize,
    pub spoken_turn_count: usize,
    pub is_mistake_practice: bool,
}

#[derive(Clone)]
pub struct SessionStore {
    state: Arc<Mutex<State>>,
    pub(crate) usage_in_flight: Arc<usage_support::UsageInFlightTracker>,
    pub(crate) coaching: Arc<coaching::CoachingStatus>,
}

struct State {
    database: SessionDatabase,
    active: Option<ActiveSession>,
    mistake_practice_preparing: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct StoredTurn {
    pub learner: String,
    pub assistant_reply: String,
    pub assistant_question: String,
    pub answered_by: Option<crate::providers::AnsweredBy>,
}

impl StoredTurn {
    /// What the learner answers next. Replies without a question are the prompt themselves.
    pub(crate) fn prompt(&self) -> &str {
        if self.assistant_question.is_empty() {
            &self.assistant_reply
        } else {
            &self.assistant_question
        }
    }
}

struct ActiveSession {
    id: u64,
    opening_question: String,
    turns: Vec<StoredTurn>,
    in_flight: bool,
    topic_id: String,
    topic_label: String,
    topic_custom: Option<String>,
    duration_goal_seconds: u32,
    active_duration_ms: u64,
    started_at: i64,
    clock_anchor: Option<Instant>,
    practice_mode: PracticeMode,
    practice_phase: PracticePhase,
    written_turn_count: usize,
    is_mistake_practice: bool,
    mistake_questions: Vec<crate::learning::mistake_practice::MistakePracticeQuestion>,
}

impl ActiveSession {
    /// What the learner answers next: the latest question asked. A turn without any (a Coach
    /// answer saved by an older version and never continued) leaves the one before it open.
    fn current_question(&self) -> String {
        if self.is_mistake_practice {
            return self
                .mistake_questions
                .get(self.turns.len())
                .map(|item| item.question.clone())
                .unwrap_or_else(|| {
                    "You have finished all five questions. You can finish this practice."
                        .to_string()
                });
        }
        if self.practice_mode == PracticeMode::WriteThenSpeak
            && matches!(
                self.practice_phase,
                PracticePhase::Speaking | PracticePhase::SpeakingReview
            )
        {
            return replay_questions(&self.opening_question, &self.turns, self.written_turn_count)
                .get(self.turns.len().saturating_sub(self.written_turn_count))
                .cloned()
                .unwrap_or_else(|| {
                    "The spoken replay is complete. Review your answers.".to_string()
                });
        }
        self.turns
            .iter()
            .rev()
            .map(StoredTurn::prompt)
            .find(|prompt| !prompt.is_empty())
            .unwrap_or(&self.opening_question)
            .to_string()
    }
}

impl SessionStore {
    pub fn open(path: impl AsRef<Path>) -> rusqlite::Result<Self> {
        let database = SessionDatabase::open(path)?;
        Self::from_database(database)
    }

    fn from_database(database: SessionDatabase) -> rusqlite::Result<Self> {
        let active = if let Some(stored) = database.active_session()? {
            let mistake_questions = if stored.is_mistake_practice {
                let questions = database.mistake_practice_questions(stored.id)?;
                if questions.len() != 5 {
                    return Err(rusqlite::Error::InvalidQuery);
                }
                questions
            } else {
                Vec::new()
            };
            // Sessions saved by older versions carry a mode; they continue as the one Talk mode.
            Some(ActiveSession {
                id: stored.id,
                opening_question: stored.opening_question,
                turns: database.turns(stored.id)?,
                in_flight: false,
                topic_id: stored.topic_id,
                topic_label: stored.topic_label,
                topic_custom: stored.topic_custom,
                duration_goal_seconds: stored.duration_goal_seconds,
                active_duration_ms: stored.active_duration_ms,
                started_at: stored.started_at,
                clock_anchor: None,
                practice_mode: parse_practice_mode(&stored.practice_mode),
                practice_phase: parse_practice_phase(&stored.practice_phase),
                written_turn_count: stored.written_turn_count,
                is_mistake_practice: stored.is_mistake_practice,
                mistake_questions,
            })
        } else {
            None
        };
        Ok(Self {
            state: Arc::new(Mutex::new(State {
                database,
                active,
                mistake_practice_preparing: false,
            })),
            usage_in_flight: Arc::new(usage_support::UsageInFlightTracker::new()),
            coaching: Arc::new(coaching::CoachingStatus::default()),
        })
    }

    #[cfg(test)]
    pub fn start(&self) -> Result<PracticeSession, ProviderError> {
        self.start_session()
    }

    pub fn dialogue(&self, session_id: u64) -> Result<PracticeDialogue, ProviderError> {
        let state = self.lock();
        let session = state
            .active
            .as_ref()
            .filter(|session| session.id == session_id)
            .ok_or_else(invalid_session_error)?;
        let details = state
            .database
            .turn_details(session_id)
            .map_err(database_error)?;
        Ok(PracticeDialogue {
            session_id,
            opening_question: session.opening_question.clone(),
            turns: session.turns.clone(),
            input_sources: state
                .database
                .turn_input_sources(session_id)
                .map_err(database_error)?,
            reply_times_ms: details.iter().map(|turn| turn.reply_ms).collect(),
            answer_durations_ms: details.iter().map(|turn| turn.answer_duration_ms).collect(),
            help_used: details.iter().map(|turn| turn.help_used).collect(),
            coaching: self.turn_coaching(&state, session_id, session.turns.len())?,
        })
    }

    #[cfg(test)]
    pub fn send_turn<F>(
        &self,
        session_id: u64,
        transcript: String,
        generate: F,
    ) -> Result<ConversationTurn, ProviderError>
    where
        F: FnOnce(&ConversationContext) -> Result<ConversationTurn, ProviderError>,
    {
        self.send_turn_with_source(session_id, transcript, InputSource::Voice, None, generate)
    }

    pub fn send_turn_with_source<F>(
        &self,
        session_id: u64,
        transcript: String,
        input_source: InputSource,
        answer_duration_ms: Option<u64>,
        generate: F,
    ) -> Result<ConversationTurn, ProviderError>
    where
        F: FnOnce(&ConversationContext) -> Result<ConversationTurn, ProviderError>,
    {
        validate_transcript(&transcript)?;
        let (
            context,
            replay_question,
            replay_next_question,
            replay_is_final,
            is_mistake_practice,
            mistake_next_question,
            mistake_is_final,
        ) = {
            let mut state = self.lock();
            let session = state
                .active
                .as_ref()
                .filter(|session| session.id == session_id)
                .ok_or_else(invalid_session_error)?;
            if session.in_flight {
                return Err(busy_error());
            }
            validate_answer_source(session, input_source)?;
            let is_replay = session.practice_mode == PracticeMode::WriteThenSpeak
                && session.practice_phase == PracticePhase::Speaking;
            let is_mistake_practice = session.is_mistake_practice;
            if is_mistake_practice && session.turns.len() >= 5 {
                return Err(invalid_phase_transition_error());
            }
            let questions = if is_replay {
                replay_questions(
                    &session.opening_question,
                    &session.turns,
                    session.written_turn_count,
                )
            } else {
                Vec::new()
            };
            let spoken_count = session
                .turns
                .len()
                .saturating_sub(session.written_turn_count);
            let replay_question =
                is_replay.then(|| questions.get(spoken_count).cloned().unwrap_or_default());
            let replay_is_final = replay_question.is_some() && spoken_count + 1 == questions.len();
            let replay_next_question = replay_question
                .as_ref()
                .and_then(|_| questions.get(spoken_count + 1).cloned());
            let mistake_next_question = if is_mistake_practice {
                session
                    .mistake_questions
                    .get(session.turns.len() + 1)
                    .map(|item| item.question.clone())
            } else {
                None
            };
            let mistake_is_final = is_mistake_practice && session.turns.len() + 1 == 5;
            if session.practice_phase.is_review()
                || (is_replay
                    && (spoken_count >= session.written_turn_count
                        || replay_question.as_deref().unwrap_or_default().is_empty()))
            {
                return Err(invalid_phase_transition_error());
            }
            let learning_targets =
                if !is_mistake_practice && (session.turns.len() == 1 || session.turns.len() == 5) {
                    state
                        .database
                        .due_learning_targets(session_id)
                        .map_err(database_error)?
                } else {
                    Vec::new()
                };
            let profile = state
                .database
                .get_personal_profile()
                .map_err(database_error)?;
            let session = active_session_mut(&mut state, session_id)?;
            session.in_flight = true;
            let context = context_builder::build_context(context_builder::ContextInput {
                opening_question: &session.opening_question,
                prior_turns: &session.turns,
                latest_transcript: &transcript,
                learning_targets,
                profile: Some(profile),
                topic: Some(session.topic_label.clone()),
            });
            (
                context,
                replay_question,
                replay_next_question,
                replay_is_final,
                is_mistake_practice,
                mistake_next_question,
                mistake_is_final,
            )
        };

        let result = if replay_question.is_some() || is_mistake_practice {
            Ok(ConversationTurn {
                spoken_reply: if replay_is_final || mistake_is_final {
                    "Thanks for practicing those answers.".to_string()
                } else {
                    "Thanks for sharing that.".to_string()
                },
                question: if replay_question.is_some() {
                    replay_next_question
                } else {
                    mistake_next_question
                },
                session_phase: if mistake_is_final {
                    "mistake_practice"
                } else {
                    "rehearsal"
                }
                .to_string(),
                is_complete: replay_is_final || mistake_is_final,
                provider_latency_ms: None,
                first_token_ms: None,
                answered_by: None,
            })
        } else {
            generate(&context)
        };
        let mut state = self.lock();
        let turn = match result {
            Ok(turn) => turn,
            Err(error) => {
                if let Some(session) = state
                    .active
                    .as_mut()
                    .filter(|session| session.id == session_id)
                {
                    session.in_flight = false;
                }
                return Err(error);
            }
        };
        let sequence = {
            let Some(session) = state
                .active
                .as_mut()
                .filter(|session| session.id == session_id)
            else {
                return Err(invalid_session_error());
            };
            session.in_flight = false;
            session.turns.len() + 1
        };
        let assistant_question = turn.question.clone().unwrap_or_default();
        let stored = StoredTurn {
            learner: context.latest_transcript,
            assistant_reply: turn.spoken_reply.clone(),
            assistant_question,
            answered_by: turn.answered_by.clone(),
        };
        state
            .database
            .save_turn_with_details(
                session_id,
                sequence,
                &stored,
                input_source.as_str(),
                turn.reply_time_ms(),
                answer_duration_ms.filter(|_| input_source != InputSource::Text),
            )
            .map_err(database_error)?;
        state
            .active
            .as_mut()
            .expect("session remains active while locked")
            .turns
            .push(stored);
        Ok(turn)
    }

    pub fn finish(&self, session_id: u64) -> Result<FinishedPracticeSession, ProviderError> {
        let mut state = self.lock();
        lifecycle::checkpoint_clock(&mut state, session_id)?;
        let session = active_session_mut(&mut state, session_id)?;
        if session.in_flight {
            return Err(busy_error());
        }
        let turn_count = session.turns.len();
        let active_duration_ms = session.active_duration_ms;
        // Read first: a failure here leaves the session open.
        let summary = self.finished_summary(&state, session_id, turn_count)?;
        if !state
            .database
            .finish_session_with_duration(session_id, active_duration_ms)
            .map_err(database_error)?
        {
            return Err(invalid_session_error());
        }
        state.active = None;
        Ok(summary)
    }

    /// The wrap-up of a finished session as it stands now; asked again when coaching lands.
    pub fn session_wrapup(
        &self,
        session_id: u64,
    ) -> Result<FinishedPracticeSession, ProviderError> {
        let state = self.lock();
        if state
            .active
            .as_ref()
            .is_some_and(|active| active.id == session_id)
        {
            return Err(ProviderError::new(
                ProviderErrorCode::InvalidRequest,
                "This practice session is still open. Finish it to see its wrap-up.",
            ));
        }
        let turn_count = state
            .database
            .turns(session_id)
            .map_err(database_error)?
            .len();
        self.finished_summary(&state, session_id, turn_count)
    }

    fn finished_summary(
        &self,
        state: &State,
        session_id: u64,
        turn_count: usize,
    ) -> Result<FinishedPracticeSession, ProviderError> {
        let wrapup = wrapup::build(&state.database, session_id).map_err(database_error)?;
        let waiting = self.waiting_coaching(state, session_id, turn_count)?;
        let is_paused = self.coaching.is_paused() && waiting > 0;
        let metadata = state
            .database
            .session_metadata(session_id)
            .map_err(database_error)?
            .ok_or_else(invalid_session_error)?;
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
            duration_ms: state
                .database
                .session_elapsed_ms(session_id)
                .map_err(database_error)?,
            topic_label: metadata.topic_label,
            duration_goal_seconds: metadata.duration_goal_seconds,
            numbers: wrapup.numbers,
            phrases: wrapup.phrases,
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

    pub fn daily_recall_plan(&self, session_id: u64) -> Result<DailyRecallPlan, ProviderError> {
        let state = self.lock();
        let session = state
            .active
            .as_ref()
            .filter(|item| item.id == session_id)
            .ok_or_else(invalid_session_error)?;
        if session.turns.len() < DAILY_TARGET_TURNS {
            return Err(ProviderError::new(
                ProviderErrorCode::InvalidRequest,
                "Finish the suggested speaking goal before phrase recall.",
            ));
        }
        state
            .database
            .daily_recall_plan(session_id)
            .map_err(database_error)
    }

    pub fn submit_daily_recall(
        &self,
        session_id: u64,
        phrase_id: u64,
        transcript: String,
    ) -> Result<SpokenRecallResult, ProviderError> {
        validate_transcript(&transcript)?;
        if phrase_id == 0 || phrase_id > MAX_SAFE_SESSION_ID {
            return Err(ProviderError::new(
                ProviderErrorCode::InvalidRequest,
                "Invalid phrase ID.",
            ));
        }
        let mut state = self.lock();
        let session = state
            .active
            .as_ref()
            .filter(|item| item.id == session_id)
            .ok_or_else(invalid_session_error)?;
        if session.in_flight {
            return Err(busy_error());
        }
        if session.turns.len() < DAILY_TARGET_TURNS {
            return Err(ProviderError::new(
                ProviderErrorCode::InvalidRequest,
                "Finish the suggested speaking goal before phrase recall.",
            ));
        }
        state
            .database
            .record_daily_recall(session_id, phrase_id, &transcript)
            .map_err(database_error)?
            .ok_or_else(|| {
                ProviderError::new(
                    ProviderErrorCode::InvalidRequest,
                    "This phrase is no longer due for this session. Refresh recall and try again.",
                )
            })
    }

    /// Stores the coaching for one answer and lets the learning engine observe its mistake.
    /// Works after the session finished too: the last batch can land after the wrap-up opened.
    pub fn save_feedback(
        &self,
        session_id: u64,
        sequence: usize,
        transcript: &str,
        feedback: &TurnFeedback,
    ) -> Result<(), ProviderError> {
        validate_transcript(transcript)?;
        if session_id > MAX_SAFE_SESSION_ID || sequence == 0 {
            return Err(invalid_retry_error());
        }
        if feedback.focus_feedback.len() > 1
            || !bounded_feedback_text(&feedback.b2_rewrite)
            || feedback.focus_feedback.iter().any(|focus| {
                !bounded_feedback_text(&focus.original)
                    || !bounded_feedback_text(&focus.improved)
                    || !bounded_feedback_text(&focus.explanation)
                    || crate::learning::normalize_phrase(&focus.improved).is_empty()
            })
        {
            return Err(invalid_retry_error());
        }
        let mut state = self.lock();
        let original = state
            .database
            .turn(session_id, sequence)
            .map_err(database_error)?
            .ok_or_else(invalid_retry_error)?;
        if original.learner.trim() != transcript.trim() {
            return Err(invalid_retry_error());
        }
        state
            .database
            .save_turn_feedback(session_id, sequence, feedback)
            .map_err(database_error)
    }

    pub fn retry_turn(
        &self,
        session_id: u64,
        sequence: usize,
        transcript: String,
    ) -> Result<AttemptComparison, ProviderError> {
        validate_transcript(&transcript)?;
        if session_id > MAX_SAFE_SESSION_ID || sequence == 0 {
            return Err(invalid_retry_error());
        }
        let mut state = self.lock();
        if active_session_mut(&mut state, session_id)?.in_flight {
            return Err(busy_error());
        }
        let original = state
            .database
            .turn(session_id, sequence)
            .map_err(database_error)?
            .ok_or_else(invalid_retry_error)?;
        let feedback = state
            .database
            .turn_feedback(session_id, sequence)
            .map_err(database_error)?
            .ok_or_else(invalid_retry_error)?;
        let target = feedback
            .focus_feedback
            .first()
            .map(|focus| focus.improved.as_str())
            .unwrap_or("");
        if target.len() > 300 || transcript.len() > MAX_TRANSCRIPT_CHARS {
            return Err(invalid_retry_error());
        }
        let comparison = compare_attempts(sequence, &original.learner, &transcript, target);
        state
            .database
            .save_comparison(session_id, &comparison)
            .map_err(database_error)?;
        Ok(comparison)
    }

    pub fn save_phrase(
        &self,
        phrase: String,
        meaning_or_note: String,
        session_id: Option<u64>,
        sequence: Option<usize>,
    ) -> Result<crate::learning::PhraseCardRecord, ProviderError> {
        let trimmed_phrase = phrase.trim();
        if trimmed_phrase.is_empty() || trimmed_phrase.chars().count() > 300 {
            return Err(ProviderError::new(
                ProviderErrorCode::InvalidRequest,
                "Phrase must be between 1 and 300 characters.",
            ));
        }
        if meaning_or_note.chars().count() > 500 {
            return Err(ProviderError::new(
                ProviderErrorCode::InvalidRequest,
                "Note must be 500 characters or fewer.",
            ));
        }
        if let Some(sid) = session_id {
            if sid > MAX_SAFE_SESSION_ID {
                return Err(ProviderError::new(
                    ProviderErrorCode::InvalidRequest,
                    "Invalid session ID.",
                ));
            }
        }
        if let Some(seq) = sequence {
            if seq == 0 || seq > 10_000 {
                return Err(ProviderError::new(
                    ProviderErrorCode::InvalidRequest,
                    "Invalid turn sequence.",
                ));
            }
        }
        if session_id.is_some() != sequence.is_some() {
            return Err(ProviderError::new(
                ProviderErrorCode::InvalidRequest,
                "Phrase provenance requires both a session ID and a turn sequence.",
            ));
        }

        let mut state = self.lock();
        if let (Some(sid), Some(seq)) = (session_id, sequence) {
            if state
                .database
                .turn(sid, seq)
                .map_err(database_error)?
                .is_none()
            {
                return Err(ProviderError::new(
                    ProviderErrorCode::InvalidRequest,
                    "The phrase source turn could not be found.",
                ));
            }
        }
        state
            .database
            .save_phrase_card(trimmed_phrase, &meaning_or_note, session_id, sequence)
            .map_err(database_error)
    }

    /// Removes a saved phrase card (for example to undo a save). False when no card has this id.
    pub fn delete_phrase(&self, phrase_id: u64) -> Result<bool, ProviderError> {
        if phrase_id == 0 || phrase_id > MAX_SAFE_SESSION_ID {
            return Err(ProviderError::new(
                ProviderErrorCode::InvalidRequest,
                "Invalid phrase card ID.",
            ));
        }
        let mut state = self.lock();
        state
            .database
            .delete_phrase_card(phrase_id)
            .map_err(database_error)
    }

    /// Removes a mistake from Memory (and the evidence about it). False when no mistake has this id.
    pub fn delete_mistake(&self, mistake_id: u64) -> Result<bool, ProviderError> {
        validate_learning_item_id(mistake_id)?;
        let mut state = self.lock();
        state
            .database
            .delete_mistake(mistake_id)
            .map_err(database_error)
    }

    /// Hides a phrase or mistake from Memory and review. False when nothing changed.
    pub fn archive_learning_item(
        &self,
        item_type: crate::learning::LearningItemType,
        item_id: u64,
    ) -> Result<bool, ProviderError> {
        validate_learning_item_id(item_id)?;
        let mut state = self.lock();
        state
            .database
            .archive_learning_item(item_type, item_id)
            .map_err(database_error)
    }

    pub fn get_learning_memory(
        &self,
    ) -> Result<crate::learning::LearningMemoryView, ProviderError> {
        let state = self.lock();
        state.database.get_learning_memory().map_err(database_error)
    }

    fn lock(&self) -> std::sync::MutexGuard<'_, State> {
        self.state
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
    }
}

impl SessionStore {
    fn build_practice_session(
        &self,
        state: &State,
        active: &ActiveSession,
    ) -> Result<PracticeSession, ProviderError> {
        Ok(PracticeSession {
            session_id: active.id,
            opening_question: active.current_question(),
            turn_count: active.turns.len(),
            target_turns: if active.is_mistake_practice {
                5
            } else {
                DAILY_TARGET_TURNS
            },
            retry_evidence: state
                .database
                .comparisons(active.id)
                .map_err(database_error)?,
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

impl Default for SessionStore {
    fn default() -> Self {
        Self::from_database(
            SessionDatabase::open_in_memory().expect("in-memory SQLite should open"),
        )
        .expect("new in-memory database should load")
    }
}

pub(crate) fn database_error(_: rusqlite::Error) -> ProviderError {
    database_error_message()
}

fn validate_learning_item_id(item_id: u64) -> Result<(), ProviderError> {
    if item_id == 0 || item_id > MAX_SAFE_SESSION_ID {
        return Err(ProviderError::new(
            ProviderErrorCode::InvalidRequest,
            "Invalid learning item ID.",
        ));
    }
    Ok(())
}

fn database_error_message() -> ProviderError {
    ProviderError::new(
        ProviderErrorCode::DatabaseError,
        "Could not save this practice session locally. Please retry.",
    )
}

fn active_session_mut(
    state: &mut State,
    session_id: u64,
) -> Result<&mut ActiveSession, ProviderError> {
    state
        .active
        .as_mut()
        .filter(|session| session.id == session_id)
        .ok_or_else(invalid_session_error)
}

fn invalid_session_error() -> ProviderError {
    ProviderError::new(
        ProviderErrorCode::InvalidSession,
        "This practice session is no longer active. Start a new session and retry.",
    )
}

fn busy_error() -> ProviderError {
    ProviderError::new(
        ProviderErrorCode::Busy,
        "A response is already being generated. Please wait and retry.",
    )
}

fn invalid_retry_error() -> ProviderError {
    ProviderError::new(
        ProviderErrorCode::InvalidRequest,
        "This retry does not match a reviewed answer. Keep the original answer and try again.",
    )
}

/// Longest stored coaching text; a whole-answer rewrite is the longest kind.
const MAX_FEEDBACK_CHARS: usize = 600;

fn bounded_feedback_text(value: &str) -> bool {
    !value.trim().is_empty() && value.chars().count() <= MAX_FEEDBACK_CHARS
}

#[cfg(test)]
#[path = "tests.rs"]
mod tests;
