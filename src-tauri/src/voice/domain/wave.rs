use crate::voice::error::VoiceError;

const WINDOW_DIVISOR: usize = 100;
const SILENCE_RATIO: f64 = 0.003;
const MARGIN_BEFORE_MS: usize = 40;
const MARGIN_AFTER_MS: usize = 50;

pub fn trim_padding(mut wav: Vec<u8>) -> Result<Vec<u8>, VoiceError> {
    let invalid = || VoiceError::ProcessFailed;
    if wav.len() < 44
        || &wav[..4] != b"RIFF"
        || &wav[8..16] != b"WAVEfmt "
        || &wav[36..40] != b"data"
        || wav[16..20] != 16u32.to_le_bytes()
        || wav[20..24] != [1, 0, 1, 0]
        || wav[32..36] != [2, 0, 16, 0]
    {
        return Err(invalid());
    }
    let rate = u32::from_le_bytes(wav[24..28].try_into().map_err(|_| invalid())?) as usize;
    let data_size = u32::from_le_bytes(wav[40..44].try_into().map_err(|_| invalid())?) as usize;
    if !(8000..=48000).contains(&rate)
        || data_size != wav.len() - 44
        || !data_size.is_multiple_of(2)
    {
        return Err(invalid());
    }
    let samples: Vec<i16> = wav[44..]
        .chunks_exact(2)
        .map(|s| i16::from_le_bytes([s[0], s[1]]))
        .collect();
    let window = rate / WINDOW_DIVISOR;
    let audible: Vec<usize> = samples
        .chunks(window)
        .enumerate()
        .filter_map(|(i, chunk)| {
            let mean_square =
                chunk.iter().map(|s| f64::from(*s).powi(2)).sum::<f64>() / chunk.len() as f64;
            (mean_square > (32768f64 * SILENCE_RATIO).powi(2)).then_some(i)
        })
        .collect();
    let (Some(first), Some(last)) = (audible.first(), audible.last()) else {
        return Ok(wav);
    };
    let start = (first * window).saturating_sub(rate * MARGIN_BEFORE_MS / 1000);
    let end = ((last + 1) * window + rate * MARGIN_AFTER_MS / 1000).min(samples.len());
    let pcm = wav[44 + start * 2..44 + end * 2].to_vec();
    wav.truncate(44);
    wav.extend(pcm);
    let size = u32::try_from(wav.len()).map_err(|_| invalid())?;
    wav[4..8].copy_from_slice(&(size - 8).to_le_bytes());
    wav[40..44].copy_from_slice(&(size - 44).to_le_bytes());
    Ok(wav)
}
#[cfg(test)]
mod tests {
    use super::*;

    fn wave(samples: &[i16]) -> Vec<u8> {
        let mut out = b"RIFF\0\0\0\0WAVEfmt \x10\0\0\0\x01\0\x01\0\x80\x3e\0\0\0\x7d\0\0\x02\0\x10\0data\0\0\0\0".to_vec();
        for sample in samples {
            out.extend(sample.to_le_bytes());
        }
        let size = out.len() as u32;
        out[4..8].copy_from_slice(&(size - 8).to_le_bytes());
        out[40..44].copy_from_slice(&(size - 44).to_le_bytes());
        out
    }

    #[test]
    fn retains_soft_consonants_and_margins_while_removing_padding() {
        let mut samples = vec![0; 16000];
        samples[6400..8000].fill(300);
        samples[8000..9600].fill(1000);

        let output = trim_padding(wave(&samples)).unwrap();

        assert_eq!((output.len() - 44) / 2, 4640);
        assert_eq!(
            &output[44 + 640 * 2..44 + 640 * 2 + 2],
            &300i16.to_le_bytes()
        );
        assert_eq!(
            u32::from_le_bytes(output[40..44].try_into().unwrap()) as usize,
            output.len() - 44
        );
    }

    #[test]
    fn near_silent_noise_before_and_after_speech_is_removed() {
        let mut samples = vec![20; 16000];
        samples[6400..8000].fill(1000);

        let output = trim_padding(wave(&samples)).unwrap();

        assert_eq!((output.len() - 44) / 2, 640 + 1600 + 800);
    }

    #[test]
    fn all_quiet_audio_and_speech_at_the_edges_are_not_cut() {
        let quiet = wave(&[0; 160]);
        assert_eq!(trim_padding(quiet.clone()).unwrap(), quiet);
        let speech = wave(&[500; 160]);
        assert_eq!(trim_padding(speech.clone()).unwrap(), speech);
    }

    #[test]
    fn inconsistent_wave_formats_and_lengths_are_rejected() {
        let mut wrong = wave(&[500; 160]);
        wrong[22] = 2;
        assert!(trim_padding(wrong).is_err());
        let mut wrong = wave(&[500; 160]);
        wrong[40] = 0;
        assert!(trim_padding(wrong).is_err());
        assert!(trim_padding(vec![]).is_err());
    }
}
