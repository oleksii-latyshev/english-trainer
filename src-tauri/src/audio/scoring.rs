//! Scores a transcript against the sentence the learner read. Everything here is pure.

const NUMBER_WORDS: [&str; 11] = [
    "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
];

/// Lower-case words without punctuation. Small number words become digits so "CS two" and "CS2"
/// (and "three" and "3") compare equal on both sides.
pub fn normalize_words(text: &str) -> Vec<String> {
    let cleaned: String = text
        .chars()
        .map(|c| match c {
            '\u{2019}' | '\u{2018}' => '\'',
            c if c.is_alphanumeric() || c == '\'' => c,
            _ => ' ',
        })
        .collect();
    cleaned
        .to_lowercase()
        .split_whitespace()
        .map(|word| word.trim_matches('\'').to_string())
        .filter(|word| !word.is_empty())
        .map(
            |word| match NUMBER_WORDS.iter().position(|number| *number == word) {
                Some(digit) => digit.to_string(),
                None => word,
            },
        )
        .collect()
}

/// Word-level edit distance (substitutions, insertions and deletions each count one).
pub fn word_errors(reference: &[String], hypothesis: &[String]) -> usize {
    let mut previous: Vec<usize> = (0..=hypothesis.len()).collect();
    for (row, reference_word) in reference.iter().enumerate() {
        let mut current = vec![row + 1];
        for (column, hypothesis_word) in hypothesis.iter().enumerate() {
            let substitution = previous[column] + usize::from(reference_word != hypothesis_word);
            current.push(
                substitution
                    .min(previous[column + 1] + 1)
                    .min(current[column] + 1),
            );
        }
        previous = current;
    }
    previous[hypothesis.len()]
}

/// Errors per reference word; 0 for an empty reference with nothing wrong, never NaN.
pub fn word_error_rate(errors: usize, reference_words: usize) -> f64 {
    if reference_words == 0 {
        return if errors == 0 { 0.0 } else { 1.0 };
    }
    errors as f64 / reference_words as f64
}

/// Whole words only. A term also matches when the transcript splits or joins it ("CS 2",
/// "Face It"): the window concatenation is compared, never a part of a word.
fn contains_term(words: &[String], term: &[String]) -> bool {
    let wanted = term.concat();
    if wanted.is_empty() {
        return false;
    }
    (1..=term.len() + 1)
        .filter(|length| *length <= words.len())
        .any(|length| {
            words
                .windows(length)
                .any(|window| window.concat() == wanted)
        })
}

/// `(found, total)`: how many glossary terms the reference contains, and how many of those the
/// transcript has too. Each term counts once per sentence.
pub fn term_score(reference: &[String], transcript: &[String], terms: &[String]) -> (u32, u32) {
    let mut found = 0;
    let mut total = 0;
    for term in terms {
        let words = normalize_words(term);
        if !contains_term(reference, &words) {
            continue;
        }
        total += 1;
        if contains_term(transcript, &words) {
            found += 1;
        }
    }
    (found, total)
}

pub fn median(values: &[u64]) -> u64 {
    if values.is_empty() {
        return 0;
    }
    let mut sorted = values.to_vec();
    sorted.sort_unstable();
    let middle = sorted.len() / 2;
    if sorted.len() % 2 == 1 {
        sorted[middle]
    } else {
        (sorted[middle - 1] + sorted[middle]) / 2
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn words(text: &str) -> Vec<String> {
        normalize_words(text)
    }

    fn terms(values: &[&str]) -> Vec<String> {
        values.iter().map(|value| value.to_string()).collect()
    }

    #[test]
    fn normalizing_drops_case_punctuation_and_spells_numbers_as_digits() {
        assert_eq!(
            words("After THREE months, I don\u{2019}t know."),
            ["after", "3", "months", "i", "don't", "know"]
        );
        assert_eq!(words("CS-2"), ["cs", "2"]);
    }

    #[test]
    fn word_error_rate_counts_substitutions_insertions_and_deletions() {
        let reference = words("the cat sat on the mat");
        assert_eq!(word_errors(&reference, &reference), 0);
        assert_eq!(word_errors(&reference, &words("the cat sat on mat")), 1);
        assert_eq!(
            word_errors(&reference, &words("the dog sat on the big mat")),
            2
        );
        assert_eq!(word_errors(&reference, &[]), 6);
        assert_eq!(word_errors(&[], &words("hello")), 1);
        assert!((word_error_rate(1, 4) - 0.25).abs() < f64::EPSILON);
        assert_eq!(word_error_rate(0, 0), 0.0);
        assert_eq!(word_error_rate(2, 0), 1.0);
    }

    #[test]
    fn terms_are_found_as_whole_words_ignoring_case() {
        let reference = words("I tried the Gemini API yesterday.");
        let list = terms(&["Gemini", "calendar"]);
        assert_eq!(
            term_score(&reference, &words("i tried the gemini api"), &list),
            (1, 1)
        );
        assert_eq!(
            term_score(&reference, &words("I tried the Jimini IP"), &list),
            (0, 1)
        );
        assert_eq!(
            term_score(
                &words("The calendar"),
                &words("The calendars"),
                &terms(&["calendar"])
            ),
            (0, 1)
        );
    }

    #[test]
    fn terms_tolerate_spacing_and_number_words() {
        let list = terms(&["CS2", "FaceIt", "Claude Code"]);
        let reference = words("I play CS2 on FaceIt with Claude Code");
        assert_eq!(
            term_score(
                &reference,
                &words("I play CS 2 on Face It with Claude Code"),
                &list
            ),
            (3, 3)
        );
        assert_eq!(
            term_score(
                &reference,
                &words("I play CS two on FaceIt with Claude"),
                &list
            ),
            (2, 3)
        );
    }

    #[test]
    fn terms_missing_from_the_reference_do_not_count() {
        let list = terms(&["Kubernetes", "Rust"]);
        assert_eq!(
            term_score(&words("We use Rust"), &words("We use rust"), &list),
            (1, 1)
        );
        assert_eq!(term_score(&words("Hello"), &words("Hello"), &list), (0, 0));
    }

    #[test]
    fn median_takes_the_middle_or_averages_the_two() {
        assert_eq!(median(&[]), 0);
        assert_eq!(median(&[5]), 5);
        assert_eq!(median(&[9, 1, 5]), 5);
        assert_eq!(median(&[4, 10, 2, 8]), 6);
    }
}
