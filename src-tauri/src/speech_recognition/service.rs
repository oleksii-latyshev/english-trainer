use super::{
    domain::{
        answer_prompt, is_model_file_name, merge_runs, normalize_terms, prompt_from_terms,
        score_recording, sentence_for, status_of, summarize, validate_wav, KeptRecordings,
        SettingsChange, SpeechCheckProgress, SpeechCheckResults, SpeechCheckStatus,
        SpeechEngineStatus, SpeechModels, SpeechSettings, Transcript, PREFERRED_MODEL_FILE,
    },
    error::SpeechRecognitionError,
    ports::{
        GlossaryStore, ModelCatalog, OneOffTranscriber, PortResult, PracticeConversation,
        RecordingVault, SettingsStore, SpeechCheckStore, TranscriptionEngine,
    },
};
use std::{
    path::PathBuf,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    },
    time::{Instant, SystemTime, UNIX_EPOCH},
};

const MAX_RESCUE_WAV_BYTES: usize = 1_000_044;

pub struct SpeechRecognitionPorts {
    pub engine: Arc<dyn TranscriptionEngine>,
    pub one_off: Arc<dyn OneOffTranscriber>,
    pub settings: Arc<dyn SettingsStore>,
    pub glossary: Arc<dyn GlossaryStore>,
    pub conversation: Arc<dyn PracticeConversation>,
    pub models: Arc<dyn ModelCatalog>,
    pub recordings: Arc<dyn RecordingVault>,
    pub speech_check: Arc<dyn SpeechCheckStore>,
}

#[derive(Clone)]
pub struct SpeechRecognitionService {
    ports: Arc<SpeechRecognitionPorts>,
    measuring: Arc<AtomicBool>,
}

struct MeasuringGuard(Arc<AtomicBool>);

impl MeasuringGuard {
    fn acquire(flag: &Arc<AtomicBool>) -> Option<Self> {
        (!flag.swap(true, Ordering::AcqRel)).then(|| Self(Arc::clone(flag)))
    }
}

impl Drop for MeasuringGuard {
    fn drop(&mut self) {
        self.0.store(false, Ordering::Release);
    }
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

fn recognizer_busy() -> SpeechRecognitionError {
    SpeechRecognitionError::Unavailable(
        "Speech recognition is busy or not ready. Wait briefly, keep speaking and retry Stuck."
            .into(),
    )
}

impl SpeechRecognitionService {
    pub fn new(ports: SpeechRecognitionPorts) -> Self {
        Self {
            ports: Arc::new(ports),
            measuring: Arc::new(AtomicBool::new(false)),
        }
    }

    pub fn settings(&self) -> PortResult<SpeechSettings> {
        let stored = self.ports.settings.load()?;
        Ok(self.resolved(stored))
    }

    fn resolved(&self, settings: SpeechSettings) -> SpeechSettings {
        settings.resolved(self.ports.models.is_installed(PREFERRED_MODEL_FILE))
    }

    fn change_settings(&self, change: SettingsChange) -> PortResult<SpeechSettings> {
        Ok(self.resolved(self.ports.settings.apply(&change)?))
    }

    pub fn save_model(&self, model_file: String) -> PortResult<SpeechSettings> {
        if !is_model_file_name(&model_file) {
            return Err(SpeechRecognitionError::InvalidRequest(
                "That is not a Whisper model file name. Choose a model from the list.".into(),
            ));
        }
        self.change_settings(SettingsChange::ModelFile(model_file))
    }

    pub fn save_live_transcript(&self, enabled: bool) -> PortResult<SpeechSettings> {
        self.change_settings(SettingsChange::LiveTranscript(enabled))
    }

    pub fn save_keep_raw_audio(&self, enabled: bool) -> PortResult<SpeechSettings> {
        self.change_settings(SettingsChange::KeepRawAudio(enabled))
    }

    pub fn warm(&self) -> PortResult<()> {
        let settings = self.settings()?;
        self.ports
            .engine
            .warm(&self.ports.models.path(&settings.model_file));
        Ok(())
    }

    pub fn engine_status(&self) -> PortResult<SpeechEngineStatus> {
        let settings = self.settings()?;
        let status = self.ports.engine.status();
        Ok(SpeechEngineStatus {
            server: status.state,
            failure: status.failure,
            is_live_transcript_available: settings.is_live_transcript_available(),
        })
    }

    pub fn models(&self) -> SpeechModels {
        SpeechModels {
            models: self.ports.models.list(),
            override_path: self.ports.models.override_path(),
        }
    }

    pub fn model_path(&self, model_file: &str) -> PathBuf {
        self.ports.models.path(model_file)
    }

    pub fn server_status(&self) -> crate::speech_recognition::domain::ServerStatus {
        self.ports.engine.status()
    }

    pub fn shutdown(&self) {
        self.ports.engine.shutdown();
    }

    fn prompt_for_current_answer(&self) -> Option<String> {
        let glossary = self.ports.glossary.effective_terms().unwrap_or_default();
        let context = self.ports.conversation.answer_context().unwrap_or_default();
        answer_prompt(&glossary, &context)
    }

    pub fn transcribe(&self, wav: Vec<u8>) -> PortResult<Transcript> {
        let settings = self.settings()?;
        let prompt = self.prompt_for_current_answer();
        let slot = self.ports.conversation.next_turn_slot();
        if settings.keep_raw_audio {
            self.keep_recording(slot, &wav);
        }
        self.ports.engine.transcribe(
            wav,
            &self.ports.models.path(&settings.model_file),
            prompt.as_deref(),
        )
    }

    fn keep_recording(&self, slot: Option<(u64, usize)>, wav: &[u8]) {
        if let Err(error) = self.ports.recordings.keep(slot, wav) {
            eprintln!("Could not keep the recording: {error}");
        }
    }

    pub fn transcribe_partial(&self, wav: &[u8]) -> PortResult<Option<String>> {
        let settings = self.settings()?;
        if !settings.is_live_transcript_available() {
            return Ok(None);
        }
        let prompt = self.prompt_for_current_answer();
        Ok(self.ports.engine.transcribe_partial(
            &self.ports.models.path(&settings.model_file),
            wav,
            prompt.as_deref(),
        ))
    }

    pub fn transcribe_rescue(
        &self,
        session_id: u64,
        sequence: usize,
        wav: &[u8],
    ) -> PortResult<String> {
        let question = self
            .ports
            .conversation
            .rescue_question(session_id, sequence, None)?;
        if wav.len() > MAX_RESCUE_WAV_BYTES || validate_wav(wav).is_err() {
            return Err(SpeechRecognitionError::unreadable_rescue_snapshot());
        }
        let settings = self.settings()?;
        let prompt = self.prompt_for_current_answer();
        let text = self
            .ports
            .engine
            .transcribe_rescue(
                &self.ports.models.path(&settings.model_file),
                wav,
                prompt.as_deref(),
            )
            .ok_or_else(recognizer_busy)?;
        self.ports
            .conversation
            .rescue_question(session_id, sequence, Some(&question))?;
        if text.trim().is_empty() {
            return Err(SpeechRecognitionError::InvalidOutput(
                "No speech was recognized yet. Say a few words and try Stuck again.".into(),
            ));
        }
        Ok(text)
    }

    pub fn glossary(&self) -> PortResult<Vec<String>> {
        self.ports.glossary.terms()
    }

    pub fn save_glossary(&self, terms: &[String]) -> PortResult<Vec<String>> {
        let terms = normalize_terms(terms)
            .map_err(|error| SpeechRecognitionError::InvalidRequest(error.message()))?;
        self.ports.glossary.replace(&terms)?;
        Ok(terms)
    }

    pub fn kept_recordings(&self) -> PortResult<KeptRecordings> {
        self.ports.recordings.summary()
    }

    pub fn delete_kept_recordings(&self) -> PortResult<KeptRecordings> {
        self.ports.recordings.delete_all()?;
        self.ports.recordings.summary()
    }

    pub fn speech_check(&self) -> SpeechCheckStatus {
        status_of(
            &self.ports.speech_check.recorded_indices(),
            self.ports.speech_check.results(),
        )
    }

    pub fn save_speech_check_recording(
        &self,
        index: u32,
        wav: &[u8],
    ) -> PortResult<SpeechCheckStatus> {
        let sentence = sentence_for(index).ok_or_else(|| {
            SpeechRecognitionError::InvalidAudio(
                "That sentence is not part of the speech check.".into(),
            )
        })?;
        validate_wav(wav)?;
        self.ports
            .speech_check
            .save_recording(index, sentence, wav)?;
        Ok(self.speech_check())
    }

    pub fn delete_speech_check_recordings(&self) -> PortResult<SpeechCheckStatus> {
        self.ports.speech_check.delete_all()?;
        Ok(self.speech_check())
    }

    pub fn run_speech_check(
        &self,
        model_files: &[String],
        include_prompt: bool,
        mut on_progress: impl FnMut(SpeechCheckProgress),
    ) -> PortResult<SpeechCheckResults> {
        let terms = self.ports.glossary.terms().map_err(|_| {
            SpeechRecognitionError::Storage(
                "Cannot read the glossary. Please restart the app and retry.".into(),
            )
        })?;
        self.ports.one_off.ensure_available()?;
        let _guard = MeasuringGuard::acquire(&self.measuring).ok_or_else(|| {
            SpeechRecognitionError::Busy(
                "A measurement is already running. Wait for it to finish.".into(),
            )
        })?;
        let recordings = self.ports.speech_check.recordings();
        if recordings.is_empty() {
            return Err(SpeechRecognitionError::InvalidAudio(
                "Record at least one sentence before measuring.".into(),
            ));
        }
        let mut models = Vec::new();
        for file in model_files {
            if !is_model_file_name(file) {
                return Err(SpeechRecognitionError::ModelMissing(format!(
                    "{file} is not a Whisper model file."
                )));
            }
            models.push((file.clone(), self.ports.models.ready_installed(file)?));
        }
        if models.is_empty() {
            return Err(SpeechRecognitionError::ModelMissing(
                "No Whisper models are installed in the models folder.".into(),
            ));
        }
        let prompt = if include_prompt {
            prompt_from_terms(&terms)
        } else {
            None
        };
        let variants: &[bool] = if prompt.is_some() {
            &[false, true]
        } else {
            &[false]
        };
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
                    let outcome = self.ports.one_off.transcribe_file(
                        path,
                        &recording.path,
                        prompt.as_deref().filter(|_| uses_prompt),
                    );
                    let time_ms = started.elapsed().as_millis() as u64;
                    let transcript = match outcome {
                        Ok(transcript) => transcript.text,
                        Err(SpeechRecognitionError::NoSpeech) => String::new(),
                        Err(error) => return Err(error),
                    };
                    results.push(score_recording(recording, transcript, time_ms, &terms));
                    done += 1;
                }
                runs.push(summarize(file, uses_prompt, now_ms(), results));
            }
        }
        on_progress(SpeechCheckProgress {
            model_file: String::new(),
            uses_prompt: false,
            done,
            total,
        });
        let merged = merge_runs(self.ports.speech_check.results(), runs);
        self.ports.speech_check.save_results(&merged)?;
        Ok(merged)
    }
}
