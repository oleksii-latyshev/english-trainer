use super::process::Running;
use crate::voice::{domain::SynthesisRequest, error::VoiceError, ports::SpeechEngine};
use std::{
    path::PathBuf,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    },
    time::Duration,
};

const WARMUP_TEXT: &str = "Hi!";
const WARMUP_DEADLINE: Duration = Duration::from_secs(3);

#[derive(Clone)]
pub struct SupertonicEngine {
    directory: Option<PathBuf>,
    running: Arc<Mutex<Option<Running>>>,
    ready: Arc<AtomicBool>,
}

impl SupertonicEngine {
    pub fn new(directory: Option<PathBuf>) -> Self {
        Self {
            directory,
            running: Arc::new(Mutex::new(None)),
            ready: Arc::new(AtomicBool::new(false)),
        }
    }

    fn discard(&self, slot: &mut Option<Running>) {
        self.ready.store(false, Ordering::Release);
        *slot = None;
    }
}

impl SpeechEngine for SupertonicEngine {
    fn prewarm(&self) -> Result<bool, VoiceError> {
        let mut slot = self.running.lock().unwrap_or_else(|p| p.into_inner());
        if self.ready.load(Ordering::Acquire) {
            return Ok(true);
        }
        let directory = self
            .directory
            .as_ref()
            .filter(|path| path.join("speech").is_file());
        let Some(directory) = directory else {
            return Ok(false);
        };
        let mut running = Running::spawn(directory)?;
        let warmup = SynthesisRequest::new(WARMUP_TEXT, 0, 1.0)?;
        running.request(&warmup, WARMUP_DEADLINE)?;
        *slot = Some(running);
        self.ready.store(true, Ordering::Release);
        Ok(true)
    }

    fn render(
        &self,
        request: &SynthesisRequest,
        deadline: Duration,
    ) -> Result<Vec<u8>, VoiceError> {
        let mut slot = self.running.try_lock().map_err(|_| VoiceError::Busy)?;
        let Some(running) = slot.as_mut() else {
            return Err(VoiceError::Unavailable);
        };
        let result = running.request(request, deadline);
        if result.is_err() {
            self.discard(&mut slot);
        }
        result
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::AtomicUsize;

    #[cfg(unix)]
    fn fake_helper(stalls: bool) -> (SupertonicEngine, PathBuf) {
        use std::os::unix::fs::PermissionsExt;
        static NEXT: AtomicUsize = AtomicUsize::new(0);
        let path = std::env::temp_dir().join(format!(
            "english-trainer-voice-test-{}-{}",
            std::process::id(),
            NEXT.fetch_add(1, Ordering::Relaxed)
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
        (SupertonicEngine::new(Some(path.clone())), path)
    }

    fn hello() -> SynthesisRequest {
        SynthesisRequest::new("Hi!", 0, 1.0).unwrap()
    }

    #[test]
    fn a_missing_model_reports_unavailable_and_never_starts_in_a_turn() {
        let engine = SupertonicEngine::new(None);

        assert!(!engine.prewarm().unwrap());
        assert_eq!(
            engine
                .render(&hello(), Duration::from_millis(750))
                .unwrap_err(),
            VoiceError::Unavailable
        );
    }

    #[cfg(unix)]
    #[test]
    fn persistent_helper_reuses_ready_model_and_reports_busy_without_waiting() {
        let (engine, path) = fake_helper(false);
        assert!(engine.prewarm().unwrap());
        assert!(engine.prewarm().unwrap());
        assert_eq!(
            engine
                .render(&hello(), Duration::from_millis(750))
                .unwrap()
                .len(),
            44
        );
        let lock = engine.running.lock().unwrap();
        assert_eq!(
            engine
                .render(&hello(), Duration::from_millis(750))
                .unwrap_err(),
            VoiceError::Busy
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
            engine
                .render(&hello(), Duration::from_millis(750))
                .unwrap_err(),
            VoiceError::Timeout
        );
        assert!(started.elapsed() < Duration::from_secs(2));
        assert!(!engine.ready.load(Ordering::Acquire));
        assert!(engine.prewarm().unwrap());
        drop(engine);
        std::fs::remove_dir_all(path).unwrap();
    }

    #[test]
    #[ignore = "Runs the real bundled model; opt-in hardware latency regression check"]
    fn real_bundled_voice_latency() {
        let directory = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("binaries/natural-voice");
        let engine = SupertonicEngine::new(Some(directory));
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
                let request = SynthesisRequest::new(line, 0, 1.0).unwrap();
                let start = std::time::Instant::now();
                engine.render(&request, Duration::from_secs(3)).unwrap();
                timings.push(start.elapsed().as_millis());
            }
        }
        timings.sort();
        println!(
            "real_local_voice: prewarm_ms={prewarm_ms} samples={} median_ms={} max_ms={}",
            timings.len(),
            timings[timings.len() / 2],
            timings[timings.len() - 1]
        );
        assert!(timings[timings.len() - 1] <= 3000);
    }
}
