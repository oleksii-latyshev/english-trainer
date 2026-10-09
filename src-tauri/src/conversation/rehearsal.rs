use super::{
    ActiveSession, InputSource, PracticeMode, PracticePhase, ProviderError, ProviderErrorCode,
    StoredTurn,
};

pub(super) fn parse_practice_mode(value: &str) -> PracticeMode {
    match value {
        "text_chat" => PracticeMode::TextChat,
        "write_then_speak" => PracticeMode::WriteThenSpeak,
        _ => PracticeMode::Voice,
    }
}

pub(super) fn parse_practice_phase(value: &str) -> PracticePhase {
    match value {
        "writing" => PracticePhase::Writing,
        "writing_review" => PracticePhase::WritingReview,
        "speaking_review" => PracticePhase::SpeakingReview,
        _ => PracticePhase::Speaking,
    }
}

pub(super) fn spoken_turn_count(
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

pub(super) fn replay_questions(
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

pub(super) fn validate_answer_source(
    session: &ActiveSession,
    source: InputSource,
) -> Result<(), ProviderError> {
    if session.practice_phase.is_review() {
        return Err(invalid_phase_transition_error());
    }
    let accepted = match session.practice_mode {
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
        Err(invalid_phase_transition_error())
    }
}

pub(super) fn invalid_phase_transition_error() -> ProviderError {
    ProviderError::new(
        ProviderErrorCode::InvalidRequest,
        "That answer or practice stage does not match the current session phase. Refresh the session and try again.",
    )
}
