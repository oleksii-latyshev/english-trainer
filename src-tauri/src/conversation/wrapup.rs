//! What the session wrap-up shows: fluency numbers, phrases worth learning and mistakes that
//! came up more than once, all derived from what the session already stored.

use crate::learning::normalize_phrase;
use crate::learning::session_stats::{session_numbers, SessionNumbers, SessionStats};
use crate::persistence::session_wrapup::ReviewedAnswer;
use crate::persistence::SessionDatabase;
use serde::Serialize;
use std::collections::HashSet;

pub(crate) const MAX_WRAPUP_PHRASES: usize = 3;
pub(crate) const MAX_WRAPUP_MISTAKES: usize = 2;
/// How many earlier sessions are searched for a comparison before giving up.
const COMPARISON_LOOKBACK: usize = 30;
const MAX_PHRASE_CHARS: usize = 300;
const MAX_QUOTE_CHARS: usize = 160;
const STRONGER_PHRASING_NOTE: &str = "Stronger phrasing from conversation feedback";

/// A phrase from the session's coaching that is worth saving to Memory.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct WrapupPhrase {
    /// Sequence of the answer it came from; saving uses it as the phrase's provenance.
    pub sequence: usize,
    pub phrase: String,
    /// What the phrase card keeps as its note.
    pub note: String,
    /// The learner's own words it improves on, shortened for display.
    pub you_said: String,
}

/// A mistake that was observed more than once in the session.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct RecurringMistake {
    pub original: String,
    pub improved: String,
    pub explanation: String,
    pub times: usize,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct Wrapup {
    pub(crate) duration_ms: u64,
    pub(crate) numbers: SessionNumbers,
    pub(crate) phrases: Vec<WrapupPhrase>,
    pub(crate) recurring_mistakes: Vec<RecurringMistake>,
}

fn shortened(text: &str) -> String {
    let text = text.trim();
    if text.chars().count() <= MAX_QUOTE_CHARS {
        return text.to_string();
    }
    let head: String = text.chars().take(MAX_QUOTE_CHARS).collect();
    format!("{}…", head.trim_end())
}

/// Up to three distinct phrases from the reviewed answers: "More natural" rewrites first, then
/// the stronger rewrite of a whole answer, each newest answer first. Phrases already saved in
/// Memory, empty or over-long ones, and rewrites that only repeat the original are skipped.
pub(crate) fn pick_phrases(
    answers: &[ReviewedAnswer],
    saved: &HashSet<String>,
) -> Vec<WrapupPhrase> {
    let focus = answers.iter().rev().flat_map(|answer| {
        answer.feedback.focus_feedback.iter().map(move |item| {
            (
                answer.sequence,
                item.improved.as_str(),
                item.explanation.as_str(),
                item.original.as_str(),
            )
        })
    });
    let rewrites = answers.iter().rev().map(|answer| {
        (
            answer.sequence,
            answer.feedback.b2_rewrite.as_str(),
            STRONGER_PHRASING_NOTE,
            answer.transcript.as_str(),
        )
    });

    let mut seen = HashSet::new();
    let mut picked = Vec::new();
    for (sequence, phrase, note, original) in focus.chain(rewrites) {
        if picked.len() == MAX_WRAPUP_PHRASES {
            break;
        }
        let phrase = phrase.trim();
        let key = normalize_phrase(phrase);
        if key.is_empty()
            || phrase.chars().count() > MAX_PHRASE_CHARS
            || key == normalize_phrase(original)
            || saved.contains(&key)
            || !seen.insert(key)
        {
            continue;
        }
        picked.push(WrapupPhrase {
            sequence,
            phrase: phrase.to_string(),
            note: note.to_string(),
            you_said: shortened(original),
        });
    }
    picked
}

/// Reads only; call it before the session is marked finished so a failure leaves it open.
pub(crate) fn build(database: &SessionDatabase, session_id: u64) -> rusqlite::Result<Wrapup> {
    let current = SessionStats::from_answers(&database.answer_samples(session_id)?);
    let earlier = database
        .earlier_finished_session_ids(session_id, COMPARISON_LOOKBACK)?
        .into_iter()
        .map(|id| {
            database
                .answer_samples(id)
                .map(|a| SessionStats::from_answers(&a))
        })
        .collect::<rusqlite::Result<Vec<_>>>()?;

    let phrases = match database.wrapup_record(session_id)? {
        None => pick_phrases(
            &database.reviewed_answers(session_id)?,
            &database.saved_phrase_keys()?,
        ),
        Some(crate::persistence::wrapup_generation::PreparedWrapup::Ready(result)) => result
            .phrases
            .into_iter()
            .map(
                |item: crate::providers::GeneratedWrapupPhrase| WrapupPhrase {
                    sequence: item.sequence,
                    phrase: item.phrase,
                    note: item.note,
                    you_said: item.you_said,
                },
            )
            .collect(),
        Some(_) => Vec::new(),
    };
    let recurring_mistakes = database
        .repeated_mistakes(session_id, MAX_WRAPUP_MISTAKES)?
        .into_iter()
        .map(|mistake| RecurringMistake {
            original: mistake.original,
            improved: mistake.improved,
            explanation: mistake.explanation,
            times: mistake.times,
        })
        .collect();

    Ok(Wrapup {
        duration_ms: database.session_elapsed_ms(session_id)?,
        numbers: session_numbers(&current, &earlier),
        phrases,
        recurring_mistakes,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::providers::{FocusCategory, FocusFeedback, TurnFeedback};

    fn answer(
        sequence: usize,
        transcript: &str,
        focus: &[(&str, &str)],
        rewrite: &str,
    ) -> ReviewedAnswer {
        ReviewedAnswer {
            sequence,
            transcript: transcript.into(),
            feedback: TurnFeedback {
                focus_feedback: focus
                    .iter()
                    .map(|(original, improved)| FocusFeedback {
                        category: FocusCategory::Grammar,
                        original: (*original).into(),
                        improved: (*improved).into(),
                        explanation: "Because.".into(),
                    })
                    .collect(),
                b2_rewrite: rewrite.into(),
            },
        }
    }

    #[test]
    fn picks_newest_more_natural_rewrites_before_whole_answer_rewrites() {
        let answers = [
            answer(
                1,
                "I am here since two weeks",
                &[("since two weeks", "for two weeks")],
                "I have been here for two weeks.",
            ),
            answer(2, "He go home", &[("He go", "He goes")], "He goes home."),
        ];
        let picked = pick_phrases(&answers, &HashSet::new());
        let phrases: Vec<_> = picked.iter().map(|p| p.phrase.as_str()).collect();
        assert_eq!(phrases, ["He goes", "for two weeks", "He goes home."]);
        assert_eq!(picked[0].sequence, 2);
        assert_eq!(picked[0].you_said, "He go");
        assert_eq!(picked[0].note, "Because.");
        assert_eq!(picked[2].note, STRONGER_PHRASING_NOTE);
        assert_eq!(picked[2].you_said, "He go home");
    }

    #[test]
    fn skips_duplicates_saved_phrases_and_rewrites_that_repeat_the_original() {
        let answers = [
            answer(1, "same words", &[("a", "For two weeks")], "same words!"),
            answer(
                2,
                "x",
                &[("b", "for two weeks."), ("c", "Already saved")],
                "",
            ),
        ];
        let saved = HashSet::from([normalize_phrase("already saved")]);
        let picked = pick_phrases(&answers, &saved);
        assert_eq!(picked.len(), 1);
        assert_eq!(picked[0].phrase, "for two weeks.");
        assert_eq!(picked[0].sequence, 2);
    }

    #[test]
    fn caps_at_three_and_shortens_long_quotes() {
        let long = "word ".repeat(80);
        let answers = [
            answer(1, &long, &[("p", "one")], ""),
            answer(2, "x", &[("p", "two")], ""),
            answer(3, "x", &[("p", "three")], ""),
            answer(4, "x", &[("p", "four")], ""),
        ];
        let picked = pick_phrases(&answers, &HashSet::new());
        let phrases: Vec<_> = picked.iter().map(|p| p.phrase.as_str()).collect();
        assert_eq!(phrases, ["four", "three", "two"]);
        let rewrite_only = [answer(1, &long, &[], "A fuller way to say it.")];
        let quote = &pick_phrases(&rewrite_only, &HashSet::new())[0].you_said;
        assert!(quote.ends_with('…'));
        assert!(quote.chars().count() <= MAX_QUOTE_CHARS + 1);
    }

    #[test]
    fn nothing_reviewed_means_nothing_to_learn() {
        assert!(pick_phrases(&[], &HashSet::new()).is_empty());
    }
}
