use super::{AppleHelper, ConversationContext};
use std::{
    path::PathBuf,
    time::{Duration, Instant},
};

const SYNTHETIC_TRANSCRIPTS: [&str; 10] = [
    "I enjoy reading science fiction because it helps me imagine different futures.",
    "At work, I try to write small functions because they are easier to understand and test.",
    "I usually plan a weekend trip by choosing one place and leaving time to explore.",
    "Learning a new language feels easier when I practice a little every day.",
    "I prefer walking in the morning because the streets are quieter and the air feels fresh.",
    "A good team shares progress early so problems are easier to solve together.",
    "I like cooking simple meals with seasonal vegetables and fresh herbs.",
    "One useful habit is writing down the next small step before finishing work.",
    "I would like to visit a coastal town and learn about its local history.",
    "When a project changes direction, I first clarify the goal and then adjust the plan.",
];

/// Measures provider generation readiness only; it does not include speech, audio output, or turn latency.
#[test]
#[ignore = "live benchmark; requires a physical Mac with Apple Foundation Models available"]
fn real_apple_f4_sentence_readiness_latency() {
    if !cfg!(target_os = "macos") {
        panic!("live benchmark requires a physical Mac");
    }
    let binary = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("binaries")
        .join("apple-conversation");
    let helper = AppleHelper::new(Some(binary));
    helper.prewarm().expect("prewarm the bundled Apple helper");

    let mut first_sentence_ms = Vec::with_capacity(SYNTHETIC_TRANSCRIPTS.len());
    let mut full_completion_ms = Vec::with_capacity(SYNTHETIC_TRANSCRIPTS.len());
    let mut errors = 0;

    for (index, transcript) in SYNTHETIC_TRANSCRIPTS.iter().enumerate() {
        let context = ConversationContext {
            opening_question: format!("Tell me about this idea, example {}.", index + 1),
            latest_transcript: (*transcript).into(),
            ..Default::default()
        };
        let started_at = Instant::now();
        let mut accumulated = String::new();
        let mut sentence_ready_at = None;
        let result = helper.generate_turn(&context, &mut |delta| {
            accumulated.push_str(delta);
            if sentence_ready_at.is_none() && has_complete_sentence(&accumulated) {
                sentence_ready_at = Some(started_at.elapsed());
            }
        });
        let full_elapsed = started_at.elapsed();

        let Ok(turn) = result else {
            errors += 1;
            continue;
        };
        if turn.spoken_reply.trim().is_empty()
            || turn
                .question
                .as_deref()
                .is_none_or(|question| question.trim().is_empty())
        {
            errors += 1;
            continue;
        }

        let sentence_elapsed = sentence_ready_at
            .or_else(|| has_terminal_sentence(&accumulated).then_some(full_elapsed));
        let Some(sentence_elapsed) = sentence_elapsed else {
            errors += 1;
            continue;
        };
        assert!(sentence_elapsed > Duration::ZERO);
        assert!(full_elapsed > Duration::ZERO);
        assert!(sentence_elapsed <= full_elapsed);
        first_sentence_ms.push(sentence_elapsed.as_secs_f64() * 1000.0);
        full_completion_ms.push(full_elapsed.as_secs_f64() * 1000.0);
    }

    let successes = first_sentence_ms.len();
    eprintln!(
        "F4 sentence readiness ms: p50={} p95={}; full provider completion ms: p50={} p95={}; successes={} errors={}",
        percentile(&first_sentence_ms, 0.50),
        percentile(&first_sentence_ms, 0.95),
        percentile(&full_completion_ms, 0.50),
        percentile(&full_completion_ms, 0.95),
        successes,
        errors,
    );
    assert_eq!(
        successes,
        SYNTHETIC_TRANSCRIPTS.len(),
        "some benchmark requests failed or returned unusable text"
    );
}

fn has_complete_sentence(text: &str) -> bool {
    let chars: Vec<char> = text.chars().collect();
    chars.iter().enumerate().any(|(index, character)| {
        if !matches!(character, '.' | '?' | '!') || index + 1 >= chars.len() {
            return false;
        }
        let previous_is_word = index > 0 && chars[index - 1].is_alphanumeric();
        let next = chars[index + 1];
        let next_is_boundary = next.is_whitespace() || is_closing_quote(next);
        let is_decimal = *character == '.'
            && index > 0
            && chars[index - 1].is_ascii_digit()
            && next.is_ascii_digit();
        previous_is_word && next_is_boundary && !is_decimal
    })
}

#[test]
fn sentence_readiness_ignores_decimal_points() {
    assert!(!has_complete_sentence("The measurement is 3.14 meters"));
    assert!(has_complete_sentence(
        "The measurement is 3.14 meters. Next"
    ));
}

fn has_terminal_sentence(text: &str) -> bool {
    let trimmed = text
        .trim_end()
        .trim_end_matches(is_closing_quote)
        .trim_end();
    trimmed
        .chars()
        .last()
        .is_some_and(|character| matches!(character, '.' | '?' | '!'))
        && trimmed.chars().any(char::is_alphabetic)
}

fn is_closing_quote(character: char) -> bool {
    matches!(character, '\'' | '"' | '”' | '’' | ')' | ']' | '}')
}

fn percentile(samples: &[f64], quantile: f64) -> String {
    if samples.is_empty() {
        return "n/a".into();
    }
    let mut sorted = samples.to_vec();
    sorted.sort_by(f64::total_cmp);
    let index = ((sorted.len() as f64 * quantile).ceil() as usize)
        .saturating_sub(1)
        .min(sorted.len() - 1);
    format!("{:.1}", sorted[index])
}
