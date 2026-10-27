use crate::core::{IpcError, IpcErrorCode};
use thiserror::Error;

#[derive(Debug, Error, PartialEq, Eq)]
pub enum SpeechRecognitionError {
    #[error("the audio cannot be transcribed: {0}")]
    InvalidAudio(String),
    #[error("no speech was recognized")]
    NoSpeech,
    #[error("the Whisper model is missing: {0}")]
    ModelMissing(String),
    #[error("the Whisper engine is missing: {0}")]
    EngineMissing(String),
    #[error("the Whisper engine failed: {0}")]
    EngineFailed(String),
    #[error("the Whisper engine timed out")]
    Timeout,
    #[error("local storage failed: {0}")]
    Storage(String),
    #[error("Whisper returned unusable output: {0}")]
    InvalidOutput(String),
    #[error("speech recognition is busy: {0}")]
    Busy(String),
    #[error("the request is not valid: {0}")]
    InvalidRequest(String),
    #[error("speech recognition is not ready: {0}")]
    Unavailable(String),
    #[error("the speech settings could not be read or saved")]
    SettingsStorage,
    #[error("the practice session refused the request")]
    Conversation(IpcError),
}

impl SpeechRecognitionError {
    pub fn unreadable_rescue_snapshot() -> Self {
        Self::InvalidRequest(
            "The rescue audio snapshot could not be read. Keep speaking and try Stuck again."
                .into(),
        )
    }

    pub fn expected_raw_audio() -> Self {
        Self::InvalidAudio("Expected raw WAV audio bytes. Please record again.".into())
    }

    pub fn missing_sentence_number() -> Self {
        Self::InvalidAudio(
            "The recording did not say which sentence it belongs to. Please record again.".into(),
        )
    }
}

impl From<SpeechRecognitionError> for IpcError {
    fn from(error: SpeechRecognitionError) -> Self {
        use SpeechRecognitionError as E;
        match error {
            E::InvalidAudio(message) => Self::new(IpcErrorCode::InvalidAudio, message),
            E::NoSpeech => Self::new(
                IpcErrorCode::NoSpeech,
                "No speech was recognized. Please record again.",
            ),
            E::ModelMissing(message) => Self::new(IpcErrorCode::ModelMissing, message),
            E::EngineMissing(message) => Self::new(IpcErrorCode::EngineMissing, message),
            E::EngineFailed(message) | E::Storage(message) => {
                Self::new(IpcErrorCode::ProcessFailed, message)
            }
            E::Timeout => Self::new(
                IpcErrorCode::Timeout,
                "Local Whisper timed out. Try a shorter recording.",
            ),
            E::InvalidOutput(message) => Self::new(IpcErrorCode::InvalidOutput, message),
            E::Busy(message) => Self::new(IpcErrorCode::Busy, message),
            E::InvalidRequest(message) => Self::new(IpcErrorCode::InvalidRequest, message),
            E::Unavailable(message) => Self::new(IpcErrorCode::Unavailable, message),
            E::SettingsStorage => Self::new(
                IpcErrorCode::DatabaseError,
                "Could not read or save speech settings locally. Please retry.",
            ),
            E::Conversation(error) => error,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn recoverable_failures_keep_distinct_codes_for_the_ui() {
        let cases = [
            (
                SpeechRecognitionError::InvalidAudio("Record again.".into()),
                IpcErrorCode::InvalidAudio,
            ),
            (SpeechRecognitionError::NoSpeech, IpcErrorCode::NoSpeech),
            (
                SpeechRecognitionError::ModelMissing("Install the model.".into()),
                IpcErrorCode::ModelMissing,
            ),
            (
                SpeechRecognitionError::EngineMissing("Install Whisper.".into()),
                IpcErrorCode::EngineMissing,
            ),
            (SpeechRecognitionError::Timeout, IpcErrorCode::Timeout),
            (
                SpeechRecognitionError::SettingsStorage,
                IpcErrorCode::DatabaseError,
            ),
        ];
        for (error, code) in cases {
            assert_eq!(IpcError::from(error).code, code);
        }
    }

    #[test]
    fn the_message_the_learner_sees_is_the_one_the_failure_carries() {
        let ipc = IpcError::from(SpeechRecognitionError::ModelMissing(
            "Install the model.".into(),
        ));
        assert_eq!(
            ipc,
            IpcError::new(IpcErrorCode::ModelMissing, "Install the model.")
        );
    }

    #[test]
    fn a_refusal_from_the_practice_session_passes_through() {
        let refusal = IpcError::new(IpcErrorCode::InvalidRequest, "The question changed.");
        assert_eq!(
            IpcError::from(SpeechRecognitionError::Conversation(refusal.clone())),
            refusal
        );
    }
}
