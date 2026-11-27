use crate::providers::FocusCategory;

pub fn normalize_phrase(text: &str) -> String {
    let mut words = Vec::new();
    for token in text.split(|c: char| !c.is_alphanumeric() && c != '\'') {
        let cleaned = token.trim_matches('\'').to_lowercase();
        if !cleaned.is_empty() {
            words.push(cleaned);
        }
    }
    words.join(" ")
}

/// True when the words of `needle` occur in order, whole, inside `haystack`.
pub fn contains_phrase(haystack: &str, needle: &str) -> bool {
    let needle = normalize_phrase(needle);
    !needle.is_empty()
        && format!(" {} ", normalize_phrase(haystack)).contains(&format!(" {needle} "))
}

pub fn mistake_normalized_key(category: &FocusCategory, corrected: &str) -> String {
    let category_name = match category {
        FocusCategory::Grammar => "grammar",
        FocusCategory::Vocabulary => "vocabulary",
        FocusCategory::Coherence => "coherence",
        FocusCategory::Interaction => "interaction",
    };
    let normalized = normalize_phrase(corrected);
    format!("{category_name}:{normalized}")
}
