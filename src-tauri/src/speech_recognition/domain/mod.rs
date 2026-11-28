mod engine_status;
mod glossary;
mod kept;
mod model_download;
mod prompt;
mod scoring;
mod settings;
mod speech_check;
mod transcript;
mod wav;

pub use engine_status::{ServerState, ServerStatus, SpeechEngineStatus, WhisperBackend};
pub use glossary::{normalize_terms, prompt_from_terms, SEED_GLOSSARY};
pub use kept::KeptRecordings;
pub use model_download::{
    ModelDownloadOffer, ModelDownloadProgress, ModelSource, PREFERRED_MODEL_SOURCE,
};
pub use prompt::{answer_prompt, AnswerContext};
pub use settings::{
    is_model_file_name, SettingsChange, SpeechModel, SpeechModels, SpeechSettings,
    PREFERRED_MODEL_FILE,
};
pub use speech_check::{
    merge_runs, score_recording, sentence_for, status_of, summarize, CheckRecording,
    SpeechCheckProgress, SpeechCheckResults, SpeechCheckStatus, SENTENCE_COUNT,
};
pub use transcript::{without_annotations, Transcript};
#[cfg(test)]
pub(crate) use wav::valid_wav;
pub use wav::validate_wav;
