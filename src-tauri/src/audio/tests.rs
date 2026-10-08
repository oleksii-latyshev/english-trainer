use super::*;

fn valid_wav() -> Vec<u8> {
    let mut wav = Vec::new();
    wav.extend_from_slice(b"RIFF");
    wav.extend_from_slice(&36_u32.to_le_bytes());
    wav.extend_from_slice(b"WAVEfmt ");
    wav.extend_from_slice(&16_u32.to_le_bytes());
    wav.extend_from_slice(&1_u16.to_le_bytes());
    wav.extend_from_slice(&1_u16.to_le_bytes());
    wav.extend_from_slice(&16_000_u32.to_le_bytes());
    wav.extend_from_slice(&32_000_u32.to_le_bytes());
    wav.extend_from_slice(&2_u16.to_le_bytes());
    wav.extend_from_slice(&16_u16.to_le_bytes());
    wav.extend_from_slice(b"data");
    wav.extend_from_slice(&0_u32.to_le_bytes());
    wav.extend_from_slice(&[0_u8; 32]);
    wav[4..8].copy_from_slice(&68_u32.to_le_bytes());
    wav[40..44].copy_from_slice(&32_u32.to_le_bytes());
    wav
}

#[test]
fn validates_wav_and_duration() {
    assert_eq!(validate_wav(&valid_wav()), Ok(1));
    let mut wav = valid_wav();
    wav[24..28].copy_from_slice(&48_000_u32.to_le_bytes());
    assert_eq!(
        validate_wav(&wav).unwrap_err().code,
        TranscriptionErrorCode::InvalidAudio
    );
    assert_eq!(
        validate_wav(&[]).unwrap_err().code,
        TranscriptionErrorCode::InvalidAudio
    );
    assert_eq!(
        validate_wav(b"not a wav").unwrap_err().code,
        TranscriptionErrorCode::InvalidAudio
    );
}

#[test]
fn parses_segments_and_rejects_bad_output() {
    let transcript = parse_output(
        r#"{"transcription":[{"text":" Hello"},{"text":" world."}]}"#,
        123,
    )
    .unwrap();
    assert_eq!(transcript.text, "Hello world.");
    assert_eq!(transcript.language, "en");
    assert_eq!(transcript.duration_ms, 123);
    assert_eq!(
        parse_output("{}", 0).unwrap_err().code,
        TranscriptionErrorCode::InvalidOutput
    );
    assert_eq!(
        parse_output(r#"{"transcription":[{"text":" "}]}"#, 0)
            .unwrap_err()
            .code,
        TranscriptionErrorCode::NoSpeech
    );
    assert_eq!(
        parse_output("{", 0).unwrap_err().code,
        TranscriptionErrorCode::InvalidOutput
    );
}

#[test]
fn non_speech_annotations_are_dropped_and_silence_is_no_speech() {
    for silent in [
        r#"{"transcription":[{"text":" [BLANK_AUDIO]"}]}"#,
        r#"{"transcription":[{"text":" [ Silence ]"},{"text":" (music)"}]}"#,
    ] {
        assert_eq!(
            parse_output(silent, 0).unwrap_err().code,
            TranscriptionErrorCode::NoSpeech
        );
    }
    let transcript = parse_output(
        r#"{"transcription":[{"text":" [BLANK_AUDIO] I deploy"},{"text":" with Docker. (coughs)"}]}"#,
        0,
    )
    .unwrap();
    assert_eq!(transcript.text, "I deploy with Docker.");
}

#[test]
fn serializes_error_code_for_ipc_recovery() {
    let error = TranscriptionError::new(TranscriptionErrorCode::ModelMissing, "Install the model.");
    assert_eq!(
        serde_json::to_value(error).unwrap(),
        serde_json::json!({"code": "model_missing", "message": "Install the model."})
    );
}

#[test]
fn whisper_resolver_honors_explicit_path_without_fallback() {
    let configured = std::ffi::OsString::from("/configured/whisper-cli");
    let path = std::ffi::OsString::from("/unused");
    assert_eq!(
        resolve_whisper_binary_from(Some(configured), Some(path)),
        Some(PathBuf::from("/configured/whisper-cli"))
    );
}

#[test]
fn whisper_resolver_finds_executable_from_injected_path() {
    use std::{
        fs,
        sync::atomic::{AtomicU64, Ordering},
        time::{SystemTime, UNIX_EPOCH},
    };
    static NEXT: AtomicU64 = AtomicU64::new(0);

    let stamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    let directory = std::env::temp_dir().join(format!(
        "whisper-resolver-{}-{stamp}-{}",
        std::process::id(),
        NEXT.fetch_add(1, Ordering::Relaxed)
    ));
    fs::create_dir(&directory).unwrap();
    let binary = directory.join("whisper-cli");
    fs::write(&binary, b"#!/bin/sh\n").unwrap();
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(&binary, fs::Permissions::from_mode(0o700)).unwrap();
    }
    let search_path = std::env::join_paths([&directory]).unwrap();
    assert_eq!(
        resolve_whisper_binary_from(None, Some(search_path)),
        Some(binary)
    );
    let _ = fs::remove_dir_all(directory);
}
