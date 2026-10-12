use crate::speech_recognition::error::SpeechRecognitionError;

const MAX_WAV_BYTES: usize = 60 * 1024 * 1024;

pub fn validate_wav(wav: &[u8]) -> Result<u64, SpeechRecognitionError> {
    let invalid = || {
        SpeechRecognitionError::InvalidAudio("Invalid WAV recording. Please record again.".into())
    };
    if wav.len() < 44 || wav.len() > MAX_WAV_BYTES {
        return Err(SpeechRecognitionError::InvalidAudio(
            "Recording is empty, invalid, or too long (maximum 60 MB). Please record again.".into(),
        ));
    }
    if &wav[..4] != b"RIFF" || &wav[8..12] != b"WAVE" {
        return Err(invalid());
    }
    let riff_size = u32::from_le_bytes(wav[4..8].try_into().map_err(|_| invalid())?) as usize;
    if riff_size.checked_add(8) != Some(wav.len()) {
        return Err(invalid());
    }
    let (mut position, mut format, mut data_len) = (12usize, None, None);
    while position + 8 <= wav.len() {
        let size = u32::from_le_bytes(
            wav[position + 4..position + 8]
                .try_into()
                .map_err(|_| invalid())?,
        ) as usize;
        let start = position + 8;
        let end = start.checked_add(size).ok_or_else(invalid)?;
        if end > wav.len() {
            return Err(invalid());
        }
        match &wav[position..position + 4] {
            b"fmt " if size >= 16 => {
                let fields = &wav[start..start + 16];
                format = Some((
                    u16::from_le_bytes([fields[0], fields[1]]),
                    u16::from_le_bytes([fields[2], fields[3]]),
                    u32::from_le_bytes(fields[4..8].try_into().map_err(|_| invalid())?),
                    u16::from_le_bytes([fields[14], fields[15]]),
                ));
            }
            b"data" => data_len = Some(size),
            _ => {}
        }
        position = end.checked_add(size % 2).ok_or_else(invalid)?;
    }
    let Some((codec, channels, sample_rate, bits)) = format else {
        return Err(invalid());
    };
    if codec != 1 || channels != 1 || bits != 16 || sample_rate != 16_000 {
        return Err(SpeechRecognitionError::InvalidAudio(
            "Whisper needs mono 16-bit PCM WAV at 16 kHz. Please record again.".into(),
        ));
    }
    let bytes = data_len
        .filter(|size| *size > 0 && size % 2 == 0)
        .ok_or_else(invalid)?;
    Ok((bytes as u64 * 1000) / 32_000)
}

#[cfg(test)]
pub(crate) fn valid_wav() -> Vec<u8> {
    let mut wav = Vec::new();
    wav.extend_from_slice(b"RIFF");
    wav.extend_from_slice(&36_u32.to_le_bytes());
    wav.extend_from_slice(b"WAVEfmt ");
    wav.extend_from_slice(&16_u32.to_le_bytes());
    wav.extend_from_slice(&1_u16.to_le_bytes());
    wav.extend_from_slice(&1_u16.to_le_bytes());
    wav.extend_from_slice(&16_000_u32.to_le_bytes());
    wav.extend_from_slice(&32_000_u32.to_le_bytes());
    wav.extend_from_slice(&2_u16.to_le_bytes());
    wav.extend_from_slice(&16_u16.to_le_bytes());
    wav.extend_from_slice(b"data");
    wav.extend_from_slice(&0_u32.to_le_bytes());
    wav.extend_from_slice(&[0_u8; 32]);
    wav[4..8].copy_from_slice(&68_u32.to_le_bytes());
    wav[40..44].copy_from_slice(&32_u32.to_le_bytes());
    wav
}

#[cfg(test)]
mod tests {
    use super::*;

    fn is_invalid_audio(error: SpeechRecognitionError) -> bool {
        matches!(error, SpeechRecognitionError::InvalidAudio(_))
    }

    #[test]
    fn a_valid_recording_reports_its_duration() {
        assert_eq!(validate_wav(&valid_wav()), Ok(1));
    }

    #[test]
    fn only_16_khz_mono_16_bit_pcm_is_accepted() {
        let mut wav = valid_wav();
        wav[24..28].copy_from_slice(&48_000_u32.to_le_bytes());
        assert!(is_invalid_audio(validate_wav(&wav).unwrap_err()));
    }

    #[test]
    fn empty_and_foreign_data_is_invalid_audio() {
        assert!(is_invalid_audio(validate_wav(&[]).unwrap_err()));
        assert!(is_invalid_audio(validate_wav(b"not a wav").unwrap_err()));
    }
}
