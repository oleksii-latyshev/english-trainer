//! The initial prompt for one answer: what Whisper is told before it hears the audio. It primes
//! spelling of the learner's own words (glossary), the topic (the question being answered) and
//! names the learner just used, which the glossary cannot know.
use super::glossary::{vocabulary, WHISPER_PROMPT_MAX_CHARS};

/// The question is context, not vocabulary: a long one is cut so the words keep their room.
const QUESTION_MAX_CHARS: usize = 160;
const SESSION_TERMS_MAX: usize = 8;
const SESSION_TERM_MAX_CHARS: usize = 24;
/// Only the latest answers say what the conversation is about now.
const RECENT_ANSWERS_USED: usize = 3;

/// What the open practice session says about the answer being recorded.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct AnswerContext {
    pub question: String,
    /// The learner's earlier answers in this session, oldest first.
    pub recent_answers: Vec<String>,
}

/// `<question> Vocabulary: <terms from the last answers>, <glossary>.`, never longer than
/// Whisper reads. `None` when there is neither a question nor a term.
pub fn answer_prompt(glossary: &[String], context: &AnswerContext) -> Option<String> {
    let question = shorten(&collapse(&context.question), QUESTION_MAX_CHARS);
    let mut terms = session_terms(&context.recent_answers, glossary);
    terms.extend(glossary.iter().cloned());
    let room = WHISPER_PROMPT_MAX_CHARS.saturating_sub(question.chars().count() + 1);
    let words = vocabulary(&terms, room);
    match (question.is_empty(), words) {
        (true, None) => None,
        (true, Some(words)) => Some(words),
        (false, None) => Some(question),
        (false, Some(words)) => Some(format!("{question} {words}")),
    }
}

fn collapse(text: &str) -> String {
    text.split_whitespace().collect::<Vec<_>>().join(" ")
}

/// Cuts at a word boundary so the prompt never ends in half a word.
fn shorten(text: &str, max_chars: usize) -> String {
    if text.chars().count() <= max_chars {
        return text.to_string();
    }
    let cut: String = text.chars().take(max_chars).collect();
    match cut.rfind(' ') {
        Some(space) => cut[..space].trim_end().to_string(),
        None => cut,
    }
}

/// Names and technical words from the latest answers that the glossary does not hold: a capital
/// letter inside a sentence, or inside the word (`TypeScript`, `CS2`). Cheap and wrong now and
/// then, which is harmless: a wrong hint only primes a spelling.
fn session_terms(answers: &[String], glossary: &[String]) -> Vec<String> {
    let mut terms: Vec<String> = Vec::new();
    let start = answers.len().saturating_sub(RECENT_ANSWERS_USED);
    for answer in answers[start..].iter().rev() {
        let mut starts_sentence = true;
        for token in answer.split_whitespace() {
            let word = token.trim_matches(|c: char| !c.is_alphanumeric());
            let was_sentence_start = starts_sentence;
            starts_sentence = token.ends_with(['.', '!', '?']);
            if !is_notable(word, was_sentence_start) {
                continue;
            }
            let known = |list: &[String]| list.iter().any(|t| t.eq_ignore_ascii_case(word));
            if known(glossary) || known(&terms) {
                continue;
            }
            terms.push(word.to_string());
            if terms.len() == SESSION_TERMS_MAX {
                return terms;
            }
        }
    }
    terms
}

fn is_notable(word: &str, starts_sentence: bool) -> bool {
    let mut characters = word.chars();
    let Some(first) = characters.next() else {
        return false;
    };
    let length = word.chars().count();
    if !(2..=SESSION_TERM_MAX_CHARS).contains(&length) || !word.chars().all(char::is_alphanumeric) {
        return false;
    }
    let has_inner_capital = characters.clone().any(char::is_uppercase);
    let has_digit_and_letter =
        word.chars().any(|c| c.is_ascii_digit()) && word.chars().any(char::is_alphabetic);
    has_inner_capital || has_digit_and_letter || (first.is_uppercase() && !starts_sentence)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn owned(values: &[&str]) -> Vec<String> {
        values.iter().map(|value| value.to_string()).collect()
    }

    fn context(question: &str, answers: &[&str]) -> AnswerContext {
        AnswerContext {
            question: question.into(),
            recent_answers: owned(answers),
        }
    }

    #[test]
    fn the_prompt_holds_the_question_then_the_glossary() {
        let prompt = answer_prompt(
            &owned(&["Tauri", "Kubernetes"]),
            &context("What did you build this week?", &[]),
        );
        assert_eq!(
            prompt.as_deref(),
            Some("What did you build this week? Vocabulary: Tauri, Kubernetes.")
        );
    }

    #[test]
    fn a_missing_part_is_left_out_and_nothing_gives_no_prompt() {
        assert_eq!(answer_prompt(&[], &context("", &[])), None);
        assert_eq!(
            answer_prompt(&owned(&["Tauri"]), &context("  ", &[])).as_deref(),
            Some("Vocabulary: Tauri.")
        );
        assert_eq!(
            answer_prompt(&[], &context("How was your day?", &[])).as_deref(),
            Some("How was your day?")
        );
    }

    #[test]
    fn the_prompt_is_bounded_and_the_question_is_cut_at_a_word() {
        let glossary: Vec<String> = (0..200).map(|n| format!("word{n}")).collect();
        let question = "Tell me about the hardest bug you fixed recently ".repeat(20);
        let prompt = answer_prompt(&glossary, &context(&question, &[])).unwrap();
        assert!(prompt.chars().count() <= WHISPER_PROMPT_MAX_CHARS);
        assert!(prompt.starts_with("Tell me about the hardest bug"));
        assert!(prompt.contains("Vocabulary: word0, word1"));
        let before_vocabulary = prompt.split(" Vocabulary:").next().unwrap();
        assert!(before_vocabulary.chars().count() <= QUESTION_MAX_CHARS);
        assert!(!before_vocabulary.ends_with(' '));
    }

    #[test]
    fn names_from_the_last_answers_come_first_and_skip_the_glossary() {
        let prompt = answer_prompt(
            &owned(&["Tauri"]),
            &context(
                "What next?",
                &[
                    "Old answer about Zed.",
                    "We moved to Vercel and tauri. It works with TypeScript and CS2 stats. I think so.",
                ],
            ),
        )
        .unwrap();
        assert_eq!(
            prompt,
            "What next? Vocabulary: Vercel, TypeScript, CS2, Zed, Tauri."
        );
    }

    #[test]
    fn only_the_latest_answers_and_a_few_names_are_used() {
        let answers: Vec<String> = (0..10)
            .map(|n| format!("we met Name{n}x and Zed{n} and Kim{n} and Lee{n}."))
            .collect();
        let terms = session_terms(&answers, &[]);
        assert_eq!(terms.len(), SESSION_TERMS_MAX);
        assert!(terms
            .iter()
            .all(|term| !term.contains("Name0") && !term.contains("Name6")));
    }

    #[test]
    fn sentence_starts_and_i_are_not_names() {
        assert!(session_terms(&owned(&["Well I think. Then we left!"]), &[]).is_empty());
        assert_eq!(
            session_terms(&owned(&["We talked to Anna, and she said hi."]), &[]),
            ["Anna"]
        );
    }
}
