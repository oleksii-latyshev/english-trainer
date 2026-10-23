use super::{ActiveSession, InputSource, PracticeMode, PracticePhase, StoredTurn};
use crate::conversation::error::ConversationError;
use crate::providers::ConversationTurn;

pub(crate) fn parse_practice_mode(value: &str) -> PracticeMode {
    match value {
        "text_chat" => PracticeMode::TextChat,
        "write_then_speak" => PracticeMode::WriteThenSpeak,
        _ => PracticeMode::Voice,
    }
}

pub(crate) fn parse_practice_phase(value: &str) -> PracticePhase {
    match value {
        "writing" => PracticePhase::Writing,
        "writing_review" => PracticePhase::WritingReview,
        "speaking_review" => PracticePhase::SpeakingReview,
        _ => PracticePhase::Speaking,
    }
}

pub(crate) fn spoken_turn_count(
    mode: PracticeMode,
    phase: PracticePhase,
    total: usize,
    written: usize,
) -> usize {
    match mode {
        PracticeMode::Voice => total,
        PracticeMode::TextChat => 0,
        PracticeMode::WriteThenSpeak
            if matches!(
                phase,
                PracticePhase::Speaking | PracticePhase::SpeakingReview
            ) =>
        {
            total.saturating_sub(written)
        }
        PracticeMode::WriteThenSpeak => 0,
    }
}

pub(crate) fn replay_questions(
    opening_question: &str,
    turns: &[StoredTurn],
    written_turn_count: usize,
) -> Vec<String> {
    let mut questions = Vec::with_capacity(written_turn_count);
    if written_turn_count == 0 {
        return questions;
    }
    questions.push(opening_question.to_string());
    questions.extend(
        turns
            .iter()
            .take(written_turn_count.saturating_sub(1))
            .map(|turn| turn.prompt().to_string()),
    );
    questions
}

pub(crate) fn validate_answer_source(
    session: &ActiveSession,
    source: InputSource,
) -> Result<(), ConversationError> {
    if session.practice_phase.is_review() {
        return Err(ConversationError::InvalidPhaseTransition);
    }
    let accepted = match session.practice_mode {
        PracticeMode::Voice if session.is_mistake_practice => source != InputSource::Text,
        PracticeMode::Voice => true,
        PracticeMode::TextChat => {
            session.practice_phase == PracticePhase::Writing && source == InputSource::Text
        }
        PracticeMode::WriteThenSpeak => match session.practice_phase {
            PracticePhase::Writing => source == InputSource::Text,
            PracticePhase::Speaking => source != InputSource::Text,
            _ => false,
        },
    };
    if accepted {
        Ok(())
    } else {
        Err(ConversationError::InvalidPhaseTransition)
    }
}

pub(crate) struct ScriptedReply {
    next_question: Option<String>,
    is_final: bool,
    phase: &'static str,
}

impl ScriptedReply {
    pub(crate) fn turn(&self) -> ConversationTurn {
        ConversationTurn {
            spoken_reply: if self.is_final {
                "Thanks for practicing those answers."
            } else {
                "Thanks for sharing that."
            }
            .to_string(),
            question: self.next_question.clone(),
            session_phase: self.phase.to_string(),
            is_complete: self.is_final,
            provider_latency_ms: None,
            first_token_ms: None,
            answered_by: None,
        }
    }
}

pub(crate) fn scripted_reply(
    session: &ActiveSession,
) -> Result<Option<ScriptedReply>, ConversationError> {
    let is_replay = session.practice_mode == PracticeMode::WriteThenSpeak
        && session.practice_phase == PracticePhase::Speaking;
    let is_mistake_practice = session.is_mistake_practice;
    if is_mistake_practice && session.turns.len() >= 5 {
        return Err(ConversationError::InvalidPhaseTransition);
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
    let mistake_is_final = is_mistake_practice && session.turns.len() + 1 == 5;
    if session.practice_phase.is_review()
        || (is_replay
            && (spoken_count >= session.written_turn_count
                || replay_question.as_deref().unwrap_or_default().is_empty()))
    {
        return Err(ConversationError::InvalidPhaseTransition);
    }
    if replay_question.is_some() {
        return Ok(Some(ScriptedReply {
            next_question: questions.get(spoken_count + 1).cloned(),
            is_final: replay_is_final,
            phase: "rehearsal",
        }));
    }
    if is_mistake_practice {
        return Ok(Some(ScriptedReply {
            next_question: session
                .mistake_questions
                .get(session.turns.len() + 1)
                .map(|item| item.question.clone()),
            is_final: mistake_is_final,
            phase: if mistake_is_final {
                "mistake_practice"
            } else {
                "rehearsal"
            },
        }));
    }
    Ok(None)
}
