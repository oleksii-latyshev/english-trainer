//! The speech check: the learner reads a fixed set of sentences, the recordings are kept on
//! purpose as a test set, and each Whisper model is measured on them.
//!
//! Layout under `<app data>/speech-check/`: `NN.wav` (16 kHz mono, as the app records), `NN.txt`
//! (the sentence that was read) and `results.json` (the last measurements).
use super::{
    models::{is_model_file_name, models_dir},
    private_files, ready_model,
    scoring::{median, normalize_words, term_score, word_error_rate, word_errors},
    transcribe_file, validate_wav, TemporaryDirectory, TranscriptionError, TranscriptionErrorCode,
};
use crate::audio::glossary::prompt_from_terms;
use serde::{Deserialize, Serialize};
use std::{
    fs, io,
    path::{Path, PathBuf},
    time::{Instant, SystemTime, UNIX_EPOCH},
};

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

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct SentenceStatus {
    /// 1-based position of the sentence in the set.
    pub index: u32,
    pub text: String,
    pub is_recorded: bool,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct RecordingResult {
    pub index: u32,
    pub reference: String,
    pub transcript: String,
    pub time_ms: u64,
    pub terms_found: u32,
    pub terms_total: u32,
    pub word_error_rate: f64,
}

/// One model measured on the whole set, with or without the glossary as Whisper's initial prompt.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ModelRun {
    pub model_file: String,
    pub uses_prompt: bool,
    pub measured_at_ms: u64,
    pub terms_found: u32,
    pub terms_total: u32,
    /// Share of the glossary terms in the sentences that were transcribed correctly; absent when
    /// no sentence contained a glossary term.
    pub term_accuracy: Option<f64>,
    pub word_error_rate: f64,
    pub median_ms: u64,
    pub max_ms: u64,
    pub recordings: Vec<RecordingResult>,
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct SpeechCheckResults {
    pub runs: Vec<ModelRun>,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct SpeechCheckStatus {
    pub sentences: Vec<SentenceStatus>,
    pub results: SpeechCheckResults,
}

/// Reported before each transcription so the UI can show how far the measurement is.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct SpeechCheckProgress {
    pub model_file: String,
    pub uses_prompt: bool,
    pub done: u32,
    pub total: u32,
}

fn check_dir(app_data: &Path) -> PathBuf {
    app_data.join("speech-check")
}

fn stem(index: u32) -> String {
    format!("{index:02}")
}

fn io_failure(message: &str) -> impl Fn(io::Error) -> TranscriptionError + '_ {
    move |_| TranscriptionError::new(TranscriptionErrorCode::IoFailure, message)
}

pub fn status(app_data: &Path) -> SpeechCheckStatus {
    let directory = check_dir(app_data);
    let sentences = SENTENCES
        .iter()
        .enumerate()
        .map(|(position, text)| {
            let index = position as u32 + 1;
            SentenceStatus {
                index,
                text: (*text).into(),
                is_recorded: directory.join(format!("{}.wav", stem(index))).is_file(),
            }
        })
        .collect();
    SpeechCheckStatus {
        sentences,
        results: read_results(&directory),
    }
}

/// An unreadable results file only loses the last measurement, which can be run again.
fn read_results(directory: &Path) -> SpeechCheckResults {
    fs::read_to_string(directory.join("results.json"))
        .ok()
        .and_then(|json| serde_json::from_str(&json).ok())
        .unwrap_or_default()
}

/// Stores the reading of one sentence, replacing an earlier one. Earlier measurements stay: they
/// say which recordings they measured.
pub fn save_recording(app_data: &Path, index: u32, wav: &[u8]) -> Result<(), TranscriptionError> {
    let Some(sentence) = usize::try_from(index)
        .ok()
        .and_then(|index| index.checked_sub(1))
        .and_then(|position| SENTENCES.get(position))
    else {
        return Err(TranscriptionError::new(
            TranscriptionErrorCode::InvalidAudio,
            "That sentence is not part of the speech check.",
        ));
    };
    validate_wav(wav)?;
    let directory = check_dir(app_data);
    let failure =
        io_failure("Cannot save the recording locally. Check disk space, then record again.");
    private_files::create_dir_all(&directory).map_err(&failure)?;
    private_files::write(&directory.join(format!("{}.wav", stem(index))), wav).map_err(&failure)?;
    private_files::write(
        &directory.join(format!("{}.txt", stem(index))),
        sentence.as_bytes(),
    )
    .map_err(&failure)
}

/// "Delete recordings": the test set and its measurements are removed together.
pub fn delete_all(app_data: &Path) -> Result<(), TranscriptionError> {
    match fs::remove_dir_all(check_dir(app_data)) {
        Err(error) if error.kind() != io::ErrorKind::NotFound => Err(TranscriptionError::new(
            TranscriptionErrorCode::IoFailure,
            "Cannot delete the speech check recordings. Close anything using them, then retry.",
        )),
        _ => Ok(()),
    }
}

struct Recording {
    index: u32,
    reference: String,
    path: PathBuf,
}

fn recordings(directory: &Path) -> Vec<Recording> {
    (1..=SENTENCES.len() as u32)
        .filter_map(|index| {
            let path = directory.join(format!("{}.wav", stem(index)));
            let reference =
                fs::read_to_string(directory.join(format!("{}.txt", stem(index)))).ok()?;
            path.is_file().then_some(Recording {
                index,
                reference,
                path,
            })
        })
        .collect()
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

/// Measures every named model on every recording: first plain, then (when `include_prompt`) with
/// the glossary as initial prompt. The measurements replace earlier ones of the same model and
/// prompt setting and are saved. Time covers the whole `whisper-cli` process, as the app uses it
/// today, so it includes loading the model.
pub fn run(
    binary: &Path,
    app_data: &Path,
    model_files: &[String],
    terms: &[String],
    include_prompt: bool,
    mut on_progress: impl FnMut(SpeechCheckProgress),
) -> Result<SpeechCheckResults, TranscriptionError> {
    let directory = check_dir(app_data);
    let recordings = recordings(&directory);
    if recordings.is_empty() {
        return Err(TranscriptionError::new(
            TranscriptionErrorCode::InvalidAudio,
            "Record at least one sentence before measuring.",
        ));
    }
    let mut models = Vec::new();
    for file in model_files {
        if !is_model_file_name(file) {
            return Err(TranscriptionError::new(
                TranscriptionErrorCode::ModelMissing,
                format!("{file} is not a Whisper model file."),
            ));
        }
        models.push((file.clone(), ready_model(&models_dir(app_data).join(file))?));
    }
    if models.is_empty() {
        return Err(TranscriptionError::new(
            TranscriptionErrorCode::ModelMissing,
            "No Whisper models are installed in the models folder.",
        ));
    }
    let prompt = if include_prompt {
        prompt_from_terms(terms)
    } else {
        None
    };
    let variants: &[bool] = if prompt.is_some() {
        &[false, true]
    } else {
        &[false]
    };
    let workspace = TemporaryDirectory::new().map_err(io_failure(
        "Cannot create a temporary workspace for the measurement. Please retry.",
    ))?;
    let total = (models.len() * variants.len() * recordings.len()) as u32;
    let mut done = 0;
    let mut runs = Vec::new();
    for (file, path) in &models {
        for &uses_prompt in variants {
            let mut results = Vec::new();
            for recording in &recordings {
                on_progress(SpeechCheckProgress {
                    model_file: file.clone(),
                    uses_prompt,
                    done,
                    total,
                });
                let started = Instant::now();
                let outcome = transcribe_file(
                    binary,
                    path,
                    &recording.path,
                    prompt.as_deref().filter(|_| uses_prompt),
                    workspace.path(),
                    0,
                );
                let time_ms = started.elapsed().as_millis() as u64;
                // Silence is a legitimate result of a poor reading, not a failed measurement.
                let transcript = match outcome {
                    Ok(transcript) => transcript.text,
                    Err(error) if error.code == TranscriptionErrorCode::NoSpeech => String::new(),
                    Err(error) => return Err(error),
                };
                results.push(score_recording(recording, transcript, time_ms, terms));
                done += 1;
            }
            runs.push(summarize(file, uses_prompt, results));
        }
    }
    on_progress(SpeechCheckProgress {
        model_file: String::new(),
        uses_prompt: false,
        done,
        total,
    });
    let mut merged = read_results(&directory);
    merged.runs.retain(|old| {
        !runs
            .iter()
            .any(|new| new.model_file == old.model_file && new.uses_prompt == old.uses_prompt)
    });
    merged.runs.extend(runs);
    merged
        .runs
        .sort_by(|a, b| (&a.model_file, a.uses_prompt).cmp(&(&b.model_file, b.uses_prompt)));
    let json = serde_json::to_vec(&merged).map_err(|_| {
        TranscriptionError::new(
            TranscriptionErrorCode::IoFailure,
            "Cannot save the measurements. Please retry.",
        )
    })?;
    private_files::write(&directory.join("results.json"), &json).map_err(io_failure(
        "Cannot save the measurements locally. Please retry.",
    ))?;
    Ok(merged)
}

fn score_recording(
    recording: &Recording,
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

/// Totals over the whole set: terms and errors are pooled, so a long sentence weighs more.
fn summarize(model_file: &str, uses_prompt: bool, recordings: Vec<RecordingResult>) -> ModelRun {
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
        measured_at_ms: now_ms(),
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
    use crate::providers::agy::runner::ScratchDirectory;

    fn wav() -> Vec<u8> {
        let mut wav = Vec::new();
        wav.extend_from_slice(b"RIFF");
        wav.extend_from_slice(&68_u32.to_le_bytes());
        wav.extend_from_slice(b"WAVEfmt ");
        wav.extend_from_slice(&16_u32.to_le_bytes());
        wav.extend_from_slice(&1_u16.to_le_bytes());
        wav.extend_from_slice(&1_u16.to_le_bytes());
        wav.extend_from_slice(&16_000_u32.to_le_bytes());
        wav.extend_from_slice(&32_000_u32.to_le_bytes());
        wav.extend_from_slice(&2_u16.to_le_bytes());
        wav.extend_from_slice(&16_u16.to_le_bytes());
        wav.extend_from_slice(b"data");
        wav.extend_from_slice(&32_u32.to_le_bytes());
        wav.extend_from_slice(&[0_u8; 32]);
        wav
    }

    #[test]
    fn saves_replaces_and_deletes_recordings_with_their_reference_text() {
        let directory = ScratchDirectory::new().unwrap();
        assert!(status(directory.path())
            .sentences
            .iter()
            .all(|s| !s.is_recorded));
        save_recording(directory.path(), 3, &wav()).unwrap();
        save_recording(directory.path(), 3, &wav()).unwrap();
        let status = status(directory.path());
        assert_eq!(status.sentences.iter().filter(|s| s.is_recorded).count(), 1);
        assert!(status.sentences[2].is_recorded);
        assert_eq!(
            fs::read_to_string(directory.path().join("speech-check/03.txt")).unwrap(),
            SENTENCES[2]
        );
        delete_all(directory.path()).unwrap();
        assert!(self::status(directory.path())
            .sentences
            .iter()
            .all(|s| !s.is_recorded));
        delete_all(directory.path()).unwrap();
    }

    #[test]
    fn rejects_an_unknown_sentence_and_audio_that_is_not_the_app_format() {
        let directory = ScratchDirectory::new().unwrap();
        for index in [0, 13] {
            assert_eq!(
                save_recording(directory.path(), index, &wav())
                    .unwrap_err()
                    .code,
                TranscriptionErrorCode::InvalidAudio
            );
        }
        assert_eq!(
            save_recording(directory.path(), 1, b"not a wav")
                .unwrap_err()
                .code,
            TranscriptionErrorCode::InvalidAudio
        );
    }

    #[test]
    fn summary_pools_terms_and_errors_and_reports_median_and_max_time() {
        let result = |index, reference: &str, transcript: &str, time_ms| {
            let recording = Recording {
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
        };
        let run = summarize(
            "ggml-base.en.bin",
            false,
            vec![
                result(1, "I tried the Gemini API", "I tried the Jimini IP", 900),
                result(2, "Gemini is fast", "Gemini is fast", 300),
                result(3, "Nothing special here", "Nothing special here", 600),
            ],
        );
        assert_eq!((run.terms_found, run.terms_total), (1, 2));
        assert_eq!(run.term_accuracy, Some(0.5));
        // 2 errors in 11 reference words.
        assert!((run.word_error_rate - 2.0 / 11.0).abs() < 1e-9);
        assert_eq!((run.median_ms, run.max_ms), (600, 900));
    }

    #[test]
    fn term_accuracy_is_absent_when_no_sentence_has_a_term() {
        let recording = Recording {
            index: 1,
            reference: "Hello there".into(),
            path: PathBuf::new(),
        };
        let run = summarize(
            "ggml-base.en.bin",
            false,
            vec![score_recording(&recording, "hello".into(), 5, &[])],
        );
        assert_eq!(run.term_accuracy, None);
    }

    #[cfg(unix)]
    fn fake_whisper(directory: &Path) -> PathBuf {
        use std::os::unix::fs::PermissionsExt;
        let script = directory.join("fake-whisper");
        // Writes a transcript naming the model; with --prompt it "recognises" the term correctly.
        fs::write(
            &script,
            r#"#!/bin/sh
while [ $# -gt 0 ]; do
  case "$1" in
    -m) model="$2";; -of) out="$2";; --prompt) prompt="$2";;
  esac
  shift
done
case "$model" in *small*) name=small;; *) name=base;; esac
if [ -n "$prompt" ]; then text="I tried the Gemini API"; else text="I tried the Jimini IP $name"; fi
printf '{"transcription":[{"text":" %s"}]}' "$text" > "$out.json"
"#,
        )
        .unwrap();
        fs::set_permissions(&script, fs::Permissions::from_mode(0o700)).unwrap();
        script
    }

    #[cfg(unix)]
    #[test]
    fn measures_each_model_with_and_without_the_prompt_and_keeps_the_results() {
        let directory = ScratchDirectory::new().unwrap();
        let app_data = directory.path();
        let binary = fake_whisper(app_data);
        fs::create_dir(models_dir(app_data)).unwrap();
        for model in ["ggml-base.en.bin", "ggml-small.en.bin"] {
            fs::write(models_dir(app_data).join(model), b"model").unwrap();
        }
        save_recording(app_data, 1, &wav()).unwrap();
        let terms = vec!["Gemini".to_string()];
        let models = vec![
            "ggml-base.en.bin".to_string(),
            "ggml-small.en.bin".to_string(),
        ];
        let mut progress = Vec::new();
        let results = run(&binary, app_data, &models, &terms, true, |step| {
            progress.push(step)
        })
        .unwrap();

        assert_eq!(results.runs.len(), 4);
        let plain = &results.runs[0];
        assert_eq!(
            (plain.model_file.as_str(), plain.uses_prompt),
            ("ggml-base.en.bin", false)
        );
        assert_eq!(plain.term_accuracy, Some(0.0));
        assert_eq!(plain.recordings[0].transcript, "I tried the Jimini IP base");
        let prompted = &results.runs[1];
        assert!(prompted.uses_prompt);
        assert_eq!(prompted.term_accuracy, Some(1.0));
        assert!(prompted.word_error_rate < plain.word_error_rate);
        assert_eq!(
            progress.first().map(|step| (step.done, step.total)),
            Some((0, 4))
        );
        assert_eq!(
            progress.last().map(|step| (step.done, step.total)),
            Some((4, 4))
        );

        // Measuring one model again replaces only its own rows.
        let again = run(&binary, app_data, &models[..1], &terms, false, |_| {}).unwrap();
        assert_eq!(again.runs.len(), 4);
        assert_eq!(status(app_data).results, again);
    }

    #[cfg(unix)]
    #[test]
    fn refuses_to_measure_without_recordings_or_with_a_missing_model() {
        let directory = ScratchDirectory::new().unwrap();
        let app_data = directory.path();
        let binary = fake_whisper(app_data);
        let models = vec!["ggml-base.en.bin".to_string()];
        assert_eq!(
            run(&binary, app_data, &models, &[], false, |_| {})
                .unwrap_err()
                .code,
            TranscriptionErrorCode::InvalidAudio
        );
        save_recording(app_data, 1, &wav()).unwrap();
        assert_eq!(
            run(&binary, app_data, &models, &[], false, |_| {})
                .unwrap_err()
                .code,
            TranscriptionErrorCode::ModelMissing
        );
        assert_eq!(
            run(
                &binary,
                app_data,
                &["../x.bin".to_string()],
                &[],
                false,
                |_| {}
            )
            .unwrap_err()
            .code,
            TranscriptionErrorCode::ModelMissing
        );
    }

    /// Proves the whole path with the real `whisper-cli` and `ggml-base.en.bin` from the app data
    /// folder on a macOS-synthesised reading: `cargo test real_whisper -- --ignored --nocapture`.
    #[cfg(target_os = "macos")]
    #[test]
    #[ignore = "needs whisper-cli, a downloaded model and macOS speech synthesis"]
    fn real_whisper_measures_a_synthetic_reading() {
        use std::process::Command;
        let home = std::env::var("HOME").unwrap();
        let installed = Path::new(&home)
            .join("Library/Application Support/com.user.english-trainer/models/ggml-base.en.bin");
        assert!(installed.is_file(), "download ggml-base.en.bin first");
        let directory = ScratchDirectory::new().unwrap();
        let app_data = directory.path();
        fs::create_dir(models_dir(app_data)).unwrap();
        std::os::unix::fs::symlink(&installed, models_dir(app_data).join("ggml-base.en.bin"))
            .unwrap();

        let aiff = app_data.join("reading.aiff");
        let wav_path = app_data.join("reading.wav");
        assert!(Command::new("say")
            .arg("-o")
            .arg(&aiff)
            .arg(SENTENCES[6])
            .status()
            .unwrap()
            .success());
        assert!(Command::new("afconvert")
            .args(["-f", "WAVE", "-d", "LEI16@16000", "-c", "1"])
            .arg(&aiff)
            .arg(&wav_path)
            .status()
            .unwrap()
            .success());
        save_recording(app_data, 7, &fs::read(&wav_path).unwrap()).unwrap();

        let binary = crate::audio::require_binary().unwrap();
        let terms: Vec<String> = crate::audio::SEED_GLOSSARY
            .iter()
            .map(|t| t.to_string())
            .collect();
        let models = vec!["ggml-base.en.bin".to_string()];
        let results = run(&binary, app_data, &models, &terms, true, |_| {}).unwrap();
        for run in &results.runs {
            println!(
                "prompt={} terms={}/{} wer={:.2} median={}ms heard={:?}",
                run.uses_prompt,
                run.terms_found,
                run.terms_total,
                run.word_error_rate,
                run.median_ms,
                run.recordings[0].transcript
            );
        }
        assert_eq!(results.runs.len(), 2);
        assert!(results
            .runs
            .iter()
            .all(|run| !run.recordings[0].transcript.is_empty()));
    }
}
