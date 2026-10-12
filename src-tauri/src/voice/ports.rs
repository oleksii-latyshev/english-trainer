use super::{domain::SynthesisRequest, error::VoiceError};
use std::time::Duration;

pub trait SpeechEngine: Send + Sync {
    fn prewarm(&self) -> Result<bool, VoiceError>;
    fn render(&self, request: &SynthesisRequest, deadline: Duration)
        -> Result<Vec<u8>, VoiceError>;
}
