use super::{
    domain::{
        AnswerContext, CheckRecording, KeptRecordings, ServerStatus, SettingsChange,
        SpeechCheckResults, SpeechModel, SpeechSettings, Transcript,
    },
    error::SpeechRecognitionError,
};
use std::path::{Path, PathBuf};

pub type PortResult<T> = Result<T, SpeechRecognitionError>;

pub trait TranscriptionEngine: Send + Sync {
    fn warm(&self, model: &Path);
    fn transcribe(
        &self,
        wav: Vec<u8>,
        model: &Path,
        prompt: Option<&str>,
    ) -> PortResult<Transcript>;
    fn transcribe_partial(&self, model: &Path, wav: &[u8], prompt: Option<&str>) -> Option<String>;
    fn transcribe_rescue(&self, model: &Path, wav: &[u8], prompt: Option<&str>) -> Option<String>;
    fn status(&self) -> ServerStatus;
    fn shutdown(&self);
}

pub trait OneOffTranscriber: Send + Sync {
    fn ensure_available(&self) -> PortResult<()>;
    fn transcribe_file(
        &self,
        model: &Path,
        input: &Path,
        prompt: Option<&str>,
    ) -> PortResult<Transcript>;
}

pub trait SettingsStore: Send + Sync {
    fn load(&self) -> PortResult<SpeechSettings>;
    fn apply(&self, change: &SettingsChange) -> PortResult<SpeechSettings>;
}

pub trait GlossaryStore: Send + Sync {
    fn terms(&self) -> PortResult<Vec<String>>;
    fn effective_terms(&self) -> PortResult<Vec<String>>;
    fn replace(&self, terms: &[String]) -> PortResult<()>;
}

pub trait PracticeConversation: Send + Sync {
    fn next_turn_slot(&self) -> Option<(u64, usize)>;
    fn answer_context(&self) -> Option<AnswerContext>;
    fn rescue_question(
        &self,
        session_id: u64,
        sequence: usize,
        question: Option<&str>,
    ) -> PortResult<String>;
}

pub trait ModelCatalog: Send + Sync {
    fn list(&self) -> Vec<SpeechModel>;
    fn override_path(&self) -> Option<String>;
    fn path(&self, model_file: &str) -> PathBuf;
    fn is_installed(&self, model_file: &str) -> bool;
    fn ready_installed(&self, model_file: &str) -> PortResult<PathBuf>;
}

pub trait RecordingVault: Send + Sync {
    fn keep(&self, slot: Option<(u64, usize)>, wav: &[u8]) -> PortResult<()>;
    fn summary(&self) -> PortResult<KeptRecordings>;
    fn delete_all(&self) -> PortResult<()>;
}

pub trait SpeechCheckStore: Send + Sync {
    fn recorded_indices(&self) -> Vec<u32>;
    fn recordings(&self) -> Vec<CheckRecording>;
    fn results(&self) -> SpeechCheckResults;
    fn save_recording(&self, index: u32, sentence: &str, wav: &[u8]) -> PortResult<()>;
    fn save_results(&self, results: &SpeechCheckResults) -> PortResult<()>;
    fn delete_all(&self) -> PortResult<()>;
}
