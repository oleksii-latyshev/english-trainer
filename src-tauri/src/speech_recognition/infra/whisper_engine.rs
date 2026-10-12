use super::{
    best_effort::ignore_start_outcome_reported_by_status,
    binaries::{resolve_server_binary, resolve_whisper_binary},
    model_files::ready_model,
    whisper_cli::{missing_binary_error, transcribe_once},
    whisper_server::{ServerError, WhisperServer},
};
use crate::speech_recognition::{
    domain::{validate_wav, ServerStatus, Transcript},
    ports::{PortResult, TranscriptionEngine},
};
use std::{
    path::{Path, PathBuf},
    sync::atomic::{AtomicBool, Ordering},
    thread,
    time::{Duration, Instant},
};

const RESCUE_DEADLINE: Duration = Duration::from_secs(3);
const RESCUE_POLL: Duration = Duration::from_millis(20);

pub struct WhisperEngine {
    server: WhisperServer,
    pub(super) partial_running: AtomicBool,
}

pub(super) struct Binaries {
    pub server: Option<PathBuf>,
    pub cli: Option<PathBuf>,
}

impl Binaries {
    fn resolve() -> Self {
        Self {
            server: resolve_server_binary(),
            cli: resolve_whisper_binary(),
        }
    }
}

impl WhisperEngine {
    pub fn new(pid_file: Option<PathBuf>) -> Self {
        Self {
            server: WhisperServer::new(pid_file),
            partial_running: AtomicBool::new(false),
        }
    }

    pub(super) fn transcribe_with(
        &self,
        binaries: &Binaries,
        wav: Vec<u8>,
        model: &Path,
        prompt: Option<&str>,
    ) -> PortResult<Transcript> {
        let duration_ms = validate_wav(&wav)?;
        let model = ready_model(model)?;
        if let Some(server_binary) = &binaries.server {
            match self
                .server
                .transcribe(server_binary, &model, &wav, prompt, duration_ms)
            {
                Ok(transcript) => return Ok(transcript),
                Err(ServerError::Failed(error)) => return Err(error),
                Err(ServerError::Unavailable(reason)) => {
                    eprintln!("whisper-server is not used, running whisper-cli instead: {reason}");
                }
            }
        }
        let cli = binaries.cli.clone().ok_or_else(missing_binary_error)?;
        transcribe_once(&cli, &model, &wav, prompt, duration_ms)
    }

    fn try_claim_partial_slot(&self) -> bool {
        !self.partial_running.swap(true, Ordering::AcqRel)
    }

    fn release_partial_slot(&self) {
        self.partial_running.store(false, Ordering::Release);
    }

    fn claim_partial_slot_before(&self, deadline: Instant) -> bool {
        while self
            .partial_running
            .compare_exchange(false, true, Ordering::AcqRel, Ordering::Acquire)
            .is_err()
        {
            if Instant::now() >= deadline {
                return false;
            }
            thread::sleep(RESCUE_POLL);
        }
        true
    }

    #[cfg(test)]
    pub(super) fn server(&self) -> &WhisperServer {
        &self.server
    }
}

impl TranscriptionEngine for WhisperEngine {
    fn warm(&self, model: &Path) {
        let Some(binary) = resolve_server_binary() else {
            return;
        };
        let Ok(model) = ready_model(model) else {
            return;
        };
        ignore_start_outcome_reported_by_status(self.server.ensure(&binary, &model, true));
    }

    fn transcribe(
        &self,
        wav: Vec<u8>,
        model: &Path,
        prompt: Option<&str>,
    ) -> PortResult<Transcript> {
        self.transcribe_with(&Binaries::resolve(), wav, model, prompt)
    }

    fn transcribe_partial(&self, model: &Path, wav: &[u8], prompt: Option<&str>) -> Option<String> {
        validate_wav(wav).ok()?;
        let model = ready_model(model).ok()?;
        if !self.try_claim_partial_slot() {
            return None;
        }
        let text = self.server.transcribe_partial(&model, wav, prompt);
        self.release_partial_slot();
        text
    }

    fn transcribe_rescue(&self, model: &Path, wav: &[u8], prompt: Option<&str>) -> Option<String> {
        validate_wav(wav).ok()?;
        let model = ready_model(model).ok()?;
        let deadline = Instant::now() + RESCUE_DEADLINE;
        if !self.claim_partial_slot_before(deadline) {
            return None;
        }
        let timeout = deadline.saturating_duration_since(Instant::now());
        let text = self
            .server
            .transcribe_snapshot(&model, wav, prompt, timeout);
        self.release_partial_slot();
        text
    }

    fn status(&self) -> ServerStatus {
        self.server.status()
    }

    fn shutdown(&self) {
        self.server.shutdown();
    }
}
