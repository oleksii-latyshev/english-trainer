use super::rehearsal::replay_questions;
use super::{
    PracticeMode, PracticePhase, RecurringMistake, TurnCoaching, WrapupPhrase, WrapupPreparation,
};
use crate::learning::mistake_practice::MistakePracticeQuestion;
use crate::providers::{AnsweredBy, AttemptComparison};
use serde::{Deserialize, Serialize};
use std::sync::atomic::AtomicBool;
use std::sync::Arc;
use std::time::Instant;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, ts_rs::TS)]
#[ts(export)]
pub struct PracticeSession {
    pub session_id: u64,
    pub opening_question: String,
    pub turn_count: usize,
    pub target_turns: usize,
    pub retry_evidence: Vec<AttemptComparison>,
    pub topic_id: String,
    pub topic_label: String,
    pub topic_custom: Option<String>,
    pub duration_goal_seconds: Option<u32>,
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

#[derive(Debug, Clone, PartialEq, Eq, Serialize, ts_rs::TS)]
#[ts(export)]
pub struct PracticeDialogue {
    pub session_id: u64,
    pub opening_question: String,
    pub turns: Vec<StoredTurn>,
    pub input_sources: Vec<String>,
    pub reply_times_ms: Vec<Option<u64>>,
    pub answer_durations_ms: Vec<Option<u64>>,
    pub help_used: Vec<bool>,
    pub coaching: Vec<TurnCoaching>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, ts_rs::TS)]
#[ts(export)]
pub struct FinishedPracticeSession {
    pub session_id: u64,
    pub finished: bool,
    pub turn_count: usize,
    pub target_turns: usize,
    pub duration_ms: u64,
    pub topic_label: String,
    pub duration_goal_seconds: Option<u32>,
    pub numbers: crate::learning::session_stats::SessionNumbers,
    pub phrases: Vec<WrapupPhrase>,
    pub recurring_mistakes: Vec<RecurringMistake>,
    pub pending_coaching: usize,
    pub is_coaching_paused: bool,
    pub wrapup_preparation: WrapupPreparation,
    pub practice_mode: PracticeMode,
    pub practice_phase: PracticePhase,
    pub written_turn_count: usize,
    pub spoken_turn_count: usize,
    pub is_mistake_practice: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, ts_rs::TS)]
#[ts(export)]
pub struct StoredTurn {
    pub learner: String,
    pub assistant_reply: String,
    pub assistant_question: String,
    pub answered_by: Option<AnsweredBy>,
}

impl StoredTurn {
    pub(crate) fn prompt(&self) -> &str {
        if self.assistant_question.is_empty() {
            &self.assistant_reply
        } else {
            &self.assistant_question
        }
    }
}

pub struct ActiveSession {
    pub(crate) id: u64,
    pub(crate) opening_question: String,
    pub(crate) turns: Vec<StoredTurn>,
    pub(crate) in_flight: bool,
    pub(crate) reply_cancelled: Arc<AtomicBool>,
    pub(crate) topic_id: String,
    pub(crate) topic_label: String,
    pub(crate) topic_custom: Option<String>,
    pub(crate) duration_goal_seconds: Option<u32>,
    pub(crate) active_duration_ms: u64,
    pub(crate) started_at: i64,
    pub(crate) clock_anchor: Option<Instant>,
    pub(crate) practice_mode: PracticeMode,
    pub(crate) practice_phase: PracticePhase,
    pub(crate) written_turn_count: usize,
    pub(crate) is_mistake_practice: bool,
    pub(crate) mistake_questions: Vec<MistakePracticeQuestion>,
}

impl ActiveSession {
    pub(crate) fn current_question(&self) -> String {
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
