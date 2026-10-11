use super::*;
#[test]
fn rejects_unsupported_voice_rate_and_text_before_inference() {
    for (text, voice, rate) in [
        ("", 0, 1.),
        ("hello\0world", 0, 1.),
        ("Hi", 10, 1.),
        ("Hi", 0, f32::NAN),
        ("Hi", 0, 1.3),
    ] {
        assert_eq!(
            validate(text, voice, rate).unwrap_err().code,
            VoiceErrorCode::InvalidInput
        );
    }
    assert!(validate("Let's try it!", 9, 0.85).is_ok());
    assert!(validate(&"a".repeat(4097), 0, 1.).is_err());
}
#[test]
fn unavailable_engine_never_starts_in_a_conversation_turn() {
    let engine = VoiceEngine::new(None);
    assert!(!engine.prewarm().unwrap());
    assert_eq!(
        engine.synthesize("Hi", 0, 1.).unwrap_err().code,
        VoiceErrorCode::Unavailable
    );
}
#[test]
fn malformed_or_truncated_frames_are_bounded() {
    for size in [0u32, 43, u32::MAX] {
        assert!(process::read_frame(&mut std::io::Cursor::new(size.to_le_bytes())).is_err());
    }
    let mut data = 44u32.to_le_bytes().to_vec();
    data.extend([0; 10]);
    assert!(process::read_frame(&mut std::io::Cursor::new(data)).is_err());
}

#[cfg(unix)]
fn fake_helper(stalls: bool) -> (VoiceEngine, std::path::PathBuf) {
    use std::os::unix::fs::PermissionsExt;
    static NEXT: std::sync::atomic::AtomicUsize = std::sync::atomic::AtomicUsize::new(0);
    let path = std::env::temp_dir().join(format!(
        "english-trainer-voice-test-{}-{}",
        std::process::id(),
        NEXT.fetch_add(1, std::sync::atomic::Ordering::Relaxed)
    ));
    std::fs::create_dir_all(&path).unwrap();
    let tail = if stalls {
        "exec sleep 30"
    } else {
        "while [ $(dd bs=1 count=15 2>/dev/null | wc -c) -eq 15 ]; do wave; done"
    };
    let script = format!("#!/bin/sh\nwave() {{ printf '\\054\\000\\000\\000RIFF\\044\\000\\000\\000WAVEfmt \\020\\000\\000\\000\\001\\000\\001\\000\\200\\076\\000\\000\\000\\175\\000\\000\\002\\000\\020\\000data\\000\\000\\000\\000'; }}\nprintf TTS1\ndd bs=1 count=15 >/dev/null 2>/dev/null\nwave\n{tail}\n");
    let binary = path.join("speech");
    std::fs::write(&binary, script).unwrap();
    std::fs::set_permissions(binary, std::fs::Permissions::from_mode(0o700)).unwrap();
    (VoiceEngine::new(Some(path.clone())), path)
}
#[cfg(unix)]
#[test]
fn persistent_helper_reuses_ready_model_and_reports_busy_without_waiting() {
    let (engine, path) = fake_helper(false);
    assert!(engine.prewarm().unwrap());
    assert!(engine.prewarm().unwrap());
    assert_eq!(engine.synthesize("Hi!", 0, 1.).unwrap().len(), 44);
    let lock = engine.running.lock().unwrap();
    assert_eq!(
        engine.synthesize("Hi!", 0, 1.).unwrap_err().code,
        VoiceErrorCode::Busy
    );
    drop(lock);
    drop(engine);
    std::fs::remove_dir_all(path).unwrap();
}
#[cfg(unix)]
#[test]
fn stalled_inference_is_killed_and_can_be_prewarmed_again() {
    let (engine, path) = fake_helper(true);
    assert!(engine.prewarm().unwrap());
    let started = std::time::Instant::now();
    assert_eq!(
        engine.synthesize("Hi!", 0, 1.).unwrap_err().code,
        VoiceErrorCode::Timeout
    );
    assert!(started.elapsed() < std::time::Duration::from_secs(2));
    assert!(!engine.ready.load(std::sync::atomic::Ordering::Acquire));
    assert!(engine.prewarm().unwrap());
    drop(engine);
    std::fs::remove_dir_all(path).unwrap();
}

#[test]
#[ignore = "Runs the real bundled model; opt-in hardware latency regression check"]
fn real_bundled_voice_latency_and_padding() {
    let directory =
        std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("binaries/natural-voice");
    let engine = VoiceEngine::new(Some(directory));
    let start = std::time::Instant::now();
    assert!(engine.prewarm().unwrap());
    let prewarm_ms = start.elapsed().as_millis();
    let lines = [
        "Hi!",
        "That sounds like a useful approach.",
        "What would you try first?",
        "Hi! What have you been up to today?",
        "I usually start by breaking the problem down.",
    ];
    let mut timings = Vec::new();
    for _ in 0..3 {
        for line in lines {
            let start = std::time::Instant::now();
            let audio = engine.synthesize(line, 0, 1.).unwrap();
            timings.push(start.elapsed().as_millis());
            if let Ok(path) = std::env::var("ENG_TRAINER_VOICE_SAMPLE") {
                std::fs::write(path, audio).unwrap();
            }
        }
    }
    timings.sort();
    println!("real_local_voice: prewarm_ms={prewarm_ms} samples={} median_ms={} p95_ms={} max_ms={} metric=IPC_WAV_generation_with_padding_trim_not_speaker_onset",timings.len(),timings[timings.len()/2],timings[timings.len()-1],timings[timings.len()-1]);
    assert!(timings[timings.len() - 1] <= 750);
}
