mod error;
mod temp;
#[cfg(test)]
mod tests;

pub use error::{TranscriptionError, TranscriptionErrorCode};
use temp::TemporaryDirectory;

use serde::{Deserialize, Serialize};
use std::{
    fs, io,
    path::{Path, PathBuf},
    process::{Command, Stdio},
    thread,
    time::{Duration, Instant},
};

const MAX_WAV_BYTES: usize = 60 * 1024 * 1024;
const TIMEOUT: Duration = Duration::from_secs(120);
#[derive(Debug, Serialize)]
pub struct Transcript {
    pub text: String,
    pub language: String,
    pub duration_ms: u64,
}

#[derive(Deserialize)]
struct WhisperOutput {
    transcription: Vec<WhisperSegment>,
}

#[derive(Deserialize)]
struct WhisperSegment {
    text: String,
}

fn parse_output(json: &str, duration_ms: u64) -> Result<Transcript, TranscriptionError> {
    let output: WhisperOutput = serde_json::from_str(json).map_err(|_| {
        TranscriptionError::new(
            TranscriptionErrorCode::InvalidOutput,
            "Whisper returned invalid transcription data. Please retry.",
        )
    })?;
    let text = output
        .transcription
        .iter()
        .map(|segment| segment.text.trim())
        .filter(|text| !text.is_empty())
        .collect::<Vec<_>>()
        .join(" ");
    if text.is_empty() {
        return Err(TranscriptionError::new(
            TranscriptionErrorCode::NoSpeech,
            "No speech was recognized. Please record again.",
        ));
    }
    Ok(Transcript {
        text,
        language: "en".into(),
        duration_ms,
    })
}

fn validate_wav(wav: &[u8]) -> Result<u64, TranscriptionError> {
    let invalid = || {
        TranscriptionError::new(
            TranscriptionErrorCode::InvalidAudio,
            "Invalid WAV recording. Please record again.",
        )
    };
    if wav.len() < 44 || wav.len() > MAX_WAV_BYTES {
        return Err(TranscriptionError::new(
            TranscriptionErrorCode::InvalidAudio,
            "Recording is empty, invalid, or too long (maximum 60 MB). Please record again.",
        ));
    }
    if &wav[..4] != b"RIFF" || &wav[8..12] != b"WAVE" {
        return Err(invalid());
    }
    let riff_size = u32::from_le_bytes(wav[4..8].try_into().map_err(|_| invalid())?) as usize;
    if riff_size.checked_add(8) != Some(wav.len()) {
        return Err(invalid());
    }
    let (mut position, mut format, mut data_len) = (12usize, None, None);
    while position + 8 <= wav.len() {
        let size = u32::from_le_bytes(
            wav[position + 4..position + 8]
                .try_into()
                .map_err(|_| invalid())?,
        ) as usize;
        let start = position + 8;
        let end = start.checked_add(size).ok_or_else(invalid)?;
        if end > wav.len() {
            return Err(invalid());
        }
        match &wav[position..position + 4] {
            b"fmt " if size >= 16 => {
                let fields = &wav[start..start + 16];
                format = Some((
                    u16::from_le_bytes([fields[0], fields[1]]),
                    u16::from_le_bytes([fields[2], fields[3]]),
                    u32::from_le_bytes(fields[4..8].try_into().map_err(|_| invalid())?),
                    u16::from_le_bytes([fields[14], fields[15]]),
                ));
            }
            b"data" => data_len = Some(size),
            _ => {}
        }
        position = end.checked_add(size % 2).ok_or_else(invalid)?;
    }
    let Some((codec, channels, sample_rate, bits)) = format else {
        return Err(invalid());
    };
    if codec != 1 || channels != 1 || bits != 16 || sample_rate != 16_000 {
        return Err(TranscriptionError::new(
            TranscriptionErrorCode::InvalidAudio,
            "Whisper needs mono 16-bit PCM WAV at 16 kHz. Please record again.",
        ));
    }
    let bytes = data_len
        .filter(|size| *size > 0 && size % 2 == 0)
        .ok_or_else(invalid)?;
    Ok((bytes as u64 * 1000) / 32_000)
}

fn model_path(app_data: &Path) -> PathBuf {
    std::env::var_os("ENG_TRAINER_WHISPER_MODEL")
        .map(PathBuf::from)
        .unwrap_or_else(|| app_data.join("models/ggml-base.en.bin"))
}

pub fn transcribe(wav: Vec<u8>, app_data: PathBuf) -> Result<Transcript, TranscriptionError> {
    let duration_ms = validate_wav(&wav)?;
    let model = model_path(&app_data);
    if !model.is_file() {
        return Err(TranscriptionError::new(
            TranscriptionErrorCode::ModelMissing,
            format!(
                "Whisper model is missing at {}. Set ENG_TRAINER_WHISPER_MODEL to a local ggml model file, then restart the app.",
                model.display()
            ),
        ));
    }
    let model = fs::canonicalize(model).map_err(|_| {
        TranscriptionError::new(
            TranscriptionErrorCode::ModelMissing,
            "Cannot read the Whisper model. Check its permissions, then retry.",
        )
    })?;
    let directory = TemporaryDirectory::new().map_err(|_| {
        TranscriptionError::new(
            TranscriptionErrorCode::IoFailure,
            "Cannot create temporary audio workspace. Please retry.",
        )
    })?;
    let input = directory.path().join("recording.wav");
    let output_base = directory.path().join("transcript");
    fs::write(&input, wav).map_err(|_| {
        TranscriptionError::new(
            TranscriptionErrorCode::IoFailure,
            "Cannot write temporary audio for transcription. Please retry.",
        )
    })?;
    let binaries = match std::env::var_os("ENG_TRAINER_WHISPER_BIN") {
        Some(configured) => vec![PathBuf::from(configured)],
        None => vec![
            PathBuf::from("whisper-cli"),
            PathBuf::from("/opt/homebrew/bin/whisper-cli"),
            PathBuf::from("/usr/local/bin/whisper-cli"),
        ],
    };
    let mut child = None;
    for binary in binaries {
        let result = Command::new(&binary)
            .current_dir(directory.path())
            .arg("-m")
            .arg(&model)
            .arg("-f")
            .arg(&input)
            .args(["-l", "en", "-oj", "-of"])
            .arg(&output_base)
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn();
        match result {
            Ok(process) => {
                child = Some(process);
                break;
            }
            Err(error) if error.kind() == io::ErrorKind::NotFound => continue,
            Err(_) => {
                return Err(TranscriptionError::new(
                    TranscriptionErrorCode::EngineFailed,
                    "Could not start local Whisper. Check ENG_TRAINER_WHISPER_BIN and permissions.",
                ));
            }
        }
    }
    let mut child = child.ok_or_else(|| {
        TranscriptionError::new(
            TranscriptionErrorCode::EngineMissing,
            "whisper-cli was not found. Install whisper.cpp or set ENG_TRAINER_WHISPER_BIN to its executable, then restart the app.",
        )
    })?;
    let deadline = Instant::now() + TIMEOUT;
    loop {
        match child.try_wait() {
            Ok(Some(status)) => {
                if !status.success() {
                    return Err(TranscriptionError::new(
                        TranscriptionErrorCode::EngineFailed,
                        "Local Whisper failed to transcribe the recording. Please retry.",
                    ));
                }
                break;
            }
            Ok(None) if Instant::now() < deadline => thread::sleep(Duration::from_millis(50)),
            Ok(None) => {
                let _ = child.kill();
                let _ = child.wait();
                return Err(TranscriptionError::new(
                    TranscriptionErrorCode::Timeout,
                    "Local Whisper timed out. Try a shorter recording.",
                ));
            }
            Err(_) => {
                let _ = child.kill();
                let _ = child.wait();
                return Err(TranscriptionError::new(
                    TranscriptionErrorCode::EngineFailed,
                    "Could not wait for local Whisper. Please retry.",
                ));
            }
        }
    }
    let json = fs::read_to_string(output_base.with_extension("json")).map_err(|_| {
        TranscriptionError::new(
            TranscriptionErrorCode::InvalidOutput,
            "Whisper did not produce a transcript. Please retry.",
        )
    })?;
    parse_output(&json, duration_ms)
}
