//! Builds the provider context for the next turn from the session's history.
//! Pure: no session state.

use super::rules::{
    MAX_ASKED_QUESTIONS, MAX_ASKED_QUESTION_CHARS, MAX_CONTEXT_CHARS, MAX_EARLIER_ANSWER_CHARS,
    MAX_TURNS,
};
use super::StoredTurn;
use crate::providers::{ContextTurn, ConversationContext, LearningPromptTarget};

pub(super) struct ContextInput<'a> {
    pub opening_question: &'a str,
    pub prior_turns: &'a [StoredTurn],
    pub latest_transcript: &'a str,
    pub learning_targets: Vec<LearningPromptTarget>,
    pub profile: Option<crate::conversation::PersonalProfile>,
    pub topic: Option<String>,
}

const QUESTION_STYLE_HINTS: [&str; 6] = [
    "describe",
    "explain",
    "compare",
    "opinion",
    "story",
    "polite disagreement",
];

/// `prior_turns` are the completed turns before `latest_transcript`, oldest first.
///
/// The last `MAX_TURNS` go in full. Older learner answers are condensed so Eva keeps what the
/// learner already told her, and every question already asked is listed so she does not repeat
/// one. Over budget, condensed answers go first, then the oldest turns, then the oldest questions.
pub(super) fn build_context(input: ContextInput<'_>) -> ConversationContext {
    let ContextInput {
        opening_question,
        prior_turns,
        latest_transcript,
        learning_targets,
        profile,
        topic,
    } = input;
    let split = prior_turns.len().saturating_sub(MAX_TURNS);
    let (older, recent) = prior_turns.split_at(split);
    let mut context = ConversationContext {
        opening_question: opening_question.to_string(),
        recent_turns: recent
            .iter()
            .map(|turn| ContextTurn {
                learner: turn.learner.clone(),
                assistant_reply: turn.assistant_reply.clone(),
                assistant_question: turn.assistant_question.clone(),
            })
            .collect(),
        latest_transcript: latest_transcript.trim().to_string(),
        learning_targets,
        earlier_answers: older
            .iter()
            .map(|turn| shorten(&turn.learner, MAX_EARLIER_ANSWER_CHARS))
            .filter(|answer| !answer.is_empty())
            .collect(),
        asked_questions: asked_questions(opening_question, prior_turns),
        profile,
        topic,
        question_style_hint: QUESTION_STYLE_HINTS[prior_turns.len() % QUESTION_STYLE_HINTS.len()]
            .to_string(),
        ..Default::default()
    };
    context.trim_to(MAX_CONTEXT_CHARS);
    context
}

fn asked_questions(opening_question: &str, turns: &[StoredTurn]) -> Vec<String> {
    let mut asked: Vec<String> = Vec::new();
    let candidates = std::iter::once(opening_question)
        .chain(turns.iter().map(|turn| turn.assistant_question.as_str()));
    for question in candidates {
        let question = shorten(question, MAX_ASKED_QUESTION_CHARS);
        // After a restart the opening question is the last question asked; do not list it twice.
        if !question.is_empty() && !asked.contains(&question) {
            asked.push(question);
        }
    }
    let skipped = asked.len().saturating_sub(MAX_ASKED_QUESTIONS);
    asked.drain(..skipped);
    asked
}

/// Cuts at a word boundary within `max_chars` and marks the cut with an ellipsis.
fn shorten(text: &str, max_chars: usize) -> String {
    let text = text.split_whitespace().collect::<Vec<_>>().join(" ");
    if text.chars().count() <= max_chars {
        return text;
    }
    let cut: String = text.chars().take(max_chars).collect();
    let at_word_end = text.chars().nth(max_chars).is_some_and(char::is_whitespace);
    let kept = if at_word_end {
        cut.as_str()
    } else {
        cut.rsplit_once(' ').map_or(cut.as_str(), |(head, _)| head)
    };
    format!("{}…", kept.trim_end())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn turn(index: usize, learner: &str) -> StoredTurn {
        StoredTurn {
            learner: learner.into(),
            assistant_reply: "Nice.".into(),
            assistant_question: format!("Question {index}?"),
            answered_by: None,
        }
    }

    fn session(count: usize) -> Vec<StoredTurn> {
        (0..count)
            .map(|i| turn(i, &format!("answer {i}")))
            .collect()
    }

    fn build_with_history(
        opening_question: &str,
        prior_turns: &[StoredTurn],
        latest: &str,
    ) -> ConversationContext {
        build_context(ContextInput {
            opening_question,
            prior_turns,
            latest_transcript: latest,
            learning_targets: Vec::new(),
            profile: None,
            topic: None,
        })
    }

    #[test]
    fn the_last_twenty_turns_are_sent_in_full_and_older_answers_are_condensed() {
        let context = build_with_history("Opening?", &session(30), " latest ");
        assert_eq!(context.recent_turns.len(), 20);
        assert_eq!(context.recent_turns[0].learner, "answer 10");
        assert_eq!(context.recent_turns[19].learner, "answer 29");
        assert_eq!(context.earlier_answers.len(), 10);
        assert_eq!(context.earlier_answers[0], "answer 0");
        assert_eq!(context.latest_transcript, "latest");
        assert_eq!(context.opening_question, "Opening?");
    }

    #[test]
    fn a_short_session_has_no_condensed_history() {
        let context = build_with_history("Opening?", &session(5), "x");
        assert_eq!(context.recent_turns.len(), 5);
        assert!(context.earlier_answers.is_empty());
    }

    #[test]
    fn older_answers_are_cut_at_a_word_boundary() {
        let long = "I finished university last year and ".repeat(10);
        let mut turns = session(25);
        turns[0] = turn(0, &long);
        let context = build_with_history("Opening?", &turns, "x");
        let condensed = &context.earlier_answers[0];
        assert!(condensed.chars().count() <= MAX_EARLIER_ANSWER_CHARS + 1);
        let last_word = condensed.trim_end_matches('…').rsplit(' ').next().unwrap();
        assert!(["I", "finished", "university", "last", "year", "and"].contains(&last_word));
        assert!(condensed.ends_with('…'));
        assert!(condensed.starts_with("I finished university"));
    }

    #[test]
    fn every_asked_question_is_listed_capped_to_the_most_recent_forty() {
        let context = build_with_history("Opening?", &session(10), "x");
        assert_eq!(context.asked_questions.len(), 11);
        assert_eq!(context.asked_questions[0], "Opening?");
        assert_eq!(context.asked_questions[10], "Question 9?");

        let long = build_with_history("Opening?", &session(70), "x");
        assert_eq!(long.asked_questions.len(), 40);
        assert_eq!(long.asked_questions[39], "Question 69?");
        assert_eq!(long.asked_questions[0], "Question 30?");
    }

    #[test]
    fn long_questions_are_shortened_and_the_restart_opening_is_not_duplicated() {
        let mut turns = session(3);
        turns[2].assistant_question = "word ".repeat(100);
        let context = build_with_history("Question 1?", &turns, "x");
        assert!(context
            .asked_questions
            .iter()
            .all(|q| q.chars().count() <= 201));
        assert_eq!(
            context
                .asked_questions
                .iter()
                .filter(|q| *q == "Question 1?")
                .count(),
            1
        );
    }

    #[test]
    fn over_budget_condensed_answers_go_first_oldest_first_and_fixed_fields_stay() {
        let big = "word ".repeat(30);
        let mut turns: Vec<StoredTurn> = (0..400).map(|i| turn(i, &format!("{i} {big}"))).collect();
        for t in &mut turns {
            t.assistant_reply = "r".repeat(100);
        }
        let targets = vec![LearningPromptTarget {
            kind: "phrase".into(),
            cue: "work".into(),
            target: "I work on".into(),
        }];
        let context = build_context(ContextInput {
            opening_question: "Opening?",
            prior_turns: &turns,
            latest_transcript: "latest",
            learning_targets: targets,
            profile: None,
            topic: None,
        });
        assert!(context.char_count() <= MAX_CONTEXT_CHARS);
        assert_eq!(context.recent_turns.len(), 20);
        assert!(context.earlier_answers.len() < 380);
        let last = context.earlier_answers.last().unwrap();
        assert!(last.starts_with("379 "));
        assert_eq!(context.latest_transcript, "latest");
        assert_eq!(context.opening_question, "Opening?");
        assert_eq!(context.learning_targets.len(), 1);
    }

    #[test]
    fn a_seventy_turn_session_stays_under_budget_and_the_primary_prompt_is_bounded() {
        let turns: Vec<StoredTurn> = (0..70)
            .map(|i| {
                let mut t = turn(
                    i,
                    &format!(
                        "I said something fairly long about topic {i}. {}",
                        "detail ".repeat(25)
                    ),
                );
                t.assistant_reply = "That sounds really interesting, tell me more about it.".into();
                t
            })
            .collect();
        let context = build_with_history("Opening?", &turns, "my latest answer");
        let prompt_chars = crate::providers::primary_prompt_chars(&context);
        println!(
            "70-turn session: context {} chars, primary prompt {} chars",
            context.char_count(),
            prompt_chars
        );
        assert!(context.char_count() <= MAX_CONTEXT_CHARS);
        assert!(prompt_chars < MAX_CONTEXT_CHARS + 2_000);
        let compact = context.compact(6, 3_500, 10);
        let apple_chars = crate::providers::primary_prompt_chars(&compact);
        println!("70-turn session: Apple backup prompt {apple_chars} chars");
        assert!(apple_chars < 3_500 + 2_000);
    }

    #[test]
    fn bounded_context_retains_topic_and_profile_on_compaction() {
        let profile = crate::conversation::PersonalProfile {
            role: "Software engineer".into(),
            stack: "Rust, TypeScript, React, Tauri".into(),
            interests: "Distributed systems, cycling".into(),
            goals: "Natural everyday fluency".into(),
        };
        let topic = Some("Work & technology".to_string());
        let prior_turns = session(10);
        let context = build_context(ContextInput {
            opening_question: "What projects are you working on?",
            prior_turns: &prior_turns,
            latest_transcript: "I am building a desktop application in Rust.",
            learning_targets: Vec::new(),
            profile: Some(profile.clone()),
            topic: topic.clone(),
        });
        assert_eq!(context.topic, topic);
        assert_eq!(context.question_style_hint, "story");
        assert_eq!(
            context.profile.as_ref().map(|p| p.role.as_str()),
            Some("Software engineer")
        );

        // Compacting for Apple tight window retains topic and profile
        let compact = context.compact(4, 3_500, 6);
        assert_eq!(compact.topic, topic);
        assert_eq!(compact.question_style_hint, "story");
        assert!(compact.profile.is_some());
        assert_eq!(compact.profile.as_ref().unwrap().role, "Software engineer");
        assert!(compact.profile.as_ref().unwrap().stack.contains("Rust"));
    }
}
