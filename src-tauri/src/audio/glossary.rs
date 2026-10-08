/// What the learner's glossary starts with; seeded once when the table is created.
pub const SEED_GLOSSARY: [&str; 27] = [
    "Gemini",
    "Claude Code",
    "Tauri",
    "Rust",
    "TypeScript",
    "React",
    "Angular",
    "Vue",
    "calendar",
    "headless",
    "npm",
    "markdown",
    "Kharkiv",
    "Ukraine",
    "CS2",
    "Mirage",
    "FaceIt",
    "Valorant",
    "Whisper",
    "Antigravity",
    "Twitch",
    "YouTube",
    "OBS",
    "Minecraft",
    "Enshrouded",
    "Kubernetes",
    "idempotent",
];

pub const MAX_GLOSSARY_TERMS: usize = 200;
pub const MAX_TERM_CHARS: usize = 40;
/// Whisper reads at most half its context (224 tokens) of prompt; this stays well inside it.
const PROMPT_MAX_CHARS: usize = 500;

#[derive(Debug, PartialEq, Eq)]
pub enum GlossaryError {
    TooManyTerms,
    TermTooLong(String),
}

impl GlossaryError {
    pub fn message(&self) -> String {
        match self {
            Self::TooManyTerms => format!(
                "The glossary can hold {MAX_GLOSSARY_TERMS} words. Remove some, then save again."
            ),
            Self::TermTooLong(term) => format!(
                "\"{term}\" is longer than {MAX_TERM_CHARS} characters. Shorten it, then save again."
            ),
        }
    }
}

/// Trims and collapses whitespace, drops empty entries and repeats (ignoring case, first wins).
pub fn normalize_terms(raw: &[String]) -> Result<Vec<String>, GlossaryError> {
    let mut terms: Vec<String> = Vec::new();
    for entry in raw {
        let term = entry
            .chars()
            .map(|c| if c.is_control() { ' ' } else { c })
            .collect::<String>()
            .split_whitespace()
            .collect::<Vec<_>>()
            .join(" ");
        if term.is_empty() {
            continue;
        }
        if term.chars().count() > MAX_TERM_CHARS {
            return Err(GlossaryError::TermTooLong(term));
        }
        if terms
            .iter()
            .any(|kept| kept.to_lowercase() == term.to_lowercase())
        {
            continue;
        }
        terms.push(term);
    }
    if terms.len() > MAX_GLOSSARY_TERMS {
        return Err(GlossaryError::TooManyTerms);
    }
    Ok(terms)
}

/// The initial prompt that tells Whisper which words to expect; empty when there are no terms.
pub fn prompt_from_terms(terms: &[String]) -> Option<String> {
    let mut prompt = String::from("Vocabulary:");
    let mut count = 0;
    for term in terms {
        let extra = term.chars().count() + 2;
        if prompt.chars().count() + extra > PROMPT_MAX_CHARS {
            break;
        }
        prompt.push_str(if count == 0 { " " } else { ", " });
        prompt.push_str(term);
        count += 1;
    }
    (count > 0).then(|| prompt + ".")
}

#[cfg(test)]
mod tests {
    use super::*;

    fn owned(values: &[&str]) -> Vec<String> {
        values.iter().map(|value| value.to_string()).collect()
    }

    #[test]
    fn normalizing_trims_collapses_and_removes_repeats_ignoring_case() {
        let terms = normalize_terms(&owned(&[
            "  Claude   Code ",
            "",
            "claude code",
            "Tauri\n",
            "CS2",
        ]));
        assert_eq!(terms.unwrap(), ["Claude Code", "Tauri", "CS2"]);
    }

    #[test]
    fn normalizing_rejects_oversized_terms_and_lists() {
        let long = "x".repeat(MAX_TERM_CHARS + 1);
        assert_eq!(
            normalize_terms(std::slice::from_ref(&long)),
            Err(GlossaryError::TermTooLong(long))
        );
        let many: Vec<String> = (0..=MAX_GLOSSARY_TERMS)
            .map(|n| format!("term{n}"))
            .collect();
        assert_eq!(normalize_terms(&many), Err(GlossaryError::TooManyTerms));
    }

    #[test]
    fn the_seed_is_already_normalized() {
        let seed: Vec<String> = SEED_GLOSSARY.iter().map(|term| term.to_string()).collect();
        assert_eq!(normalize_terms(&seed).unwrap(), seed);
    }

    #[test]
    fn prompt_lists_terms_and_stays_bounded() {
        assert_eq!(prompt_from_terms(&[]), None);
        assert_eq!(
            prompt_from_terms(&owned(&["Gemini", "Claude Code"])).as_deref(),
            Some("Vocabulary: Gemini, Claude Code.")
        );
        let many: Vec<String> = (0..200).map(|n| format!("word{n}")).collect();
        let prompt = prompt_from_terms(&many).unwrap();
        assert!(prompt.chars().count() <= PROMPT_MAX_CHARS + 1);
        assert!(prompt.starts_with("Vocabulary: word0, word1"));
    }
}
