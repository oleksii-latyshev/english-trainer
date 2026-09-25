use crate::providers::FocusCategory;

/// Normalizes text by lowercasing and standardizing whitespace and punctuation.
/// Preserves internal word apostrophes for contractions (e.g., "don't").
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

/// Computes a deterministic deduplication key for a mistake record
/// combining its focus category and normalized corrected wording.
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
