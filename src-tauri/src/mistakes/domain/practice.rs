use super::answer::{said_in_order, same_sentence};
use super::lesson::WordRange;
use super::rules::{RuleKey, RULES};
use serde::{Deserialize, Serialize};
use ts_rs::TS;

pub const RUN_SIZE: usize = 6;
pub const MAX_LINE_CHARS: usize = 160;
pub const PASS_NOTE: &str = "Right.";
pub const MISS_NOTE: &str = "Not quite \u{2014} here is the version to keep.";
pub const RETRY_MATCH_NOTE: &str = "That matches the version to keep.";
pub const RETRY_MISS_NOTE: &str = "Still not the version to keep.";
pub const RETRY_PRACTICE_NOTE: &str = "Noted. Practice does not change your schedule.";

macro_rules! text_enum {
    ($name:ident { $($variant:ident => $text:literal),+ $(,)? }) => {
        #[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
        #[serde(rename_all = "snake_case")]
        #[ts(export)]
        pub enum $name { $($variant),+ }

        impl $name {
            pub fn as_str(self) -> &'static str {
                match self { $(Self::$variant => $text),+ }
            }

            pub fn parse(text: &str) -> Option<Self> {
                match text { $($text => Some(Self::$variant),)+ _ => None }
            }
        }
    };
}

text_enum!(RunKind { Due => "due", One => "one", Rule => "rule" });
text_enum!(InputKind { Typed => "typed", Spoken => "spoken" });
text_enum!(AttemptOutcome { Pass => "pass", Miss => "miss", Checking => "checking", Retry => "retry" });
text_enum!(CheckedBy { Local => "local", Ai => "ai" });

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct RunItem {
    pub position: u32,
    pub mistake_id: u64,
    pub step: u8,
    pub rule_key: Option<RuleKey>,
    pub question: String,
    pub said: String,
    pub corrected: String,
    pub gaps: Vec<WordRange>,
    pub accepted: Vec<String>,
    pub situation: Option<String>,
    pub lesson_line: String,
    pub rule_title: String,
    pub explanation: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CandidateLesson {
    pub explanation: String,
    pub gaps: Vec<WordRange>,
    pub accepted: Vec<String>,
    pub situations: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Candidate {
    pub mistake_id: u64,
    pub rule_key: Option<RuleKey>,
    pub rule_count: u32,
    pub ladder_step: u8,
    pub next_review_at: i64,
    pub question: String,
    pub said: String,
    pub corrected: String,
    pub review_explanation: String,
    pub lesson: Option<CandidateLesson>,
    pub step4_attempts: u32,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AttemptRecord {
    pub id: u64,
    pub mistake_id: u64,
    pub run_id: u64,
    pub step: u8,
    pub input: InputKind,
    pub answer: String,
    pub outcome: AttemptOutcome,
    pub checked_by: CheckedBy,
    pub note: String,
    pub created_at: i64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RunRecord {
    pub id: u64,
    pub kind: RunKind,
    pub rule_key: Option<RuleKey>,
    pub items: Vec<RunItem>,
    pub attempts: Vec<AttemptRecord>,
    pub created_at: i64,
    pub finished_at: Option<i64>,
}

fn word_count(sentence: &str) -> usize {
    sentence.split_whitespace().count()
}

fn gaps_fit(gaps: &[WordRange], sentence: &str) -> bool {
    let words = word_count(sentence);
    !gaps.is_empty()
        && gaps
            .iter()
            .all(|gap| gap.start < gap.end && gap.end <= words)
}

pub fn one_line(text: &str) -> String {
    let flat = text.split_whitespace().collect::<Vec<_>>().join(" ");
    let first = flat
        .char_indices()
        .find(|(index, ch)| {
            matches!(ch, '.' | '!' | '?')
                && flat[index + ch.len_utf8()..]
                    .chars()
                    .next()
                    .is_none_or(char::is_whitespace)
        })
        .map_or(flat.as_str(), |(index, ch)| &flat[..index + ch.len_utf8()]);
    first.chars().take(MAX_LINE_CHARS).collect()
}

fn exercise_for(candidate: &Candidate) -> (u8, Option<String>) {
    let step = candidate.ladder_step.clamp(1, 4);
    let Some(lesson) = &candidate.lesson else {
        return (3, None);
    };
    match step {
        1 if gaps_fit(&lesson.gaps, &candidate.corrected) => (1, None),
        2 => (2, None),
        4 => {
            let count = lesson.situations.len();
            if count == 0 {
                (3, None)
            } else {
                let index = usize::try_from(candidate.step4_attempts).unwrap_or(0) % count;
                (4, lesson.situations.get(index).cloned())
            }
        }
        _ => (3, None),
    }
}

fn rule_position(rule: Option<RuleKey>) -> usize {
    rule.and_then(|rule| RULES.iter().position(|info| info.key == rule))
        .unwrap_or(RULES.len())
}

pub fn plan_run(mut candidates: Vec<Candidate>) -> Vec<RunItem> {
    candidates.retain(|candidate| !candidate.corrected.trim().is_empty());
    candidates.sort_by(|left, right| {
        right
            .rule_count
            .cmp(&left.rule_count)
            .then(rule_position(left.rule_key).cmp(&rule_position(right.rule_key)))
            .then(left.next_review_at.cmp(&right.next_review_at))
            .then(left.mistake_id.cmp(&right.mistake_id))
    });
    candidates.truncate(RUN_SIZE);
    candidates
        .into_iter()
        .enumerate()
        .map(|(position, candidate)| {
            let (step, situation) = exercise_for(&candidate);
            let lesson = candidate.lesson;
            let explanation = lesson
                .as_ref()
                .map(|lesson| lesson.explanation.clone())
                .filter(|text| !text.trim().is_empty())
                .unwrap_or(candidate.review_explanation);
            RunItem {
                position: u32::try_from(position).unwrap_or(u32::MAX),
                mistake_id: candidate.mistake_id,
                step,
                rule_key: candidate.rule_key,
                question: candidate.question,
                said: candidate.said,
                corrected: candidate.corrected,
                gaps: lesson.as_ref().map(|l| l.gaps.clone()).unwrap_or_default(),
                accepted: lesson
                    .as_ref()
                    .map(|l| l.accepted.clone())
                    .unwrap_or_default(),
                situation,
                lesson_line: one_line(&explanation),
                rule_title: candidate
                    .rule_key
                    .map(|rule| rule.info().title.to_string())
                    .unwrap_or_default(),
                explanation,
            }
        })
        .collect()
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Rejection {
    EmptyAnswer,
    AlreadyAnswered,
    AwaitingCheck,
    RetryUsed,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Decision {
    Reject(Rejection),
    Retry { note: &'static str },
    Local { passed: bool },
    Background,
}

pub fn gap_words(item: &RunItem) -> Vec<String> {
    let words: Vec<&str> = item.corrected.split_whitespace().collect();
    item.gaps
        .iter()
        .flat_map(|gap| {
            words
                .get(gap.start..gap.end.min(words.len()))
                .unwrap_or(&[])
        })
        .map(|word| (*word).to_string())
        .collect()
}

pub fn local_match(item: &RunItem, answer: &str) -> bool {
    match item.step {
        1 => {
            same_sentence(&item.corrected, answer)
                || same_sentence(&gap_words(item).join(" "), answer)
        }
        2 => {
            same_sentence(&item.corrected, answer)
                || item.accepted.iter().any(|kept| same_sentence(kept, answer))
        }
        _ => said_in_order(&item.corrected, answer),
    }
}

pub fn decide(item: &RunItem, attempts: &[AttemptRecord], answer: &str) -> Decision {
    if answer.trim().is_empty() {
        return Decision::Reject(Rejection::EmptyAnswer);
    }
    let own: Vec<&AttemptRecord> = attempts
        .iter()
        .filter(|attempt| attempt.mistake_id == item.mistake_id)
        .collect();
    if let Some(first) = own
        .iter()
        .find(|attempt| attempt.outcome != AttemptOutcome::Retry)
    {
        return match first.outcome {
            AttemptOutcome::Pass => Decision::Reject(Rejection::AlreadyAnswered),
            AttemptOutcome::Checking => Decision::Reject(Rejection::AwaitingCheck),
            _ if own
                .iter()
                .any(|attempt| attempt.outcome == AttemptOutcome::Retry) =>
            {
                Decision::Reject(Rejection::RetryUsed)
            }
            _ => Decision::Retry {
                note: retry_note(item, answer),
            },
        };
    }
    if item.step == 4 {
        Decision::Background
    } else {
        Decision::Local {
            passed: local_match(item, answer),
        }
    }
}

fn retry_note(item: &RunItem, answer: &str) -> &'static str {
    if item.step == 4 {
        RETRY_PRACTICE_NOTE
    } else if local_match(item, answer) {
        RETRY_MATCH_NOTE
    } else {
        RETRY_MISS_NOTE
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, TS)]
#[ts(export)]
pub struct GapView {
    pub start: u32,
    pub end: u32,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, TS)]
#[ts(export)]
pub struct GapSentenceView {
    pub words: Vec<Option<String>>,
    pub gaps: Vec<GapView>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, TS)]
#[ts(export)]
pub struct ExerciseResult {
    pub attempt_id: u64,
    pub outcome: AttemptOutcome,
    pub note: String,
    pub keep: String,
    pub lesson: String,
    pub can_check: bool,
    pub retried: bool,
    pub retry_note: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, TS)]
#[ts(export)]
pub struct ExerciseView {
    pub position: u32,
    pub mistake_id: u64,
    pub step: u8,
    pub rule_key: Option<RuleKey>,
    pub question: String,
    pub said: Option<String>,
    pub sentence: Option<GapSentenceView>,
    pub result: Option<ExerciseResult>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, TS)]
#[ts(export)]
pub struct RunView {
    pub run_id: u64,
    pub kind: RunKind,
    pub finished: bool,
    pub items: Vec<ExerciseView>,
}

fn sentence_view(item: &RunItem) -> GapSentenceView {
    let hidden = |index: usize| {
        item.gaps
            .iter()
            .any(|gap| gap.start <= index && index < gap.end)
    };
    GapSentenceView {
        words: item
            .corrected
            .split_whitespace()
            .enumerate()
            .map(|(index, word)| (!hidden(index)).then(|| word.to_string()))
            .collect(),
        gaps: item
            .gaps
            .iter()
            .map(|gap| GapView {
                start: u32::try_from(gap.start).unwrap_or(u32::MAX),
                end: u32::try_from(gap.end).unwrap_or(u32::MAX),
            })
            .collect(),
    }
}

fn result_view(item: &RunItem, attempts: &[&AttemptRecord]) -> Option<ExerciseResult> {
    let decisive = attempts
        .iter()
        .find(|attempt| attempt.outcome != AttemptOutcome::Retry)?;
    let retry = attempts
        .iter()
        .rev()
        .find(|attempt| attempt.outcome == AttemptOutcome::Retry);
    Some(ExerciseResult {
        attempt_id: decisive.id,
        outcome: decisive.outcome,
        note: decisive.note.clone(),
        keep: item.corrected.clone(),
        lesson: item.lesson_line.clone(),
        can_check: item.step == 2
            && decisive.outcome == AttemptOutcome::Miss
            && decisive.checked_by == CheckedBy::Local
            && retry.is_none(),
        retried: retry.is_some(),
        retry_note: retry.map(|attempt| attempt.note.clone()),
    })
}

pub fn exercise_view(item: &RunItem, attempts: &[AttemptRecord]) -> ExerciseView {
    let own: Vec<&AttemptRecord> = attempts
        .iter()
        .filter(|attempt| attempt.mistake_id == item.mistake_id)
        .collect();
    ExerciseView {
        position: item.position,
        mistake_id: item.mistake_id,
        step: item.step,
        rule_key: item.rule_key,
        question: item
            .situation
            .clone()
            .unwrap_or_else(|| item.question.clone()),
        said: (item.step == 2).then(|| item.said.clone()),
        sentence: (item.step == 1).then(|| sentence_view(item)),
        result: result_view(item, &own),
    }
}

pub fn run_view(run: &RunRecord) -> RunView {
    RunView {
        run_id: run.id,
        kind: run.kind,
        finished: run.finished_at.is_some(),
        items: run
            .items
            .iter()
            .map(|item| exercise_view(item, &run.attempts))
            .collect(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn lesson() -> CandidateLesson {
        CandidateLesson {
            explanation: "Since links the past to now. It needs the perfect.".into(),
            gaps: vec![WordRange { start: 1, end: 3 }],
            accepted: vec!["I've been there since May".into()],
            situations: vec![
                "What have you done lately?".into(),
                "Where have you been?".into(),
            ],
        }
    }

    fn candidate(id: u64, rule: Option<RuleKey>, count: u32, step: u8) -> Candidate {
        Candidate {
            mistake_id: id,
            rule_key: rule,
            rule_count: count,
            ladder_step: step,
            next_review_at: 100 + i64::try_from(id).unwrap_or(0),
            question: "Where were you?".into(),
            said: "I was there since May".into(),
            corrected: "I have been there since May".into(),
            review_explanation: "Use the perfect.".into(),
            lesson: Some(lesson()),
            step4_attempts: 0,
        }
    }

    fn item(step: u8) -> RunItem {
        let mut candidate = candidate(1, Some(RuleKey::Articles), 1, step);
        candidate.ladder_step = step;
        plan_run(vec![candidate]).remove(0)
    }

    fn attempt(id: u64, outcome: AttemptOutcome, by: CheckedBy) -> AttemptRecord {
        AttemptRecord {
            id,
            mistake_id: 1,
            run_id: 1,
            step: 2,
            input: InputKind::Typed,
            answer: "x".into(),
            outcome,
            checked_by: by,
            note: "n".into(),
            created_at: 1,
        }
    }

    #[test]
    fn a_run_takes_six_mistakes_most_frequent_rule_first() {
        let mut candidates = vec![candidate(1, Some(RuleKey::Articles), 2, 1)];
        candidates.push(candidate(2, Some(RuleKey::Prepositions), 5, 1));
        candidates.push(candidate(3, Some(RuleKey::Prepositions), 5, 1));
        candidates.push(candidate(4, None, 0, 1));
        for id in 5..10 {
            candidates.push(candidate(id, Some(RuleKey::Articles), 2, 1));
        }
        let items = plan_run(candidates);
        assert_eq!(items.len(), 6);
        assert_eq!(items[0].mistake_id, 2);
        assert_eq!(items[1].mistake_id, 3);
        assert_eq!(items[2].mistake_id, 1);
        assert!(items.iter().all(|item| item.mistake_id != 4));
        let positions: Vec<u32> = items.iter().map(|item| item.position).collect();
        assert_eq!(positions, [0, 1, 2, 3, 4, 5]);
    }

    #[test]
    fn each_mistake_gets_the_exercise_of_its_ladder_step() {
        assert_eq!(item(1).step, 1);
        assert_eq!(item(2).step, 2);
        assert_eq!(item(3).step, 3);
        let step4 = item(4);
        assert_eq!(step4.step, 4);
        assert_eq!(
            step4.situation.as_deref(),
            Some("What have you done lately?")
        );
    }

    #[test]
    fn step_four_alternates_the_lesson_situations() {
        let mut next = candidate(1, Some(RuleKey::Articles), 1, 4);
        next.step4_attempts = 1;
        let planned = plan_run(vec![next]);
        assert_eq!(
            planned[0].situation.as_deref(),
            Some("Where have you been?")
        );
    }

    #[test]
    fn missing_lesson_data_falls_back_to_the_say_it_step() {
        let mut no_lesson = candidate(1, None, 0, 2);
        no_lesson.lesson = None;
        assert_eq!(plan_run(vec![no_lesson]).remove(0).step, 3);
        let mut no_gaps = candidate(1, Some(RuleKey::Articles), 1, 1);
        no_gaps.lesson.as_mut().unwrap().gaps = vec![];
        assert_eq!(plan_run(vec![no_gaps]).remove(0).step, 3);
        let mut out_of_range = candidate(1, Some(RuleKey::Articles), 1, 1);
        out_of_range.lesson.as_mut().unwrap().gaps = vec![WordRange { start: 5, end: 9 }];
        assert_eq!(plan_run(vec![out_of_range]).remove(0).step, 3);
        let mut no_situations = candidate(1, Some(RuleKey::Articles), 1, 4);
        no_situations.lesson.as_mut().unwrap().situations = vec![];
        assert_eq!(plan_run(vec![no_situations]).remove(0).step, 3);
        let mut no_sentence = candidate(1, None, 0, 3);
        no_sentence.corrected = " ".into();
        assert!(plan_run(vec![no_sentence]).is_empty());
    }

    #[test]
    fn the_lesson_line_is_the_first_sentence() {
        assert_eq!(item(1).lesson_line, "Since links the past to now.");
        assert_eq!(
            one_line("No end punctuation here"),
            "No end punctuation here"
        );
        assert_eq!(one_line("Version 2.5 works. Next."), "Version 2.5 works.");
    }

    #[test]
    fn step_one_checks_the_whole_sentence_or_just_the_hidden_words() {
        let step1 = item(1);
        assert_eq!(gap_words(&step1), ["have", "been"]);
        assert!(local_match(&step1, "I have been there since May."));
        assert!(local_match(&step1, "Have  BEEN"));
        assert!(!local_match(&step1, "I was there since May"));
        assert!(!local_match(&step1, "have"));
    }

    #[test]
    fn step_two_accepts_the_corrected_sentence_and_prepared_rewrites() {
        let step2 = item(2);
        assert!(local_match(&step2, "I have been there since May"));
        assert!(local_match(&step2, "I've been there since May."));
        assert!(!local_match(&step2, "I was there since May"));
    }

    #[test]
    fn step_three_needs_the_corrected_wording_in_order_inside_a_longer_answer() {
        let step3 = item(3);
        assert!(local_match(
            &step3,
            "Well, I have been there since May, yes"
        ));
        assert!(!local_match(&step3, "I was there since May"));
    }

    #[test]
    fn the_first_answer_is_checked_locally_or_in_the_background() {
        assert_eq!(
            decide(&item(1), &[], "have been"),
            Decision::Local { passed: true }
        );
        assert_eq!(
            decide(&item(2), &[], "nope"),
            Decision::Local { passed: false }
        );
        assert_eq!(decide(&item(4), &[], "anything"), Decision::Background);
        assert_eq!(
            decide(&item(1), &[], "  "),
            Decision::Reject(Rejection::EmptyAnswer)
        );
    }

    #[test]
    fn an_answer_after_a_miss_is_one_free_retry() {
        let miss = attempt(1, AttemptOutcome::Miss, CheckedBy::Local);
        assert_eq!(
            decide(
                &item(2),
                std::slice::from_ref(&miss),
                "I have been there since May"
            ),
            Decision::Retry {
                note: RETRY_MATCH_NOTE
            }
        );
        assert_eq!(
            decide(&item(2), std::slice::from_ref(&miss), "no"),
            Decision::Retry {
                note: RETRY_MISS_NOTE
            }
        );
        assert_eq!(
            decide(
                &item(4),
                &[attempt(1, AttemptOutcome::Miss, CheckedBy::Ai)],
                "again"
            ),
            Decision::Retry {
                note: RETRY_PRACTICE_NOTE
            }
        );
        let retry = attempt(2, AttemptOutcome::Retry, CheckedBy::Local);
        assert_eq!(
            decide(&item(2), &[miss, retry], "again"),
            Decision::Reject(Rejection::RetryUsed)
        );
    }

    #[test]
    fn a_passed_or_pending_exercise_takes_no_more_answers() {
        assert_eq!(
            decide(
                &item(2),
                &[attempt(1, AttemptOutcome::Pass, CheckedBy::Local)],
                "x"
            ),
            Decision::Reject(Rejection::AlreadyAnswered)
        );
        assert_eq!(
            decide(
                &item(4),
                &[attempt(1, AttemptOutcome::Checking, CheckedBy::Ai)],
                "x"
            ),
            Decision::Reject(Rejection::AwaitingCheck)
        );
    }

    #[test]
    fn the_view_never_carries_the_hidden_words_before_an_answer() {
        let view = exercise_view(&item(1), &[]);
        let sentence = view.sentence.clone().unwrap();
        assert_eq!(
            sentence.words,
            [
                Some("I".to_string()),
                None,
                None,
                Some("there".to_string()),
                Some("since".to_string()),
                Some("May".to_string())
            ]
        );
        assert_eq!(sentence.gaps, [GapView { start: 1, end: 3 }]);
        assert!(view.result.is_none());
        let shown = format!("{view:?}");
        assert!(!shown.contains("have"));
        assert!(!shown.contains("been"));
        assert!(view.said.is_none());
    }

    #[test]
    fn the_say_it_view_reveals_only_the_situation() {
        let view = exercise_view(&item(3), &[]);
        assert_eq!(view.question, "Where were you?");
        assert!(view.sentence.is_none() && view.said.is_none());
        assert!(!format!("{view:?}").contains("have been"));
    }

    #[test]
    fn the_fix_it_view_shows_the_learner_sentence_and_the_use_it_view_a_new_question() {
        assert_eq!(
            exercise_view(&item(2), &[]).said.as_deref(),
            Some("I was there since May")
        );
        assert_eq!(
            exercise_view(&item(4), &[]).question,
            "What have you done lately?"
        );
    }

    #[test]
    fn after_an_answer_the_view_shows_the_outcome_the_version_to_keep_and_the_lesson() {
        let miss = attempt(7, AttemptOutcome::Miss, CheckedBy::Local);
        let view = exercise_view(&item(2), &[miss]);
        let result = view.result.unwrap();
        assert_eq!(result.attempt_id, 7);
        assert_eq!(result.outcome, AttemptOutcome::Miss);
        assert_eq!(result.keep, "I have been there since May");
        assert_eq!(result.lesson, "Since links the past to now.");
        assert!(result.can_check);
        assert!(!result.retried);
    }

    #[test]
    fn check_it_is_offered_once_and_only_for_a_local_miss_in_fix_it() {
        let ai_miss = attempt(1, AttemptOutcome::Miss, CheckedBy::Ai);
        assert!(
            !exercise_view(&item(2), &[ai_miss])
                .result
                .unwrap()
                .can_check
        );
        let miss = attempt(1, AttemptOutcome::Miss, CheckedBy::Local);
        let retry = attempt(2, AttemptOutcome::Retry, CheckedBy::Local);
        let result = exercise_view(&item(2), &[miss, retry]).result.unwrap();
        assert!(!result.can_check);
        assert!(result.retried);
        let step1 = attempt(1, AttemptOutcome::Miss, CheckedBy::Local);
        assert!(!exercise_view(&item(1), &[step1]).result.unwrap().can_check);
    }
}
