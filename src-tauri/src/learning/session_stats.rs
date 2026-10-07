//! Local fluency numbers for the session wrap-up: speaking time, words per minute and average
//! answer length, each with a personal trend against the last earlier session that has the data.
//! They are trends for the learner to see, never a level or a score.

use serde::Serialize;

/// A change smaller than this share of the earlier value reads as "about the same".
const SAME_BAND_PERCENT: f64 = 5.0;
const MS_PER_MINUTE: f64 = 60_000.0;

/// One stored answer as the statistics see it.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AnswerSample {
    pub transcript: String,
    /// How long the learner spoke; absent for typed answers and for answers stored before it was kept.
    pub duration_ms: Option<u64>,
    pub is_typed: bool,
}

/// Raw totals for one session; the three numbers derive from these.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub struct SessionStats {
    speaking_ms: u64,
    spoken_words: u64,
    answer_count: u64,
    answer_words: u64,
}

/// Words are whitespace-separated pieces that contain a letter or a digit.
pub fn count_words(text: &str) -> u64 {
    text.split_whitespace()
        .filter(|piece| piece.chars().any(char::is_alphanumeric))
        .count() as u64
}

impl SessionStats {
    pub fn from_answers(answers: &[AnswerSample]) -> Self {
        let mut stats = Self::default();
        for answer in answers {
            let words = count_words(&answer.transcript);
            stats.answer_count += 1;
            stats.answer_words += words;
            // Only answers with a recorded duration count towards speed, so a typed or older
            // answer never inflates words per minute.
            if let (false, Some(duration_ms)) = (answer.is_typed, answer.duration_ms) {
                stats.speaking_ms += duration_ms;
                stats.spoken_words += words;
            }
        }
        stats
    }

    fn speaking_ms(&self) -> Option<u64> {
        (self.speaking_ms > 0).then_some(self.speaking_ms)
    }

    fn words_per_minute(&self) -> Option<f64> {
        self.speaking_ms()
            .map(|ms| self.spoken_words as f64 / (ms as f64 / MS_PER_MINUTE))
    }

    fn average_answer_words(&self) -> Option<f64> {
        (self.answer_count > 0).then(|| self.answer_words as f64 / self.answer_count as f64)
    }
}

/// How a number moved against the last earlier session that has it.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum Trend {
    /// No earlier session has this measure (or this session has no value for it).
    First,
    Same,
    /// Signed whole-percent change.
    Percent {
        change: i64,
    },
    /// Signed change in words.
    Words {
        change: i64,
    },
}

fn relative_change_percent(current: f64, previous: f64) -> f64 {
    (current - previous) / previous * 100.0
}

fn percent_trend(current: f64, previous: Option<f64>) -> Trend {
    let Some(previous) = previous.filter(|value| *value > 0.0) else {
        return Trend::First;
    };
    let change = relative_change_percent(current, previous);
    if change.abs() <= SAME_BAND_PERCENT || change.round() == 0.0 {
        return Trend::Same;
    }
    Trend::Percent {
        change: change.round() as i64,
    }
}

fn words_trend(current: f64, previous: Option<f64>) -> Trend {
    let Some(previous) = previous.filter(|value| *value > 0.0) else {
        return Trend::First;
    };
    let change = (current - previous).round();
    if relative_change_percent(current, previous).abs() <= SAME_BAND_PERCENT || change == 0.0 {
        return Trend::Same;
    }
    Trend::Words {
        change: change as i64,
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
pub struct SpeakingTime {
    pub duration_ms: Option<u64>,
    pub trend: Trend,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
pub struct WordsPerMinute {
    pub value: Option<u32>,
    pub trend: Trend,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
pub struct AverageAnswer {
    pub words: Option<u32>,
    pub trend: Trend,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
pub struct SessionNumbers {
    pub speaking_time: SpeakingTime,
    pub words_per_minute: WordsPerMinute,
    pub average_answer: AverageAnswer,
}

/// `earlier` holds the finished sessions before this one, newest first.
pub fn session_numbers(current: &SessionStats, earlier: &[SessionStats]) -> SessionNumbers {
    let previous_speaking = earlier.iter().find_map(|stats| stats.speaking_ms());
    let previous_pace = earlier.iter().find_map(|stats| stats.words_per_minute());
    let previous_average = earlier
        .iter()
        .find_map(|stats| stats.average_answer_words());

    SessionNumbers {
        speaking_time: SpeakingTime {
            duration_ms: current.speaking_ms(),
            trend: current.speaking_ms().map_or(Trend::First, |ms| {
                percent_trend(ms as f64, previous_speaking.map(|value| value as f64))
            }),
        },
        words_per_minute: WordsPerMinute {
            value: current.words_per_minute().map(|value| value.round() as u32),
            trend: current
                .words_per_minute()
                .map_or(Trend::First, |value| percent_trend(value, previous_pace)),
        },
        average_answer: AverageAnswer {
            words: current
                .average_answer_words()
                .map(|value| value.round() as u32),
            trend: current
                .average_answer_words()
                .map_or(Trend::First, |value| words_trend(value, previous_average)),
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn spoken(text: &str, duration_ms: u64) -> AnswerSample {
        AnswerSample {
            transcript: text.into(),
            duration_ms: Some(duration_ms),
            is_typed: false,
        }
    }

    fn typed(text: &str) -> AnswerSample {
        AnswerSample {
            transcript: text.into(),
            duration_ms: None,
            is_typed: true,
        }
    }

    #[test]
    fn counts_words_and_ignores_stray_punctuation() {
        assert_eq!(count_words("  I've been   working — on it, 2 weeks. "), 7);
        assert_eq!(count_words("... - ,"), 0);
        assert_eq!(count_words(""), 0);
    }

    #[test]
    fn speed_uses_only_answers_with_a_spoken_duration() {
        let stats = SessionStats::from_answers(&[
            spoken("one two three four five six", 30_000),
            typed("seven eight nine ten"),
            AnswerSample {
                transcript: "older answer with no duration".into(),
                duration_ms: None,
                is_typed: false,
            },
        ]);
        let numbers = session_numbers(&stats, &[]);
        assert_eq!(numbers.speaking_time.duration_ms, Some(30_000));
        assert_eq!(numbers.words_per_minute.value, Some(12));
        // Every answer counts towards length: (6 + 4 + 5) / 3.
        assert_eq!(numbers.average_answer.words, Some(5));
    }

    #[test]
    fn typed_only_session_has_no_speaking_numbers_but_has_an_average() {
        let stats = SessionStats::from_answers(&[typed("a b c"), typed("d e")]);
        let numbers = session_numbers(&stats, &[]);
        assert_eq!(numbers.speaking_time.duration_ms, None);
        assert_eq!(numbers.words_per_minute.value, None);
        assert_eq!(numbers.average_answer.words, Some(3));
        assert_eq!(numbers.speaking_time.trend, Trend::First);
    }

    #[test]
    fn empty_session_has_no_numbers() {
        let numbers = session_numbers(&SessionStats::from_answers(&[]), &[]);
        assert_eq!(numbers.average_answer.words, None);
        assert_eq!(numbers.average_answer.trend, Trend::First);
    }

    #[test]
    fn first_session_with_a_measure_has_no_trend() {
        let stats = SessionStats::from_answers(&[spoken("one two", 1_000)]);
        let numbers = session_numbers(&stats, &[SessionStats::default()]);
        assert_eq!(numbers.speaking_time.trend, Trend::First);
        assert_eq!(numbers.words_per_minute.trend, Trend::First);
        assert_eq!(numbers.average_answer.trend, Trend::First);
    }

    #[test]
    fn trend_compares_with_the_last_session_that_has_the_data() {
        let earlier_typed = SessionStats::from_answers(&[typed("a b c d")]);
        let earlier_spoken = SessionStats::from_answers(&[spoken(&"word ".repeat(50), 25_000)]);
        let current = SessionStats::from_answers(&[spoken(&"word ".repeat(56), 28_000)]);
        let numbers = session_numbers(&current, &[earlier_typed, earlier_spoken]);
        // Speaking time 25 s -> 28 s is +12%, skipping the typed-only session between.
        assert_eq!(numbers.speaking_time.trend, Trend::Percent { change: 12 });
        // Pace is 120 words per minute in both.
        assert_eq!(numbers.words_per_minute.trend, Trend::Same);
        // Length has data in the typed-only session too, so it is the one compared with: 4 -> 56.
        assert_eq!(numbers.average_answer.trend, Trend::Words { change: 52 });
    }

    #[test]
    fn small_changes_read_as_the_same_and_drops_are_signed() {
        assert_eq!(percent_trend(104.0, Some(100.0)), Trend::Same);
        assert_eq!(percent_trend(105.0, Some(100.0)), Trend::Same);
        assert_eq!(
            percent_trend(106.0, Some(100.0)),
            Trend::Percent { change: 6 }
        );
        assert_eq!(
            percent_trend(80.0, Some(100.0)),
            Trend::Percent { change: -20 }
        );
        assert_eq!(words_trend(27.0, Some(22.0)), Trend::Words { change: 5 });
        assert_eq!(words_trend(20.0, Some(27.0)), Trend::Words { change: -7 });
        assert_eq!(words_trend(27.0, Some(26.0)), Trend::Same);
        assert_eq!(percent_trend(10.0, None), Trend::First);
    }
}
