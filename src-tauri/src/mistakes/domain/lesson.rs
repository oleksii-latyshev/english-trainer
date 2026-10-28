use super::rules::RuleKey;
use super::words::{changed_word_indexes, contains_wording, same_words, sentence_words};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::BTreeSet;
use ts_rs::TS;

pub const MAX_EXPLANATION_CHARS: usize = 300;
pub const MAX_LINE_CHARS: usize = 120;
pub const MAX_LABEL_CHARS: usize = 40;
pub const MAX_QUESTION_CHARS: usize = 300;
pub const MAX_REWRITE_CHARS: usize = 300;
pub const MAX_CARD_BODY_CHARS: usize = 600;
pub const MAX_ACCEPTED: usize = 4;
pub const MAX_GAPS: usize = 4;
const MAX_EXTRA_GAP_WORDS: usize = 3;
const MAX_DELETION_GAP_WORDS: usize = 2;
pub const MAX_FAILURES: u32 = 2;
pub const BATCH_SIZE: usize = 5;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LessonRequest {
    pub mistake_id: u64,
    pub question: String,
    pub said: String,
    pub corrected: String,
    pub review_explanation: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LessonBatchRequest {
    pub mistakes: Vec<LessonRequest>,
    pub missing_card_keys: Vec<RuleKey>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct ContrastLine {
    pub label: String,
    pub sentence: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct LessonWord {
    pub word: String,
    pub meaning: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct WordRange {
    pub start: usize,
    pub end: usize,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Lesson {
    pub rule_key: RuleKey,
    pub explanation: String,
    pub contrast: Vec<ContrastLine>,
    pub examples: Vec<String>,
    pub word: Option<LessonWord>,
    pub gaps: Vec<WordRange>,
    pub accepted: Vec<String>,
    pub situations: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RuleCardContent {
    pub rule_key: RuleKey,
    pub body: String,
    pub examples: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum LessonRejection {
    UnknownRule,
    Explanation,
    Contrast,
    Examples,
    Word,
    Gaps,
    Situations,
}

#[derive(Debug, Clone, Default, Deserialize)]
pub struct RawLessonBatch {
    #[serde(default)]
    pub lessons: Vec<Value>,
    #[serde(default)]
    pub rule_cards: Vec<Value>,
}

#[derive(Deserialize)]
struct RawLesson {
    mistake_id: i64,
    rule_key: String,
    explanation: String,
    contrast: Vec<RawContrastLine>,
    examples: Vec<String>,
    #[serde(default)]
    word: Option<RawWord>,
    gaps: Vec<RawRange>,
    #[serde(default)]
    accepted: Vec<String>,
    situations: Vec<String>,
}

#[derive(Deserialize)]
struct RawContrastLine {
    label: String,
    sentence: String,
}

#[derive(Deserialize)]
struct RawWord {
    word: String,
    meaning: String,
}

#[derive(Deserialize)]
struct RawRange {
    start: i64,
    end: i64,
}

#[derive(Deserialize)]
struct RawRuleCard {
    rule_key: String,
    body: String,
    examples: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct ValidatedBatch {
    pub lessons: Vec<(u64, Lesson)>,
    pub rejected: Vec<u64>,
    pub cards: Vec<RuleCardContent>,
}

pub fn validate_batch(request: &LessonBatchRequest, raw: RawLessonBatch) -> ValidatedBatch {
    let mut lessons: Vec<(u64, Lesson)> = Vec::new();
    for value in raw.lessons {
        let Ok(entry) = serde_json::from_value::<RawLesson>(value) else {
            continue;
        };
        let Some(mistake) = request
            .mistakes
            .iter()
            .find(|mistake| i64::try_from(mistake.mistake_id) == Ok(entry.mistake_id))
        else {
            continue;
        };
        if lessons.iter().any(|(id, _)| *id == mistake.mistake_id) {
            continue;
        }
        if let Ok(lesson) = validate_lesson(entry, mistake) {
            lessons.push((mistake.mistake_id, lesson));
        }
    }
    let rejected = request
        .mistakes
        .iter()
        .map(|mistake| mistake.mistake_id)
        .filter(|id| !lessons.iter().any(|(ready, _)| ready == id))
        .collect();
    let cards = validate_cards(request, &lessons, raw.rule_cards);
    ValidatedBatch {
        lessons,
        rejected,
        cards,
    }
}

fn validate_lesson(entry: RawLesson, mistake: &LessonRequest) -> Result<Lesson, LessonRejection> {
    let rule_key = RuleKey::parse(&entry.rule_key).ok_or(LessonRejection::UnknownRule)?;
    let explanation =
        clean(&entry.explanation, MAX_EXPLANATION_CHARS).ok_or(LessonRejection::Explanation)?;
    let contrast = validate_contrast(entry.contrast)?;
    let examples = exactly_two(&entry.examples, MAX_LINE_CHARS).ok_or(LessonRejection::Examples)?;
    let word = validate_word(entry.word)?;
    let gaps = validate_gaps(&entry.gaps, mistake)?;
    let accepted = validate_accepted(&entry.accepted, mistake);
    let situations = validate_situations(&entry.situations, mistake)?;
    Ok(Lesson {
        rule_key,
        explanation,
        contrast,
        examples,
        word,
        gaps,
        accepted,
        situations,
    })
}

fn clean(text: &str, max_chars: usize) -> Option<String> {
    let text = text.trim();
    let length = text.chars().count();
    let is_plain_english = !text
        .chars()
        .any(|ch| ch.is_control() || (ch.is_alphabetic() && !ch.is_ascii()));
    (length > 0 && length <= max_chars && is_plain_english).then(|| text.to_string())
}

fn exactly_two(lines: &[String], max_chars: usize) -> Option<Vec<String>> {
    if lines.len() != 2 {
        return None;
    }
    lines.iter().map(|line| clean(line, max_chars)).collect()
}

fn validate_contrast(lines: Vec<RawContrastLine>) -> Result<Vec<ContrastLine>, LessonRejection> {
    if lines.len() != 2 {
        return Err(LessonRejection::Contrast);
    }
    lines
        .into_iter()
        .map(|line| {
            Some(ContrastLine {
                label: clean(&line.label, MAX_LABEL_CHARS)?,
                sentence: clean(&line.sentence, MAX_LINE_CHARS)?,
            })
        })
        .collect::<Option<Vec<_>>>()
        .ok_or(LessonRejection::Contrast)
}

fn validate_word(word: Option<RawWord>) -> Result<Option<LessonWord>, LessonRejection> {
    let Some(word) = word else {
        return Ok(None);
    };
    if word.word.trim().is_empty() && word.meaning.trim().is_empty() {
        return Ok(None);
    }
    Ok(Some(LessonWord {
        word: clean(&word.word, MAX_LABEL_CHARS).ok_or(LessonRejection::Word)?,
        meaning: clean(&word.meaning, MAX_LINE_CHARS).ok_or(LessonRejection::Word)?,
    }))
}

fn validate_gaps(
    ranges: &[RawRange],
    mistake: &LessonRequest,
) -> Result<Vec<WordRange>, LessonRejection> {
    let word_count = sentence_words(&mistake.corrected).len();
    let changed = changed_word_indexes(&mistake.said, &mistake.corrected);
    if let Some(gaps) = model_gaps(ranges, word_count, &changed) {
        return Ok(gaps);
    }
    gaps_of(&changed, word_count).ok_or(LessonRejection::Gaps)
}

fn model_gaps(
    ranges: &[RawRange],
    word_count: usize,
    changed: &BTreeSet<usize>,
) -> Option<Vec<WordRange>> {
    if ranges.is_empty() || ranges.len() > MAX_GAPS {
        return None;
    }
    let mut gaps: Vec<WordRange> = Vec::with_capacity(ranges.len());
    let mut covered = BTreeSet::new();
    for range in ranges {
        let start = usize::try_from(range.start).ok()?;
        let end = usize::try_from(range.end).ok()?;
        let follows_previous = gaps.last().is_none_or(|previous| start >= previous.end);
        if start >= end || end > word_count || !follows_previous {
            return None;
        }
        covered.extend(start..end);
        gaps.push(WordRange { start, end });
    }
    let allowed = if changed.is_empty() {
        MAX_DELETION_GAP_WORDS
    } else {
        changed.len() + MAX_EXTRA_GAP_WORDS
    };
    let fits = covered.is_superset(changed) && covered.len() <= allowed;
    (fits && covered.len() < word_count).then_some(gaps)
}

fn gaps_of(changed: &BTreeSet<usize>, word_count: usize) -> Option<Vec<WordRange>> {
    if changed.is_empty() || changed.len() >= word_count {
        return None;
    }
    let mut gaps: Vec<WordRange> = Vec::new();
    for &index in changed {
        match gaps.last_mut() {
            Some(last) if last.end == index => last.end = index + 1,
            _ => gaps.push(WordRange {
                start: index,
                end: index + 1,
            }),
        }
    }
    (gaps.len() <= MAX_GAPS).then_some(gaps)
}

fn validate_accepted(rewrites: &[String], mistake: &LessonRequest) -> Vec<String> {
    let mut accepted: Vec<String> = Vec::new();
    for rewrite in rewrites {
        let Some(rewrite) = clean(rewrite, MAX_REWRITE_CHARS) else {
            continue;
        };
        let repeats = same_words(&rewrite, &mistake.corrected)
            || same_words(&rewrite, &mistake.said)
            || accepted.iter().any(|kept| same_words(kept, &rewrite));
        if !repeats {
            accepted.push(rewrite);
        }
        if accepted.len() == MAX_ACCEPTED {
            break;
        }
    }
    accepted
}

fn validate_situations(
    questions: &[String],
    mistake: &LessonRequest,
) -> Result<Vec<String>, LessonRejection> {
    let questions =
        exactly_two(questions, MAX_QUESTION_CHARS).ok_or(LessonRejection::Situations)?;
    let is_valid = questions.iter().all(|question| {
        question.ends_with('?')
            && !contains_wording(question, &mistake.corrected)
            && !contains_wording(question, &mistake.said)
    }) && !same_words(&questions[0], &questions[1]);
    if is_valid {
        Ok(questions)
    } else {
        Err(LessonRejection::Situations)
    }
}

fn validate_cards(
    request: &LessonBatchRequest,
    lessons: &[(u64, Lesson)],
    raw_cards: Vec<Value>,
) -> Vec<RuleCardContent> {
    let mut cards: Vec<RuleCardContent> = Vec::new();
    for value in raw_cards {
        let Ok(card) = serde_json::from_value::<RawRuleCard>(value) else {
            continue;
        };
        let Some(rule_key) = RuleKey::parse(&card.rule_key) else {
            continue;
        };
        let wanted = request.missing_card_keys.contains(&rule_key)
            && lessons
                .iter()
                .any(|(_, lesson)| lesson.rule_key == rule_key)
            && !cards.iter().any(|kept| kept.rule_key == rule_key);
        let examples = card
            .examples
            .iter()
            .map(|example| clean(example, MAX_LINE_CHARS))
            .collect::<Option<Vec<_>>>();
        let body = clean(&card.body, MAX_CARD_BODY_CHARS);
        if let (true, Some(body), Some(examples)) = (wanted, body, examples) {
            if (2..=4).contains(&examples.len()) {
                cards.push(RuleCardContent {
                    rule_key,
                    body,
                    examples,
                });
            }
        }
    }
    cards
}

#[cfg(test)]
#[path = "lesson_tests.rs"]
mod tests;
