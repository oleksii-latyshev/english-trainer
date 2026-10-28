use std::collections::BTreeSet;

pub fn tokens(text: &str) -> Vec<String> {
    text.split_whitespace()
        .map(normalize_word)
        .filter(|word| !word.is_empty())
        .collect()
}

fn normalize_word(word: &str) -> String {
    word.chars()
        .map(|ch| if ch == '\u{2019}' { '\'' } else { ch })
        .filter(|ch| ch.is_alphanumeric() || *ch == '\'')
        .collect::<String>()
        .trim_matches('\'')
        .to_lowercase()
}

pub fn same_words(left: &str, right: &str) -> bool {
    tokens(left) == tokens(right)
}

pub fn contains_wording(text: &str, wording: &str) -> bool {
    let wanted = tokens(wording);
    if wanted.is_empty() {
        return false;
    }
    tokens(text)
        .windows(wanted.len())
        .any(|window| window == wanted.as_slice())
}

pub fn sentence_words(text: &str) -> Vec<String> {
    text.split_whitespace().map(normalize_word).collect()
}

pub fn changed_word_indexes(said: &str, corrected: &str) -> BTreeSet<usize> {
    let before = sentence_words(said);
    let after = sentence_words(corrected);
    let mut lengths = vec![vec![0usize; after.len() + 1]; before.len() + 1];
    for i in (0..before.len()).rev() {
        for j in (0..after.len()).rev() {
            lengths[i][j] = if before[i] == after[j] {
                lengths[i + 1][j + 1] + 1
            } else {
                lengths[i + 1][j].max(lengths[i][j + 1])
            };
        }
    }
    let mut unchanged = BTreeSet::new();
    let (mut i, mut j) = (0, 0);
    while i < before.len() && j < after.len() {
        if before[i] == after[j] {
            unchanged.insert(j);
            i += 1;
            j += 1;
        } else if lengths[i + 1][j] >= lengths[i][j + 1] {
            i += 1;
        } else {
            j += 1;
        }
    }
    (0..after.len())
        .filter(|index| !unchanged.contains(index))
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn words_ignore_case_punctuation_and_curly_apostrophes() {
        assert!(same_words("I don\u{2019}t know.", "i don't  KNOW"));
        assert!(!same_words("I know", "I knew"));
    }

    #[test]
    fn wording_is_found_as_whole_words_in_order() {
        assert!(contains_wording(
            "Yes, I have worked there.",
            "have worked there"
        ));
        assert!(!contains_wording("I have not worked there", "have worked"));
        assert!(!contains_wording("anything", ""));
    }

    #[test]
    fn an_inserted_word_is_the_only_change() {
        let changed = changed_word_indexes("I worked there", "I have worked there");
        assert_eq!(changed.into_iter().collect::<Vec<_>>(), [1]);
    }

    #[test]
    fn a_replaced_word_is_marked_in_the_corrected_sentence() {
        let changed = changed_word_indexes("She go to school", "She goes to school");
        assert_eq!(changed.into_iter().collect::<Vec<_>>(), [1]);
    }

    #[test]
    fn a_pure_deletion_changes_no_corrected_word() {
        assert!(changed_word_indexes("I went to home", "I went home").is_empty());
    }
}
