//! Turns free-form model text into a spoken reply plus one question.
//! Imperfect output is trimmed, never rejected; only empty output is an error.

use super::{ConversationTurn, ProviderError, ProviderErrorCode};

const MAX_REPLY_CHARS: usize = 350;

pub(super) fn plain_turn(raw: &str) -> Result<ConversationTurn, ProviderError> {
    let text = cap_at_sentence(&strip_markdown(raw));
    if text.is_empty() {
        return Err(ProviderError::new(
            ProviderErrorCode::InvalidOutput,
            "The AI returned an empty reply. Please retry.",
        ));
    }
    let (spoken_reply, question) = split_question(&text);
    Ok(ConversationTurn {
        spoken_reply,
        question,
        session_phase: "active".into(),
        is_complete: false,
        provider_latency_ms: None,
        first_token_ms: None,
        answered_by: None,
    })
}

fn strip_markdown(raw: &str) -> String {
    raw.lines()
        .map(|line| {
            let line = line.trim_start();
            let line = line.trim_start_matches(['#', '>', '-', '*', '•']);
            let digits = line.chars().take_while(char::is_ascii_digit).count();
            match line[digits..].strip_prefix(". ") {
                Some(rest) if digits > 0 => rest,
                _ => line,
            }
        })
        .collect::<Vec<_>>()
        .join(" ")
        .replace(['*', '`', '#', '~'], "")
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

fn cap_at_sentence(text: &str) -> String {
    if text.chars().count() <= MAX_REPLY_CHARS {
        return text.to_string();
    }
    let cut: String = text.chars().take(MAX_REPLY_CHARS).collect();
    let end = cut
        .char_indices()
        .filter(|(index, character)| {
            is_terminator(*character)
                && cut[index + character.len_utf8()..]
                    .chars()
                    .next()
                    .is_none_or(char::is_whitespace)
        })
        .map(|(index, character)| index + character.len_utf8())
        .next_back();
    match end {
        Some(end) => cut[..end].to_string(),
        None => format!("{}.", cut.trim_end_matches(|c: char| !c.is_alphanumeric())),
    }
}

fn is_terminator(character: char) -> bool {
    matches!(character, '.' | '?' | '!')
}

fn sentences(text: &str) -> Vec<&str> {
    let mut result = Vec::new();
    let mut start = 0;
    let mut chars = text.char_indices().peekable();
    while let Some((index, character)) = chars.next() {
        let ends_sentence =
            is_terminator(character) && chars.peek().is_none_or(|(_, next)| next.is_whitespace());
        if ends_sentence {
            let end = index + character.len_utf8();
            result.push(text[start..end].trim());
            start = end;
        }
    }
    if !text[start..].trim().is_empty() {
        result.push(text[start..].trim());
    }
    result
}

fn split_question(text: &str) -> (String, Option<String>) {
    let parts = sentences(text);
    let Some(position) = parts.iter().rposition(|part| part.ends_with('?')) else {
        return (text.to_string(), None);
    };
    let spoken: Vec<&str> = parts
        .iter()
        .enumerate()
        .filter(|(index, _)| *index != position)
        .map(|(_, part)| *part)
        .collect();
    if spoken.is_empty() {
        // An empty reply would read as a pending Coach answer elsewhere.
        return (text.to_string(), None);
    }
    (spoken.join(" "), Some(parts[position].to_string()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn splits_reaction_from_the_final_question() {
        let turn =
            plain_turn("That sounds fun. I like hiking too.\nWhere do you usually go?").unwrap();
        assert_eq!(turn.spoken_reply, "That sounds fun. I like hiking too.");
        assert_eq!(turn.question.as_deref(), Some("Where do you usually go?"));
        assert_eq!(turn.session_phase, "active");
        assert!(!turn.is_complete);
    }

    #[test]
    fn strips_markdown_bullets_and_extra_whitespace() {
        let turn =
            plain_turn("## **Nice!**   You   work in `Rust`.\n- What do you build?").unwrap();
        assert_eq!(turn.spoken_reply, "Nice! You work in Rust.");
        assert_eq!(turn.question.as_deref(), Some("What do you build?"));
        let numbered = plain_turn("1. Great answer.\n2. Why?").unwrap();
        assert_eq!(numbered.spoken_reply, "Great answer.");
    }

    #[test]
    fn text_without_a_question_is_kept_as_the_reply() {
        let turn = plain_turn("That is interesting.").unwrap();
        assert_eq!(turn.spoken_reply, "That is interesting.");
        assert_eq!(turn.question, None);
    }

    #[test]
    fn a_lone_question_stays_in_the_reply() {
        let turn = plain_turn("What did you do today?").unwrap();
        assert_eq!(turn.spoken_reply, "What did you do today?");
        assert_eq!(turn.question, None);
    }

    #[test]
    fn long_text_is_cut_at_a_sentence_boundary() {
        let sentence = "This is a fairly long sentence about something. ";
        let turn = plain_turn(&sentence.repeat(20)).unwrap();
        assert!(turn.spoken_reply.chars().count() <= MAX_REPLY_CHARS);
        assert!(turn.spoken_reply.ends_with('.'));
    }

    #[test]
    fn long_text_without_punctuation_is_still_capped() {
        let turn = plain_turn(&"word ".repeat(200)).unwrap();
        assert!(turn.spoken_reply.chars().count() <= MAX_REPLY_CHARS + 1);
        assert!(turn.spoken_reply.ends_with('.'));
    }

    #[test]
    fn empty_or_markup_only_text_is_invalid_output() {
        for raw in ["", "  \n ", "**", "- "] {
            assert_eq!(
                plain_turn(raw).unwrap_err().code,
                ProviderErrorCode::InvalidOutput
            );
        }
    }

    #[test]
    fn decimals_and_abbreviation_dots_do_not_split_sentences() {
        let turn = plain_turn("It costs 3.5 dollars. Is that fine?").unwrap();
        assert_eq!(turn.spoken_reply, "It costs 3.5 dollars.");
        assert_eq!(turn.question.as_deref(), Some("Is that fine?"));
    }
}
