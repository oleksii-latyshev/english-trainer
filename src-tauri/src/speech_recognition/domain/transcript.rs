use serde::Serialize;
use ts_rs::TS;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, TS)]
#[ts(export)]
pub struct Transcript {
    pub text: String,
    pub language: String,
    pub duration_ms: u64,
}

impl Transcript {
    pub fn english(text: String, duration_ms: u64) -> Self {
        Self {
            text,
            language: "en".into(),
            duration_ms,
        }
    }
}

pub fn without_annotations(text: &str) -> String {
    let mut kept = String::with_capacity(text.len());
    let mut closing = None;
    for character in text.chars() {
        match (closing, character) {
            (None, '[') => closing = Some(']'),
            (None, '(') => closing = Some(')'),
            (Some(end), _) if character == end => closing = None,
            (Some(_), _) => {}
            (None, _) => kept.push(character),
        }
    }
    kept.split_whitespace().collect::<Vec<_>>().join(" ")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn non_speech_annotations_are_dropped() {
        assert_eq!(
            without_annotations(" [BLANK_AUDIO] I deploy with Docker. (coughs)"),
            "I deploy with Docker."
        );
        assert_eq!(without_annotations(" [ Silence ] (music)"), "");
    }

    #[test]
    fn english_transcripts_carry_the_duration() {
        assert_eq!(
            Transcript::english("Hello".into(), 123),
            Transcript {
                text: "Hello".into(),
                language: "en".into(),
                duration_ms: 123
            }
        );
    }
}
