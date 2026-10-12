use crate::voice::error::VoiceError;
use std::time::Duration;

const MAX_TEXT_BYTES: usize = 4096;
const MAX_VOICE_ID: u32 = 9;
const SPEED_RANGE: std::ops::RangeInclusive<f32> = 0.85..=1.2;
const BASE_DEADLINE: Duration = Duration::from_millis(750);
const DEADLINE_PER_CHARACTER: Duration = Duration::from_millis(25);
const MAX_DEADLINE: Duration = Duration::from_secs(6);

#[derive(Debug, Clone, PartialEq)]
pub struct SynthesisRequest {
    text: String,
    voice_id: u32,
    speed: f32,
}

impl SynthesisRequest {
    pub fn new(text: &str, voice_id: u32, speed: f32) -> Result<Self, VoiceError> {
        let is_valid = !text.trim().is_empty()
            && text.len() <= MAX_TEXT_BYTES
            && !text.contains('\0')
            && voice_id <= MAX_VOICE_ID
            && speed.is_finite()
            && SPEED_RANGE.contains(&speed);
        if !is_valid {
            return Err(VoiceError::InvalidRequest);
        }
        Ok(Self {
            text: text.to_owned(),
            voice_id,
            speed,
        })
    }

    pub fn text(&self) -> &str {
        &self.text
    }

    pub fn voice_id(&self) -> u32 {
        self.voice_id
    }

    pub fn speed(&self) -> f32 {
        self.speed
    }
}

pub fn inference_deadline(text: &str) -> Duration {
    let characters = u32::try_from(text.chars().count()).unwrap_or(u32::MAX);
    BASE_DEADLINE
        .saturating_add(DEADLINE_PER_CHARACTER.saturating_mul(characters))
        .min(MAX_DEADLINE)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_unsupported_text_voice_and_speed() {
        let invalid = [
            ("", 0, 1.0),
            ("   ", 0, 1.0),
            ("hello\0world", 0, 1.0),
            ("Hi", 10, 1.0),
            ("Hi", 0, f32::NAN),
            ("Hi", 0, f32::INFINITY),
            ("Hi", 0, 0.8),
            ("Hi", 0, 1.3),
        ];
        for (text, voice, speed) in invalid {
            assert_eq!(
                SynthesisRequest::new(text, voice, speed).unwrap_err(),
                VoiceError::InvalidRequest
            );
        }
        assert!(SynthesisRequest::new(&"a".repeat(4097), 0, 1.0).is_err());
    }

    #[test]
    fn accepts_the_limits_of_every_range() {
        assert!(SynthesisRequest::new("Let's try it!", 9, 0.85).is_ok());
        assert!(SynthesisRequest::new("Let's try it!", 0, 1.2).is_ok());
        assert!(SynthesisRequest::new(&"a".repeat(4096), 0, 1.0).is_ok());
    }

    #[test]
    fn keeps_the_validated_values() {
        let request = SynthesisRequest::new("Hi!", 5, 1.1).unwrap();

        assert_eq!(
            (request.text(), request.voice_id(), request.speed()),
            ("Hi!", 5, 1.1)
        );
    }

    #[test]
    fn deadline_grows_with_the_text_and_is_capped() {
        assert_eq!(inference_deadline(""), Duration::from_millis(750));
        assert_eq!(
            inference_deadline(&"a".repeat(40)),
            Duration::from_millis(1750)
        );
        assert_eq!(
            inference_deadline(&"a".repeat(4000)),
            Duration::from_secs(6)
        );
    }
}
