use crate::voice::{domain::SynthesisRequest, error::VoiceError};
use std::{
    io::{Read, Write},
    path::Path,
    process::{Child, ChildStdin, Command, Stdio},
    sync::mpsc::{self, Receiver},
    thread::{self, JoinHandle},
    time::Duration,
};

const MAX_WAVE_BYTES: usize = 44 + 44100 * 60 * 2;
const READY_TAG: [u8; 4] = *b"TTS1";
const STARTUP_TIMEOUT: Duration = Duration::from_secs(5);

pub struct Running {
    child: Child,
    stdin: ChildStdin,
    frames: Receiver<Vec<u8>>,
    reader: Option<JoinHandle<()>>,
}

fn ignore_already_exited<T, E>(_outcome: Result<T, E>) {}

impl Drop for Running {
    fn drop(&mut self) {
        ignore_already_exited(self.child.kill());
        ignore_already_exited(self.child.wait());
        if let Some(reader) = self.reader.take() {
            ignore_already_exited(reader.join());
        }
    }
}

impl Running {
    pub fn spawn(directory: &Path) -> Result<Self, VoiceError> {
        let mut child = Command::new(directory.join("speech"))
            .arg(directory.join("model"))
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .spawn()
            .map_err(|_| VoiceError::ProcessFailed)?;
        let (Some(stdin), Some(mut stdout)) = (child.stdin.take(), child.stdout.take()) else {
            ignore_already_exited(child.kill());
            ignore_already_exited(child.wait());
            return Err(VoiceError::ProcessFailed);
        };
        let (sender, frames) = mpsc::channel();
        let reader = thread::spawn(move || {
            let mut ready = [0; 4];
            if stdout.read_exact(&mut ready).is_err() || ready != READY_TAG {
                return;
            }
            if sender.send(Vec::new()).is_err() {
                return;
            }
            while let Ok(frame) = read_frame(&mut stdout) {
                if sender.send(frame).is_err() {
                    return;
                }
            }
        });
        let running = Self {
            child,
            stdin,
            frames,
            reader: Some(reader),
        };
        running
            .frames
            .recv_timeout(STARTUP_TIMEOUT)
            .map_err(|_| VoiceError::Timeout)?;
        Ok(running)
    }

    pub fn request(
        &mut self,
        request: &SynthesisRequest,
        deadline: Duration,
    ) -> Result<Vec<u8>, VoiceError> {
        let text = request.text();
        let length = u32::try_from(text.len()).map_err(|_| VoiceError::InvalidRequest)?;
        let mut bytes = Vec::with_capacity(12 + text.len());
        bytes.extend(length.to_le_bytes());
        bytes.extend(request.voice_id().to_le_bytes());
        bytes.extend(request.speed().to_le_bytes());
        bytes.extend(text.as_bytes());
        self.stdin
            .write_all(&bytes)
            .and_then(|()| self.stdin.flush())
            .map_err(|_| VoiceError::ProcessFailed)?;
        let wav = self
            .frames
            .recv_timeout(deadline)
            .map_err(|error| match error {
                mpsc::RecvTimeoutError::Timeout => VoiceError::Timeout,
                mpsc::RecvTimeoutError::Disconnected => VoiceError::ProcessFailed,
            })?;
        if wav.len() < 44 || &wav[..4] != b"RIFF" || &wav[8..12] != b"WAVE" {
            return Err(VoiceError::ProcessFailed);
        }
        Ok(wav)
    }
}

pub fn read_frame(reader: &mut impl Read) -> std::io::Result<Vec<u8>> {
    let mut size = [0; 4];
    reader.read_exact(&mut size)?;
    let size = u32::from_le_bytes(size) as usize;
    if !(44..=MAX_WAVE_BYTES).contains(&size) {
        return Err(std::io::Error::other("Invalid local speech frame length"));
    }
    let mut frame = vec![0; size];
    reader.read_exact(&mut frame)?;
    Ok(frame)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn malformed_or_truncated_frames_are_bounded() {
        for size in [0u32, 43, u32::MAX] {
            assert!(read_frame(&mut std::io::Cursor::new(size.to_le_bytes())).is_err());
        }
        let mut data = 44u32.to_le_bytes().to_vec();
        data.extend([0; 10]);
        assert!(read_frame(&mut std::io::Cursor::new(data)).is_err());
    }
}
