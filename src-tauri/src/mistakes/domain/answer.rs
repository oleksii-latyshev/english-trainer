use crate::learning::recall::wording_observed;

const CONTRACTIONS: [(&str, &str); 9] = [
    ("won't", "will not"),
    ("can't", "can not"),
    ("cannot", "can not"),
    ("shan't", "shall not"),
    ("ain't", "is not"),
    ("let's", "let us"),
    ("gonna", "going to"),
    ("wanna", "want to"),
    ("gotta", "got to"),
];

const SUFFIXES: [(&str, &str); 5] = [
    ("n't", " not"),
    ("'re", " are"),
    ("'ve", " have"),
    ("'ll", " will"),
    ("'m", " am"),
];

fn expand_word(word: &str) -> String {
    if let Some((_, full)) = CONTRACTIONS.iter().find(|(short, _)| *short == word) {
        return (*full).to_string();
    }
    for (suffix, full) in SUFFIXES.iter() {
        if let Some(stem) = word.strip_suffix(suffix) {
            if !stem.is_empty() {
                return format!("{stem}{full}");
            }
        }
    }
    word.to_string()
}

pub fn normalize(text: &str) -> String {
    let lowered: String = text
        .chars()
        .map(|ch| match ch {
            '\u{2019}' | '\u{2018}' | '`' => '\'',
            '-' | '\u{2013}' | '\u{2014}' => ' ',
            other => other,
        })
        .flat_map(char::to_lowercase)
        .collect();
    let words: Vec<String> = lowered
        .split_whitespace()
        .map(|word| {
            word.chars()
                .filter(|ch| ch.is_alphanumeric() || *ch == '\'')
                .collect::<String>()
        })
        .map(|word| word.trim_matches('\'').to_string())
        .filter(|word| !word.is_empty())
        .map(|word| expand_word(&word))
        .collect();
    words
        .join(" ")
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

pub fn same_sentence(left: &str, right: &str) -> bool {
    let left = normalize(left);
    !left.is_empty() && left == normalize(right)
}

pub fn said_in_order(corrected: &str, spoken: &str) -> bool {
    wording_observed(&normalize(corrected), &normalize(spoken))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn case_punctuation_and_spacing_do_not_matter() {
        assert_eq!(
            normalize("  I   HAVE worked, there! "),
            "i have worked there"
        );
        assert_eq!(normalize("Well-known..."), "well known");
    }

    #[test]
    fn common_contractions_are_expanded_on_both_sides() {
        assert!(same_sentence("I don't know", "I do not know"));
        assert!(same_sentence("I don\u{2019}t know", "i do not know."));
        assert!(same_sentence("We've finished", "We have finished"));
        assert!(same_sentence("They're late", "They are late"));
        assert!(same_sentence("I'll go", "I will go"));
        assert!(same_sentence("I'm here", "I am here"));
        assert!(same_sentence("I can't go", "I cannot go"));
        assert!(same_sentence("I won't go", "I will not go"));
        assert!(same_sentence("Let's go", "Let us go"));
    }

    #[test]
    fn different_words_are_different_sentences() {
        assert!(!same_sentence("I have worked there", "I worked there"));
        assert!(!same_sentence("It's mine", "Its mine"));
        assert!(!same_sentence("", ""));
    }

    #[test]
    fn spoken_wording_must_come_in_order_as_whole_words() {
        assert!(said_in_order(
            "I have worked there.",
            "well, I have worked there for years"
        ));
        assert!(said_in_order("I don't know.", "I do not know"));
        assert!(!said_in_order(
            "I have worked there.",
            "there I have worked"
        ));
        assert!(!said_in_order("I have worked there.", "I worked there"));
    }
}
