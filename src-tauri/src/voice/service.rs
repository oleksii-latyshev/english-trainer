use super::{
    domain::{inference_deadline, trim_padding, SynthesisRequest},
    error::VoiceError,
    ports::SpeechEngine,
};
use std::sync::Arc;

#[derive(Clone)]
pub struct VoiceService {
    engine: Arc<dyn SpeechEngine>,
}

impl VoiceService {
    pub fn new(engine: impl SpeechEngine + 'static) -> Self {
        Self {
            engine: Arc::new(engine),
        }
    }

    pub fn prewarm(&self) -> Result<bool, VoiceError> {
        self.engine.prewarm()
    }

    pub fn synthesize(&self, text: &str, voice_id: u32, speed: f32) -> Result<Vec<u8>, VoiceError> {
        let request = SynthesisRequest::new(text, voice_id, speed)?;
        let wave = self
            .engine
            .render(&request, inference_deadline(request.text()))?;
        trim_padding(wave)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{sync::Mutex, time::Duration};

    #[derive(Default)]
    struct RecordingEngine {
        deadlines: Mutex<Vec<Duration>>,
        ready: bool,
        wave: Vec<u8>,
    }

    impl SpeechEngine for Arc<RecordingEngine> {
        fn prewarm(&self) -> Result<bool, VoiceError> {
            Ok(self.ready)
        }

        fn render(
            &self,
            _request: &SynthesisRequest,
            deadline: Duration,
        ) -> Result<Vec<u8>, VoiceError> {
            self.deadlines.lock().unwrap().push(deadline);
            if self.wave.is_empty() {
                return Err(VoiceError::Unavailable);
            }
            Ok(self.wave.clone())
        }
    }

    fn silent_wave() -> Vec<u8> {
        let mut wave = b"RIFF\0\0\0\0WAVEfmt \x10\0\0\0\x01\0\x01\0\x80\x3e\0\0\0\x7d\0\0\x02\0\x10\0data\0\0\0\0".to_vec();
        wave.extend([0u8; 320]);
        let size = wave.len() as u32;
        wave[4..8].copy_from_slice(&(size - 8).to_le_bytes());
        wave[40..44].copy_from_slice(&(size - 44).to_le_bytes());
        wave
    }

    #[test]
    fn invalid_requests_never_reach_the_engine() {
        let engine = Arc::new(RecordingEngine::default());
        let service = VoiceService::new(engine.clone());

        let result = service.synthesize("", 0, 1.0);

        assert_eq!(result.unwrap_err(), VoiceError::InvalidRequest);
        assert!(engine.deadlines.lock().unwrap().is_empty());
    }

    #[test]
    fn longer_phrases_get_a_longer_inference_deadline() {
        let engine = Arc::new(RecordingEngine {
            wave: silent_wave(),
            ..RecordingEngine::default()
        });
        let service = VoiceService::new(engine.clone());

        service.synthesize("Hi!", 0, 1.0).unwrap();
        service.synthesize(&"a".repeat(120), 0, 1.0).unwrap();

        let deadlines = engine.deadlines.lock().unwrap();
        assert!(deadlines[1] > deadlines[0]);
    }

    #[test]
    fn engine_failures_pass_through_unchanged() {
        let service = VoiceService::new(Arc::new(RecordingEngine::default()));

        let result = service.synthesize("Hi!", 0, 1.0);

        assert_eq!(result.unwrap_err(), VoiceError::Unavailable);
    }

    #[test]
    fn prewarm_reports_whether_the_engine_is_ready() {
        let service = VoiceService::new(Arc::new(RecordingEngine {
            ready: true,
            ..RecordingEngine::default()
        }));

        assert!(service.prewarm().unwrap());
    }
}
