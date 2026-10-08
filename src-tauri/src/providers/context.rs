//! Size accounting and trimming for [`ConversationContext`], so each provider takes what fits
//! its own window.

use super::{ConversationContext, ProviderError, ProviderErrorCode};

impl ConversationContext {
    /// Characters of everything that is sent to a provider except fixed instruction text.
    pub fn char_count(&self) -> usize {
        let count = |text: &String| text.chars().count();
        count(&self.opening_question)
            + count(&self.latest_transcript)
            + self
                .learning_targets
                .iter()
                .map(|item| count(&item.kind) + count(&item.cue) + count(&item.target))
                .sum::<usize>()
            + self
                .recent_turns
                .iter()
                .map(|turn| {
                    count(&turn.learner)
                        + count(&turn.assistant_reply)
                        + count(&turn.assistant_question)
                })
                .sum::<usize>()
            + self.earlier_answers.iter().map(count).sum::<usize>()
            + self.asked_questions.iter().map(count).sum::<usize>()
    }

    /// Drops the least useful history until the context fits `max_chars`: condensed older answers
    /// first, then the oldest full turns, then the oldest asked questions. The latest transcript,
    /// opening question and learning targets are never dropped.
    pub fn trim_to(&mut self, max_chars: usize) {
        while self.char_count() > max_chars {
            if !self.earlier_answers.is_empty() {
                self.earlier_answers.remove(0);
            } else if !self.recent_turns.is_empty() {
                self.recent_turns.remove(0);
            } else if !self.asked_questions.is_empty() {
                self.asked_questions.remove(0);
            } else {
                return;
            }
        }
    }

    /// A smaller copy for a model with a short window: the last `max_turns` turns and
    /// `max_questions` asked questions, no condensed older answers, at most `max_chars`.
    pub fn compact(&self, max_turns: usize, max_chars: usize, max_questions: usize) -> Self {
        let mut compact = self.clone();
        let skipped_turns = compact.recent_turns.len().saturating_sub(max_turns);
        compact.recent_turns.drain(..skipped_turns);
        compact.earlier_answers.clear();
        let skipped_questions = compact.asked_questions.len().saturating_sub(max_questions);
        compact.asked_questions.drain(..skipped_questions);
        compact.trim_to(max_chars);
        compact
    }
}

/// Limits shared by the plain-text providers (Gemini and Apple); each adapter compacts first.
pub(super) fn validate_plain_context(
    context: &ConversationContext,
    max_chars: usize,
) -> Result<(), ProviderError> {
    if context.latest_transcript.trim().is_empty()
        || context.char_count() > max_chars
        || context.learning_targets.len() > 2
    {
        return Err(ProviderError::new(
            ProviderErrorCode::InvalidRequest,
            "Conversation context is empty or exceeds its character limit.",
        ));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::providers::ContextTurn;

    fn turn(index: usize) -> ContextTurn {
        ContextTurn {
            learner: format!("answer {index}"),
            assistant_reply: "Nice.".into(),
            assistant_question: format!("Question {index}?"),
        }
    }

    fn long_context() -> ConversationContext {
        ConversationContext {
            opening_question: "Opening?".into(),
            recent_turns: (0..20).map(turn).collect(),
            latest_transcript: "latest".into(),
            learning_targets: Vec::new(),
            earlier_answers: (0..30).map(|i| format!("old {i}")).collect(),
            asked_questions: (0..40).map(|i| format!("Question {i}?")).collect(),
        }
    }

    #[test]
    fn compact_keeps_the_latest_turns_and_questions_and_drops_condensed_history() {
        let compact = long_context().compact(6, 10_000, 10);
        assert_eq!(compact.recent_turns.len(), 6);
        assert_eq!(compact.recent_turns[0].learner, "answer 14");
        assert_eq!(compact.recent_turns[5].learner, "answer 19");
        assert!(compact.earlier_answers.is_empty());
        assert_eq!(compact.asked_questions.len(), 10);
        assert_eq!(compact.asked_questions[9], "Question 39?");
        assert_eq!(compact.latest_transcript, "latest");
        assert_eq!(compact.opening_question, "Opening?");
    }

    #[test]
    fn compact_drops_oldest_turns_then_questions_to_fit_the_budget_but_keeps_fixed_fields() {
        let mut context = long_context();
        context.learning_targets = vec![crate::providers::LearningPromptTarget {
            kind: "phrase".into(),
            cue: "work".into(),
            target: "I work on".into(),
        }];
        let compact = context.compact(6, 250, 10);
        assert!(compact.char_count() <= 250);
        assert!(compact.recent_turns.len() < 6);
        assert_eq!(compact.latest_transcript, "latest");
        assert_eq!(compact.learning_targets.len(), 1);
        assert_eq!(
            compact.recent_turns.last().map(|t| t.learner.as_str()),
            Some("answer 19")
        );

        let tiny = context.compact(6, 0, 10);
        assert!(tiny.recent_turns.is_empty() && tiny.asked_questions.is_empty());
        assert_eq!(tiny.latest_transcript, "latest");
        assert_eq!(tiny.opening_question, "Opening?");
        assert_eq!(tiny.learning_targets.len(), 1);
    }

    #[test]
    fn trim_drops_condensed_answers_before_full_turns() {
        let mut context = long_context();
        let without_answers = {
            let mut copy = context.clone();
            copy.earlier_answers.clear();
            copy.char_count()
        };
        context.trim_to(without_answers + 10);
        assert_eq!(context.recent_turns.len(), 20);
        assert!(context.char_count() <= without_answers + 10);
        // Oldest condensed answers go first.
        assert!(context.earlier_answers.iter().all(|a| a != "old 0"));
    }

    #[test]
    fn plain_validation_rejects_an_empty_answer_and_an_oversized_context() {
        assert!(validate_plain_context(&long_context(), 10_000).is_ok());
        assert!(validate_plain_context(&long_context(), 50).is_err());
        let mut empty = long_context();
        empty.latest_transcript = "  ".into();
        assert!(validate_plain_context(&empty, 10_000).is_err());
    }
}
