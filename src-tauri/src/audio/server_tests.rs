use super::{
    server::{multipart_body, parse_server_output, ServerError, ServerState, WhisperServer},
    tests::valid_wav,
    Binaries, SpeechEngine, TranscriptionErrorCode,
};
use crate::providers::agy::runner::ScratchDirectory;
use std::{
    fs,
    path::{Path, PathBuf},
    process::Command,
};

/// Speaks just enough of `whisper-server`'s HTTP interface: it answers `/inference` with the
/// model's file name, the prompt and the size of the audio it received, so a test can see what
/// the request carried.
const FAKE_SERVER: &str = r#"#!/usr/bin/env python3
import json, re, sys
from http.server import BaseHTTPRequestHandler, HTTPServer
args = sys.argv[1:]
model = args[args.index("-m") + 1].rsplit("/", 1)[-1]
port = int(args[args.index("--port") + 1])
assert args[args.index("--host") + 1] == "127.0.0.1"

class Handler(BaseHTTPRequestHandler):
    def do_POST(self):
        body = self.rfile.read(int(self.headers["Content-Length"]))
        prompt = re.search(rb'name="prompt"\r\n\r\n(.*?)\r\n--', body, re.S)
        audio = re.search(rb'name="file"; filename="[^"]*"\r\nContent-Type: audio/wav\r\n\r\n(.*)\r\n--[^\r]*--\r\n$', body, re.S)
        text = " %s|%s|%d" % (model, prompt.group(1).decode() if prompt else "-", len(audio.group(1)))
        data = json.dumps({"text": text}).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, *args):
        pass

HTTPServer(("127.0.0.1", port), Handler).serve_forever()
"#;

const CRASHING_SERVER: &str = "#!/bin/sh\nexit 3\n";

/// Writes `ggml-*.bin` stand-ins the engine accepts as installed models.
fn model(directory: &Path, name: &str) -> PathBuf {
    let path = directory.join(name);
    fs::write(&path, b"model").unwrap();
    fs::canonicalize(path).unwrap()
}

fn script(directory: &Path, name: &str, source: &str) -> PathBuf {
    let path = directory.join(name);
    fs::write(&path, source).unwrap();
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(&path, fs::Permissions::from_mode(0o755)).unwrap();
    }
    path
}

fn is_running(pid: u32) -> bool {
    Command::new("kill")
        .args(["-0", &pid.to_string()])
        .stderr(std::process::Stdio::null())
        .status()
        .is_ok_and(|status| status.success())
}

struct Fixture {
    directory: ScratchDirectory,
    server: PathBuf,
    small: PathBuf,
    base: PathBuf,
}

fn fixture() -> Fixture {
    let directory = ScratchDirectory::new().unwrap();
    let server = script(directory.path(), "whisper-server", FAKE_SERVER);
    let small = model(directory.path(), "ggml-small.en.bin");
    let base = model(directory.path(), "ggml-base.en.bin");
    Fixture {
        directory,
        server,
        small,
        base,
    }
}

#[test]
fn the_request_is_the_form_whisper_server_reads() {
    let body = multipart_body("XYZ", b"RIFFdata", Some("Vocabulary: Tauri."));
    let text = String::from_utf8_lossy(&body);
    assert_eq!(
        text,
        "--XYZ\r\nContent-Disposition: form-data; name=\"prompt\"\r\n\r\nVocabulary: Tauri.\r\n\
         --XYZ\r\nContent-Disposition: form-data; name=\"language\"\r\n\r\nen\r\n\
         --XYZ\r\nContent-Disposition: form-data; name=\"response_format\"\r\n\r\njson\r\n\
         --XYZ\r\nContent-Disposition: form-data; name=\"file\"; filename=\"answer.wav\"\r\n\
         Content-Type: audio/wav\r\n\r\nRIFFdata\r\n--XYZ--\r\n"
    );
    let without_prompt = String::from_utf8_lossy(&multipart_body("XYZ", b"w", None)).into_owned();
    assert!(!without_prompt.contains("name=\"prompt\""));
}

#[test]
fn the_audio_bytes_travel_unchanged() {
    let audio: Vec<u8> = (0..=255).collect();
    let body = multipart_body("B", &audio, None);
    let start = body
        .windows(4)
        .position(|window| window == b"\r\n\r\n")
        .and_then(|_| body.windows(10).position(|w| w == b"audio/wav\r"))
        .unwrap()
        + b"audio/wav\r\n\r\n".len();
    assert_eq!(&body[start..start + audio.len()], audio.as_slice());
}

#[test]
fn server_answers_become_transcripts_and_silence_is_no_speech() {
    let transcript = parse_server_output(r#"{"text":" Hello [BLANK_AUDIO]\n world."}"#, 7).unwrap();
    assert_eq!(transcript.text, "Hello world.");
    assert_eq!(transcript.duration_ms, 7);
    assert_eq!(
        parse_server_output(r#"{"text":" [BLANK_AUDIO]"}"#, 0)
            .unwrap_err()
            .code,
        TranscriptionErrorCode::NoSpeech
    );
    assert_eq!(
        parse_server_output(r#"{"error":"bad"}"#, 0)
            .unwrap_err()
            .code,
        TranscriptionErrorCode::InvalidOutput
    );
}

#[test]
fn the_model_is_loaded_once_and_serves_every_request() {
    let f = fixture();
    let server = WhisperServer::new(None);
    assert_eq!(server.status().state, ServerState::NotRunning);
    let wav = valid_wav();
    let first = server
        .transcribe(&f.server, &f.small, &wav, Some("Vocabulary: Tauri."), 1)
        .unwrap();
    assert_eq!(
        first.text,
        format!("ggml-small.en.bin|Vocabulary: Tauri.|{}", wav.len())
    );
    let pid = server.pid().unwrap();
    assert_eq!(server.status().state, ServerState::Ready);
    let second = server
        .transcribe(&f.server, &f.small, &wav, None, 1)
        .unwrap();
    assert_eq!(second.text, format!("ggml-small.en.bin|-|{}", wav.len()));
    assert_eq!(server.pid(), Some(pid));
}

#[test]
fn a_dead_server_is_restarted_once_and_then_given_up_on() {
    let f = fixture();
    let server = WhisperServer::new(None);
    let wav = valid_wav();
    server
        .transcribe(&f.server, &f.small, &wav, None, 1)
        .unwrap();
    let first_pid = server.pid().unwrap();

    server.kill_child();
    assert_eq!(server.status().state, ServerState::NotRunning);
    server
        .transcribe(&f.server, &f.small, &wav, None, 1)
        .unwrap();
    let second_pid = server.pid().unwrap();
    assert_ne!(second_pid, first_pid);

    // It answered, so the next death is again the first one.
    server.kill_child();
    server
        .transcribe(&f.server, &f.small, &wav, None, 1)
        .unwrap();
    assert_ne!(server.pid().unwrap(), second_pid);

    // Dying twice with no answer in between ends the restarts.
    server.kill_child();
    server.ensure(&f.server, &f.small, false).unwrap();
    server.kill_child();
    let error = server.ensure(&f.server, &f.small, false).unwrap_err();
    assert!(error.contains("keeps stopping"), "{error}");
    assert_eq!(server.status().failure.as_deref(), Some(error.as_str()));
    // A new session gives it another chance.
    server.ensure(&f.server, &f.small, true).unwrap();
    assert_eq!(server.status().state, ServerState::Ready);
}

#[test]
fn choosing_another_model_replaces_the_server() {
    let f = fixture();
    let server = WhisperServer::new(None);
    let wav = valid_wav();
    server
        .transcribe(&f.server, &f.small, &wav, None, 1)
        .unwrap();
    let small_pid = server.pid().unwrap();
    let base = server
        .transcribe(&f.server, &f.base, &wav, None, 1)
        .unwrap();
    assert!(base.text.starts_with("ggml-base.en.bin|"));
    assert!(!is_running(small_pid));
    assert_ne!(server.pid(), Some(small_pid));
}

#[test]
fn shutting_down_leaves_no_process() {
    let f = fixture();
    let server = WhisperServer::new(None);
    server.ensure(&f.server, &f.small, false).unwrap();
    let pid = server.pid().unwrap();
    server.shutdown();
    assert!(!is_running(pid));
    assert_eq!(server.status().state, ServerState::NotRunning);

    let dropped = WhisperServer::new(None);
    dropped.ensure(&f.server, &f.small, false).unwrap();
    let pid = dropped.pid().unwrap();
    drop(dropped);
    assert!(!is_running(pid));
}

#[test]
fn a_server_that_cannot_start_is_unavailable_and_not_retried_for_the_same_model() {
    let f = fixture();
    let crashing = script(f.directory.path(), "crashing-server", CRASHING_SERVER);
    let server = WhisperServer::new(None);
    let wav = valid_wav();
    let error = server
        .transcribe(&crashing, &f.small, &wav, None, 1)
        .unwrap_err();
    assert!(matches!(error, ServerError::Unavailable(_)), "{error:?}");
    let status = server.status();
    assert_eq!(status.state, ServerState::NotRunning);
    assert!(status.failure.is_some());
    // Same model: no second slow start. Another model, or a new session, tries again.
    assert!(server.ensure(&f.server, &f.small, false).is_err());
    assert!(server.ensure(&f.server, &f.base, false).is_ok());
    assert!(server.ensure(&f.server, &f.small, true).is_ok());

    let missing = f.directory.path().join("no-such-server");
    assert!(matches!(
        WhisperServer::new(None).transcribe(&missing, &f.small, &wav, None, 1),
        Err(ServerError::Unavailable(_))
    ));
}

#[test]
fn silence_is_reported_by_the_server_path_without_falling_back() {
    let f = fixture();
    let silent = script(
        f.directory.path(),
        "silent-server",
        &FAKE_SERVER.replace(
            r#"text = " %s|%s|%d" % (model, prompt.group(1).decode() if prompt else "-", len(audio.group(1)))"#,
            r#"text = " [BLANK_AUDIO]""#,
        ),
    );
    let engine = SpeechEngine::new(None);
    let binaries = Binaries {
        server: Some(silent),
        cli: None,
    };
    let error = engine
        .transcribe_with(&binaries, valid_wav(), &f.small, None)
        .unwrap_err();
    assert_eq!(error.code, TranscriptionErrorCode::NoSpeech);
}

const FAKE_CLI: &str = r#"#!/bin/sh
while [ $# -gt 0 ]; do
  if [ "$1" = "-of" ]; then out="$2"; fi
  shift
done
printf '{"transcription":[{"text":" from the one-off run"}]}' > "$out.json"
"#;

#[test]
fn without_a_usable_server_the_one_off_run_transcribes() {
    let f = fixture();
    let cli = script(f.directory.path(), "whisper-cli", FAKE_CLI);
    let crashing = script(f.directory.path(), "crashing-server", CRASHING_SERVER);
    let engine = SpeechEngine::new(None);

    for server in [Some(crashing), None] {
        let binaries = Binaries {
            server,
            cli: Some(cli.clone()),
        };
        let transcript = engine
            .transcribe_with(&binaries, valid_wav(), &f.small, Some("Vocabulary: Tauri."))
            .unwrap();
        assert_eq!(transcript.text, "from the one-off run");
    }

    let nothing = Binaries {
        server: None,
        cli: None,
    };
    assert_eq!(
        engine
            .transcribe_with(&nothing, valid_wav(), &f.small, None)
            .unwrap_err()
            .code,
        TranscriptionErrorCode::EngineMissing
    );
}

#[test]
fn live_updates_use_a_loaded_model_only_and_never_start_one() {
    let f = fixture();
    let engine = SpeechEngine::new(None);
    let wav = valid_wav();
    assert_eq!(
        engine.transcribe_partial(&f.small, &wav, Some("Vocabulary: Tauri.")),
        None
    );
    assert_eq!(engine.server_status().state, ServerState::NotRunning);

    let binaries = Binaries {
        server: Some(f.server.clone()),
        cli: None,
    };
    engine
        .transcribe_with(&binaries, wav.clone(), &f.small, None)
        .unwrap();
    assert_eq!(
        engine
            .transcribe_partial(&f.small, &wav, Some("Vocabulary: Tauri."))
            .as_deref(),
        Some(format!("ggml-small.en.bin|Vocabulary: Tauri.|{}", wav.len()).as_str())
    );
    // Another model is not loaded, so there is no live text for it.
    assert_eq!(engine.transcribe_partial(&f.base, &wav, None), None);
}

#[test]
fn a_server_left_by_a_crashed_run_is_stopped_before_the_next_start() {
    let f = fixture();
    let pid_file = f.directory.path().join("whisper-server.pid");
    let crashed_run = WhisperServer::new(Some(pid_file.clone()));
    crashed_run.ensure(&f.server, &f.small, false).unwrap();
    let leftover = crashed_run.pid().unwrap();
    assert_eq!(fs::read_to_string(&pid_file).unwrap(), leftover.to_string());

    let next_run = WhisperServer::new(Some(pid_file.clone()));
    next_run.ensure(&f.server, &f.small, false).unwrap();
    // Asking the old run's handle reaps the process the new run stopped.
    assert_eq!(crashed_run.status().state, ServerState::NotRunning);
    let current = next_run.pid().unwrap();
    assert_ne!(current, leftover);
    assert_eq!(fs::read_to_string(&pid_file).unwrap(), current.to_string());
    // Dropping the old run would delete the pid note the new run now owns.
    std::mem::forget(crashed_run);
}

/// Real check: needs Homebrew's whisper-server and the models and speech-check recordings in the
/// app data folder. Run with `cargo test --manifest-path src-tauri/Cargo.toml -- --ignored --nocapture`.
#[test]
#[ignore = "needs whisper-server, ggml-small.en.bin and the speech-check recordings"]
fn the_real_server_transcribes_a_speech_check_recording_quickly() {
    let data = PathBuf::from(std::env::var("HOME").unwrap())
        .join("Library/Application Support/com.user.english-trainer");
    let model = data.join("models/ggml-small.en.bin");
    let wavs: Vec<PathBuf> = (1..=3)
        .map(|n| data.join(format!("speech-check/{n:02}.wav")))
        .collect();
    let binaries = Binaries {
        server: super::resolve_server_binary(),
        cli: None,
    };
    assert!(binaries.server.is_some(), "whisper-server is not installed");
    let engine = SpeechEngine::new(None);
    let prompt =
        "Vocabulary: Gemini, Claude Code, Tauri, Rust, TypeScript, Kubernetes, idempotent.";
    for (index, wav) in wavs.iter().enumerate() {
        let started = std::time::Instant::now();
        let transcript = engine
            .transcribe_with(&binaries, fs::read(wav).unwrap(), &model, Some(prompt))
            .unwrap();
        println!(
            "{} {:?}: {} -> {}",
            if index == 0 {
                "first (loads the model)"
            } else {
                "warm"
            },
            started.elapsed(),
            wav.display(),
            transcript.text
        );
    }
    engine.shutdown();
}
