use super::{
    best_effort::ignore_process_already_gone, binaries::resolve_whisper_binary,
    temp::TemporaryDirectory,
};
use crate::speech_recognition::{
    domain::{without_annotations, Transcript},
    error::SpeechRecognitionError,
    ports::{OneOffTranscriber, PortResult},
};
use serde::Deserialize;
use std::{
    fs, io,
    path::{Path, PathBuf},
    process::{Command, Stdio},
    thread,
    time::{Duration, Instant},
};

const TIMEOUT: Duration = Duration::from_secs(120);

#[derive(Deserialize)]
struct WhisperOutput {
    transcription: Vec<WhisperSegment>,
}

#[derive(Deserialize)]
struct WhisperSegment {
    text: String,
}

pub(super) fn parse_output(
    json: &str,
    duration_ms: u64,
) -> Result<Transcript, SpeechRecognitionError> {
    let output: WhisperOutput = serde_json::from_str(json).map_err(|_| {
        SpeechRecognitionError::InvalidOutput(
            "Whisper returned invalid transcription data. Please retry.".into(),
        )
    })?;
    let text = output
        .transcription
        .iter()
        .map(|segment| without_annotations(&segment.text))
        .filter(|text| !text.is_empty())
        .collect::<Vec<_>>()
        .join(" ");
    if text.is_empty() {
        return Err(SpeechRecognitionError::NoSpeech);
    }
    Ok(Transcript::english(text, duration_ms))
}

pub(super) fn transcribe_once(
    binary: &Path,
    model: &Path,
    wav: &[u8],
    prompt: Option<&str>,
    duration_ms: u64,
) -> Result<Transcript, SpeechRecognitionError> {
    let directory = TemporaryDirectory::new().map_err(|_| {
        SpeechRecognitionError::Storage(
            "Cannot create temporary audio workspace. Please retry.".into(),
        )
    })?;
    let input = directory.path().join("recording.wav");
    fs::write(&input, wav).map_err(|_| {
        SpeechRecognitionError::Storage(
            "Cannot write temporary audio for transcription. Please retry.".into(),
        )
    })?;
    transcribe_file(binary, model, &input, prompt, directory.path(), duration_ms)
}

pub(super) fn missing_binary_error() -> SpeechRecognitionError {
    SpeechRecognitionError::EngineMissing("whisper-cli was not found. Install whisper.cpp or set ENG_TRAINER_WHISPER_BIN to its executable, then restart the app.".into())
}

fn require_binary() -> Result<PathBuf, SpeechRecognitionError> {
    resolve_whisper_binary().ok_or_else(missing_binary_error)
}

pub(super) fn transcribe_file(
    binary: &Path,
    model: &Path,
    input: &Path,
    prompt: Option<&str>,
    workspace: &Path,
    duration_ms: u64,
) -> Result<Transcript, SpeechRecognitionError> {
    let output_base = workspace.join("transcript");
    let mut command = Command::new(binary);
    command
        .current_dir(workspace)
        .arg("-m")
        .arg(model)
        .arg("-f")
        .arg(input)
        .args(["-l", "en", "-oj", "-of"])
        .arg(&output_base);
    if let Some(prompt) = prompt {
        command.arg("--prompt").arg(prompt);
    }
    let mut child = command
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|error| {
            let message =
                "Could not start local Whisper. Check ENG_TRAINER_WHISPER_BIN and permissions."
                    .to_string();
            if error.kind() == io::ErrorKind::NotFound {
                SpeechRecognitionError::EngineMissing(message)
            } else {
                SpeechRecognitionError::EngineFailed(message)
            }
        })?;
    let deadline = Instant::now() + TIMEOUT;
    loop {
        match child.try_wait() {
            Ok(Some(status)) => {
                if !status.success() {
                    return Err(SpeechRecognitionError::EngineFailed(
                        "Local Whisper failed to transcribe the recording. Please retry.".into(),
                    ));
                }
                break;
            }
            Ok(None) if Instant::now() < deadline => thread::sleep(Duration::from_millis(50)),
            Ok(None) => {
                stop_whisper(&mut child);
                return Err(SpeechRecognitionError::Timeout);
            }
            Err(_) => {
                stop_whisper(&mut child);
                return Err(SpeechRecognitionError::EngineFailed(
                    "Could not wait for local Whisper. Please retry.".into(),
                ));
            }
        }
    }
    let json = fs::read_to_string(output_base.with_extension("json")).map_err(|_| {
        SpeechRecognitionError::InvalidOutput(
            "Whisper did not produce a transcript. Please retry.".into(),
        )
    })?;
    parse_output(&json, duration_ms)
}

fn stop_whisper(child: &mut std::process::Child) {
    ignore_process_already_gone(child.kill());
    ignore_process_already_gone(child.wait());
}

pub struct CliTranscriber;

impl OneOffTranscriber for CliTranscriber {
    fn ensure_available(&self) -> PortResult<()> {
        require_binary().map(drop)
    }

    fn transcribe_file(
        &self,
        model: &Path,
        input: &Path,
        prompt: Option<&str>,
    ) -> PortResult<Transcript> {
        let binary = require_binary()?;
        let workspace = TemporaryDirectory::new().map_err(|_| {
            SpeechRecognitionError::Storage(
                "Cannot create a temporary workspace for the measurement. Please retry.".into(),
            )
        })?;
        transcribe_file(&binary, model, input, prompt, workspace.path(), 0)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn code_of(json: &str) -> SpeechRecognitionError {
        parse_output(json, 0).unwrap_err()
    }

    #[test]
    fn segments_become_one_transcript() {
        let transcript = parse_output(
            r#"{"transcription":[{"text":" Hello"},{"text":" world."}]}"#,
            123,
        )
        .unwrap();
        assert_eq!(transcript, Transcript::english("Hello world.".into(), 123));
    }

    #[test]
    fn malformed_output_is_invalid_output() {
        assert!(matches!(
            code_of("{}"),
            SpeechRecognitionError::InvalidOutput(_)
        ));
        assert!(matches!(
            code_of("{"),
            SpeechRecognitionError::InvalidOutput(_)
        ));
    }

    #[test]
    fn silence_and_annotations_are_no_speech() {
        for silent in [
            r#"{"transcription":[{"text":" "}]}"#,
            r#"{"transcription":[{"text":" [BLANK_AUDIO]"}]}"#,
            r#"{"transcription":[{"text":" [ Silence ]"},{"text":" (music)"}]}"#,
        ] {
            assert_eq!(code_of(silent), SpeechRecognitionError::NoSpeech);
        }
    }

    #[test]
    fn annotations_are_dropped_from_spoken_text() {
        let transcript = parse_output(
            r#"{"transcription":[{"text":" [BLANK_AUDIO] I deploy"},{"text":" with Docker. (coughs)"}]}"#,
            0,
        )
        .unwrap();
        assert_eq!(transcript.text, "I deploy with Docker.");
    }

    #[cfg(unix)]
    fn fake_whisper(directory: &Path) -> PathBuf {
        use std::os::unix::fs::PermissionsExt;
        let script = directory.join("fake-whisper");
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
if [ -n "$prompt" ]; then text="primed $name"; else text="plain $name"; fi
printf '{"transcription":[{"text":" %s"}]}' "$text" > "$out.json"
"#,
        )
        .unwrap();
        fs::set_permissions(&script, fs::Permissions::from_mode(0o700)).unwrap();
        script
    }

    #[cfg(unix)]
    #[test]
    fn the_one_off_run_passes_the_model_and_the_prompt_and_reads_the_transcript() {
        use crate::providers::agy::runner::ScratchDirectory;
        let directory = ScratchDirectory::new().unwrap();
        let binary = fake_whisper(directory.path());
        let input = directory.path().join("input.wav");
        fs::write(&input, b"audio").unwrap();
        let run = |model: &str, prompt: Option<&str>| {
            transcribe_file(
                &binary,
                Path::new(model),
                &input,
                prompt,
                directory.path(),
                0,
            )
            .unwrap()
            .text
        };
        assert_eq!(run("ggml-base.en.bin", None), "plain base");
        assert_eq!(
            run("ggml-small.en.bin", Some("Vocabulary: X.")),
            "primed small"
        );
    }
}
