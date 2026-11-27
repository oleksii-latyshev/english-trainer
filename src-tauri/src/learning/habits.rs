//! The learner's plain everyday words that come back conversation after conversation, counted
//! locally from saved answers. Pure rules: no AI, no storage.

use super::normalization::normalize_phrase;
use serde::Serialize;
use std::collections::{BTreeMap, HashSet};

/// Sessions read for the trend: the most recent ones that were long enough.
pub const TREND_SESSIONS: usize = 5;
/// A session with fewer learner words says too little about how the learner usually speaks.
pub const MIN_SESSION_WORDS: usize = 50;
/// A word outside the fixed list is a habit from this rate per 100 words across the window.
pub const BASELINE_RATE: f64 = 2.0;
/// A fixed-list word below this mean rate per 100 words is not worth mentioning.
pub const MIN_LISTED_RATE: f64 = 1.0;
pub const MAX_HABITS: usize = 3;
/// A habit has to show up in this many of the sessions read.
pub const MIN_HABIT_SESSIONS: usize = 2;
/// A trend needs this many qualifying sessions.
pub const MIN_TREND_SESSIONS: usize = 2;
const MIN_WORD_LETTERS: usize = 3;

/// The plain words watched for in every learner, each with the forms counted as the same word.
const PLAIN_WORDS: &[(&str, &[&str])] = &[
    ("very", &["very"]),
    ("really", &["really"]),
    ("thing", &["thing", "things"]),
    ("stuff", &["stuff"]),
    ("good", &["good"]),
    ("bad", &["bad"]),
    ("big", &["big"]),
    ("nice", &["nice"]),
    ("a lot", &["a lot", "lots of"]),
    ("get", &["get", "got"]),
    ("do", &["do", "did", "does"]),
    ("make", &["make", "made"]),
    ("like", &["like"]),
    ("basically", &["basically"]),
    ("actually", &["actually"]),
    ("just", &["just"]),
    ("so", &["so"]),
];

/// Words too common in any English to say anything about one learner.
const STOPWORDS: &[&str] = &[
    "the", "and", "but", "for", "nor", "yet", "not", "you", "your", "she", "her", "him", "his",
    "they", "them", "their", "our", "ours", "its", "this", "that", "these", "those", "there",
    "here", "then", "than", "with", "from", "into", "onto", "about", "what", "when", "where",
    "which", "who", "whom", "why", "how", "because", "are", "was", "were", "been", "being", "have",
    "has", "had", "having", "can", "could", "will", "would", "should", "shall", "may", "might",
    "must", "yes", "all", "any", "some", "one", "too", "also", "out", "off", "over", "now", "i'm",
    "i've", "i'll", "i'd", "it's", "that's", "there's", "don't", "doesn't", "didn't", "can't",
    "won't", "isn't", "wasn't", "you're", "we're", "they're", "he's", "she's", "let's", "um", "uh",
    "yeah", "okay", "well", "mean", "know", "think", "going", "want", "say", "said", "work",
    "time", "people", "more", "most", "many", "much", "other", "such", "only", "even", "still",
    "again", "ever", "never", "always", "maybe", "every", "each", "both", "same", "own", "back",
    "down", "after", "before", "while", "during", "between", "through", "under", "again",
];

/// One plain word and how often per 100 words the learner said it in the earliest and the latest
/// of the sessions read.
#[derive(Debug, Clone, PartialEq, Serialize, ts_rs::TS)]
#[ts(export)]
pub struct Habit {
    pub word: String,
    pub from_rate: f64,
    pub to_rate: f64,
    #[serde(skip)]
    #[ts(skip)]
    pub forms: Vec<String>,
}

impl Habit {
    /// True when the text says the habit word in any of its forms.
    pub fn is_in(&self, text: &str) -> bool {
        self.forms
            .iter()
            .any(|form| super::normalization::contains_phrase(text, form))
    }
}

struct SessionTokens {
    tokens: Vec<String>,
}

impl SessionTokens {
    fn new(text: &str) -> Self {
        let tokens = normalize_phrase(&text.replace('\u{2019}', "'"))
            .split(' ')
            .filter(|token| !token.is_empty())
            .map(str::to_string)
            .collect();
        Self { tokens }
    }

    fn words(&self) -> usize {
        self.tokens.len()
    }

    fn occurrences(&self, form: &str) -> usize {
        let needle: Vec<&str> = form.split(' ').collect();
        self.tokens
            .windows(needle.len())
            .filter(|window| window.iter().zip(&needle).all(|(a, b)| a == b))
            .count()
    }

    fn count_of(&self, forms: &[String]) -> usize {
        forms.iter().map(|form| self.occurrences(form)).sum()
    }
}

fn rate(count: usize, words: usize) -> f64 {
    count as f64 * 100.0 / words as f64
}

fn one_decimal(value: f64) -> f64 {
    (value * 10.0).round() / 10.0
}

fn is_listed(token: &str) -> bool {
    PLAIN_WORDS.iter().any(|(_, forms)| {
        forms
            .iter()
            .any(|form| form.split(' ').any(|part| part == token))
    })
}

fn is_candidate(token: &str) -> bool {
    token.chars().filter(|c| c.is_alphabetic()).count() >= MIN_WORD_LETTERS
        && !token.chars().any(|c| c.is_ascii_digit())
        && !STOPWORDS.contains(&token)
        && !is_listed(token)
}

/// The words to watch in these sessions: the fixed list plus any other word said at
/// `BASELINE_RATE` or more per 100 words over all of them. Each is its label and its forms.
fn candidates(window: &[SessionTokens]) -> Vec<(String, Vec<String>)> {
    let mut watched: Vec<(String, Vec<String>)> = PLAIN_WORDS
        .iter()
        .map(|(label, forms)| {
            (
                (*label).to_string(),
                forms.iter().map(|form| (*form).to_string()).collect(),
            )
        })
        .collect();
    let total: usize = window.iter().map(SessionTokens::words).sum();
    let mut counts: BTreeMap<&str, usize> = BTreeMap::new();
    for token in window.iter().flat_map(|session| &session.tokens) {
        if is_candidate(token) {
            *counts.entry(token).or_default() += 1;
        }
    }
    for (token, count) in counts {
        if rate(count, total) >= BASELINE_RATE {
            watched.push((token.to_string(), vec![token.to_string()]));
        }
    }
    watched
}

/// Up to `MAX_HABITS` words with the highest mean rate per 100 words over the last
/// `TREND_SESSIONS` sessions of at least `MIN_SESSION_WORDS` words, said in at least
/// `MIN_HABIT_SESSIONS` of them. `sessions` holds each session's learner answers joined, oldest
/// first. Empty when fewer than `MIN_TREND_SESSIONS` sessions qualify.
pub fn top_habits(sessions: &[String]) -> Vec<Habit> {
    let all: Vec<SessionTokens> = sessions
        .iter()
        .map(|text| SessionTokens::new(text))
        .filter(|session| session.words() >= MIN_SESSION_WORDS)
        .collect();
    let window = &all[all.len().saturating_sub(TREND_SESSIONS)..];
    if window.len() < MIN_TREND_SESSIONS {
        return Vec::new();
    }
    let mut habits: Vec<(f64, Habit)> = candidates(window)
        .into_iter()
        .filter_map(|(word, forms)| {
            let rates: Vec<f64> = window
                .iter()
                .map(|session| rate(session.count_of(&forms), session.words()))
                .collect();
            let present = rates.iter().filter(|rate| **rate > 0.0).count();
            let mean = rates.iter().sum::<f64>() / rates.len() as f64;
            let floor = if is_listed(&forms[0]) {
                MIN_LISTED_RATE
            } else {
                BASELINE_RATE
            };
            (present >= MIN_HABIT_SESSIONS && mean >= floor).then(|| {
                (
                    mean,
                    Habit {
                        word,
                        from_rate: one_decimal(rates[0]),
                        to_rate: one_decimal(rates[rates.len() - 1]),
                        forms,
                    },
                )
            })
        })
        .collect();
    habits.sort_by(|a, b| b.0.total_cmp(&a.0).then_with(|| a.1.word.cmp(&b.1.word)));
    let mut seen = HashSet::new();
    habits
        .into_iter()
        .map(|(_, habit)| habit)
        .filter(|habit| seen.insert(habit.word.clone()))
        .take(MAX_HABITS)
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A session of exactly `total` words: `said` repeated, the rest neutral filler words.
    fn session(said: &[(&str, usize)], total: usize) -> String {
        let mut words: Vec<String> = said
            .iter()
            .flat_map(|(word, times)| std::iter::repeat_n((*word).to_string(), *times))
            .collect();
        let mut index = 0;
        while words.len() < total {
            words.push(format!("w{}", index % 5));
            index += 1;
        }
        words.truncate(total);
        words.join(" ")
    }

    fn words(habits: &[Habit]) -> Vec<&str> {
        habits.iter().map(|habit| habit.word.as_str()).collect()
    }

    #[test]
    fn a_listed_word_is_counted_per_hundred_words_in_the_first_and_the_latest_session() {
        let sessions = [
            session(&[("very", 4)], 100),
            session(&[("very", 3)], 100),
            session(&[("very", 1)], 100),
        ];

        let habits = top_habits(&sessions);

        assert_eq!(words(&habits), ["very"]);
        assert_eq!(habits[0].from_rate, 4.0);
        assert_eq!(habits[0].to_rate, 1.0);
    }

    #[test]
    fn the_rate_is_rounded_to_one_decimal() {
        let sessions = [session(&[("very", 1)], 60), session(&[("very", 1)], 70)];

        let habits = top_habits(&sessions);

        assert_eq!(habits[0].from_rate, 1.7);
        assert_eq!(habits[0].to_rate, 1.4);
    }

    #[test]
    fn case_punctuation_and_curly_apostrophes_do_not_hide_a_word() {
        let loud = format!("Very, VERY good! {}", session(&[], 47));
        let sessions = [loud.clone(), loud];

        let habits = top_habits(&sessions);

        assert_eq!(words(&habits), ["very", "good"]);
        assert_eq!(habits[0].from_rate, 4.0);
        let contraction = "Don\u{2019}t".to_string();
        assert_eq!(SessionTokens::new(&contraction).tokens, ["don't"]);
    }

    #[test]
    fn forms_of_one_word_count_together() {
        let sessions = [
            session(&[("get", 2), ("got", 2)], 100),
            session(&[("get", 2), ("got", 2)], 100),
        ];

        let habits = top_habits(&sessions);

        assert_eq!(words(&habits), ["get"]);
        assert_eq!(habits[0].from_rate, 4.0);
        assert!(habits[0].is_in("I got a car"));
    }

    #[test]
    fn a_phrase_is_counted_as_a_whole() {
        let text = format!("a lot of work and lots of it {}", session(&[], 42));
        let sessions = [text.clone(), text];

        let habits = top_habits(&sessions);

        assert_eq!(words(&habits), ["a lot"]);
        assert_eq!(habits[0].from_rate, 4.0);
    }

    #[test]
    fn short_sessions_are_ignored() {
        let sessions = [
            session(&[("very", 9)], 49),
            session(&[("very", 3)], 100),
            session(&[("very", 3)], 100),
        ];

        let habits = top_habits(&sessions);

        assert_eq!(habits[0].from_rate, 3.0);
    }

    #[test]
    fn one_qualifying_session_gives_no_trend() {
        let sessions = [session(&[("very", 5)], 100), session(&[("very", 5)], 30)];

        assert!(top_habits(&sessions).is_empty());
    }

    #[test]
    fn a_word_in_a_single_session_is_not_a_habit() {
        let sessions = [session(&[("very", 9)], 100), session(&[], 100)];

        assert!(top_habits(&sessions).is_empty());
    }

    #[test]
    fn only_the_last_five_sessions_are_read() {
        let mut sessions = vec![session(&[("very", 9)], 100)];
        sessions.extend((0..5).map(|_| session(&[("bad", 2)], 100)));

        let habits = top_habits(&sessions);

        assert_eq!(words(&habits), ["bad"]);
    }

    #[test]
    fn a_word_outside_the_list_needs_two_per_hundred_words_across_the_window() {
        let above = [
            session(&[("coffee", 2)], 100),
            session(&[("coffee", 2)], 100),
        ];
        let below = [
            session(&[("coffee", 2)], 100),
            session(&[("coffee", 1)], 100),
        ];

        assert_eq!(words(&top_habits(&above)), ["coffee"]);
        assert!(top_habits(&below).is_empty());
    }

    #[test]
    fn stopwords_and_short_words_are_never_habits() {
        let sessions = [
            session(&[("the", 10), ("and", 8), ("it", 8)], 100),
            session(&[("the", 10), ("and", 8), ("it", 8)], 100),
        ];

        assert!(top_habits(&sessions).is_empty());
    }

    #[test]
    fn a_listed_word_below_one_per_hundred_is_left_out() {
        let sessions = [session(&[("big", 1)], 150), session(&[("big", 1)], 150)];

        assert!(top_habits(&sessions).is_empty());
    }

    #[test]
    fn at_most_three_habits_the_most_frequent_first() {
        let said = [("very", 5), ("really", 4), ("stuff", 3), ("nice", 2)];
        let sessions = [session(&said, 100), session(&said, 100)];

        let habits = top_habits(&sessions);

        assert_eq!(words(&habits), ["very", "really", "stuff"]);
    }

    #[test]
    fn a_word_missing_from_the_latest_session_shows_a_rate_of_zero() {
        let sessions = [
            session(&[("very", 4)], 100),
            session(&[("very", 4)], 100),
            session(&[], 100),
        ];

        let habits = top_habits(&sessions);

        assert_eq!(habits[0].to_rate, 0.0);
    }
}
