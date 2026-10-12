use super::scoring::{median, normalize_words, term_score, word_error_rate, word_errors};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use ts_rs::TS;

pub const SENTENCE_COUNT: u32 = SENTENCES.len() as u32;

pub const SENTENCES: [&str; 12] = [
    "I tried the Gemini API yesterday and it answered in less than a second.",
    "Most of my code is written with Claude Code, and I review every change.",
    "Our calendar library works with React, Angular and Vue.",
    "I published the headless calendar to the npm registry last month.",
    "The desktop app is built with Tauri, Rust and TypeScript.",
    "I keep the architecture notes in a markdown file in the docs folder.",
    "I live in Kharkiv, in the east of Ukraine.",
    "After work I play CS2 with my friends, usually on Mirage.",
    "We play on FaceIt because the matchmaking is better than in Valorant.",
    "Speech recognition runs locally with Whisper, and the coaching uses Antigravity.",
    "When I started my pet project, I wrote everything by hand, and after three months I still had a lot of bugs.",
    "I usually watch streams on Twitch or videos on YouTube to relax in the evening.",
];

#[derive(Debug, Clone, PartialEq, Eq, Serialize, TS)]
#[ts(export)]
pub struct SentenceStatus {
    pub index: u32,
    pub text: String,
    pub is_recorded: bool,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct RecordingResult {
    pub index: u32,
    pub reference: String,
    pub transcript: String,
    pub time_ms: u64,
    pub terms_found: u32,
    pub terms_total: u32,
    pub word_error_rate: f64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct ModelRun {
    pub model_file: String,
    pub uses_prompt: bool,
    pub measured_at_ms: u64,
    pub terms_found: u32,
    pub terms_total: u32,
    pub term_accuracy: Option<f64>,
    pub word_error_rate: f64,
    pub median_ms: u64,
    pub max_ms: u64,
    pub recordings: Vec<RecordingResult>,
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct SpeechCheckResults {
    pub runs: Vec<ModelRun>,
}

#[derive(Debug, Clone, PartialEq, Serialize, TS)]
#[ts(export)]
pub struct SpeechCheckStatus {
    pub sentences: Vec<SentenceStatus>,
    pub results: SpeechCheckResults,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, TS)]
#[ts(export)]
pub struct SpeechCheckProgress {
    pub model_file: String,
    pub uses_prompt: bool,
    pub done: u32,
    pub total: u32,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CheckRecording {
    pub index: u32,
    pub reference: String,
    pub path: PathBuf,
}

pub fn sentence_for(index: u32) -> Option<&'static str> {
    usize::try_from(index)
        .ok()
        .and_then(|index| index.checked_sub(1))
        .and_then(|position| SENTENCES.get(position))
        .copied()
}

pub fn status_of(recorded_indices: &[u32], results: SpeechCheckResults) -> SpeechCheckStatus {
    let sentences = SENTENCES
        .iter()
        .enumerate()
        .map(|(position, text)| {
            let index = position as u32 + 1;
            SentenceStatus {
                index,
                text: (*text).into(),
                is_recorded: recorded_indices.contains(&index),
            }
        })
        .collect();
    SpeechCheckStatus { sentences, results }
}

pub fn merge_runs(mut earlier: SpeechCheckResults, runs: Vec<ModelRun>) -> SpeechCheckResults {
    earlier.runs.retain(|old| {
        !runs
            .iter()
            .any(|new| new.model_file == old.model_file && new.uses_prompt == old.uses_prompt)
    });
    earlier.runs.extend(runs);
    earlier
        .runs
        .sort_by(|a, b| (&a.model_file, a.uses_prompt).cmp(&(&b.model_file, b.uses_prompt)));
    earlier
}

pub fn score_recording(
    recording: &CheckRecording,
    transcript: String,
    time_ms: u64,
    terms: &[String],
) -> RecordingResult {
    let reference_words = normalize_words(&recording.reference);
    let transcript_words = normalize_words(&transcript);
    let (terms_found, terms_total) = term_score(&reference_words, &transcript_words, terms);
    let errors = word_errors(&reference_words, &transcript_words);
    RecordingResult {
        index: recording.index,
        reference: recording.reference.clone(),
        transcript,
        time_ms,
        terms_found,
        terms_total,
        word_error_rate: word_error_rate(errors, reference_words.len()),
    }
}

pub fn summarize(
    model_file: &str,
    uses_prompt: bool,
    measured_at_ms: u64,
    recordings: Vec<RecordingResult>,
) -> ModelRun {
    let terms_found = recordings.iter().map(|result| result.terms_found).sum();
    let terms_total: u32 = recordings.iter().map(|result| result.terms_total).sum();
    let (errors, words) = recordings.iter().fold((0, 0), |(errors, words), result| {
        let reference = normalize_words(&result.reference);
        let transcript = normalize_words(&result.transcript);
        (
            errors + word_errors(&reference, &transcript),
            words + reference.len(),
        )
    });
    let times: Vec<u64> = recordings.iter().map(|result| result.time_ms).collect();
    ModelRun {
        model_file: model_file.into(),
        uses_prompt,
        measured_at_ms,
        terms_found,
        terms_total,
        term_accuracy: (terms_total > 0).then(|| f64::from(terms_found) / f64::from(terms_total)),
        word_error_rate: word_error_rate(errors, words),
        median_ms: median(&times),
        max_ms: times.iter().copied().max().unwrap_or(0),
        recordings,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn result(index: u32, reference: &str, transcript: &str, time_ms: u64) -> RecordingResult {
        let recording = CheckRecording {
            index,
            reference: reference.into(),
            path: PathBuf::new(),
        };
        score_recording(
            &recording,
            transcript.into(),
            time_ms,
            &["Gemini".to_string()],
        )
    }

    #[test]
    fn summary_pools_terms_and_errors_and_reports_median_and_max_time() {
        let run = summarize(
            "ggml-base.en.bin",
            false,
            0,
            vec![
                result(1, "I tried the Gemini API", "I tried the Jimini IP", 900),
                result(2, "Gemini is fast", "Gemini is fast", 300),
                result(3, "Nothing special here", "Nothing special here", 600),
            ],
        );
        assert_eq!((run.terms_found, run.terms_total), (1, 2));
        assert_eq!(run.term_accuracy, Some(0.5));
        assert!((run.word_error_rate - 2.0 / 11.0).abs() < 1e-9);
        assert_eq!((run.median_ms, run.max_ms), (600, 900));
    }

    #[test]
    fn term_accuracy_is_absent_when_no_sentence_has_a_term() {
        let recording = CheckRecording {
            index: 1,
            reference: "Hello there".into(),
            path: PathBuf::new(),
        };
        let run = summarize(
            "ggml-base.en.bin",
            false,
            0,
            vec![score_recording(&recording, "hello".into(), 5, &[])],
        );
        assert_eq!(run.term_accuracy, None);
    }

    #[test]
    fn sentences_are_numbered_from_one() {
        assert_eq!(sentence_for(0), None);
        assert_eq!(sentence_for(1), SENTENCES.first().copied());
        assert_eq!(sentence_for(12), SENTENCES.last().copied());
        assert_eq!(sentence_for(13), None);
    }

    #[test]
    fn status_marks_the_recorded_sentences() {
        let status = status_of(&[3], SpeechCheckResults::default());
        assert_eq!(status.sentences.iter().filter(|s| s.is_recorded).count(), 1);
        assert!(status.sentences[2].is_recorded);
    }

    #[test]
    fn new_runs_replace_the_same_model_and_prompt_setting_only() {
        let run = |file: &str, uses_prompt| ModelRun {
            model_file: file.into(),
            uses_prompt,
            measured_at_ms: 0,
            terms_found: 0,
            terms_total: 0,
            term_accuracy: None,
            word_error_rate: 0.0,
            median_ms: 0,
            max_ms: 0,
            recordings: Vec::new(),
        };
        let earlier = SpeechCheckResults {
            runs: vec![run("a", false), run("a", true), run("b", false)],
        };
        let merged = merge_runs(earlier, vec![run("b", false), run("a", false)]);
        let names: Vec<(String, bool)> = merged
            .runs
            .into_iter()
            .map(|run| (run.model_file, run.uses_prompt))
            .collect();
        assert_eq!(
            names,
            [("a".into(), false), ("a".into(), true), ("b".into(), false)]
        );
    }
}
