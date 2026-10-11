use super::{VoiceError, VoiceErrorCode};
use std::{
    io::{Read, Write},
    path::Path,
    process::{Child, ChildStdin, Command, Stdio},
    sync::mpsc::{self, Receiver},
    thread::{self, JoinHandle},
    time::Duration,
};
const MAX_WAVE_BYTES: usize = 44 + 44100 * 60 * 2;
pub(super) struct Running {
    child: Child,
    stdin: ChildStdin,
    frames: Receiver<Vec<u8>>,
    reader: Option<JoinHandle<()>>,
}
impl Drop for Running {
    fn drop(&mut self) {
        let _ = self.child.kill();
        let _ = self.child.wait();
        if let Some(reader) = self.reader.take() {
            let _ = reader.join();
        }
    }
}
impl Running {
    pub(super) fn spawn(directory: &Path) -> Result<Self, VoiceError> {
        let mut child = Command::new(directory.join("speech"))
            .arg(directory.join("model"))
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .spawn()
            .map_err(|_| VoiceError::new(VoiceErrorCode::ProcessFailed))?;
        let (Some(stdin), Some(mut stdout)) = (child.stdin.take(), child.stdout.take()) else {
            let _ = child.kill();
            let _ = child.wait();
            return Err(VoiceError::new(VoiceErrorCode::ProcessFailed));
        };
        let (sender, frames) = mpsc::channel();
        let reader = thread::spawn(move || {
            let mut ready = [0; 4];
            if stdout.read_exact(&mut ready).is_err() || ready != *b"TTS1" {
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
            .recv_timeout(Duration::from_secs(5))
            .map_err(|_| VoiceError::new(VoiceErrorCode::Timeout))?;
        Ok(running)
    }
    pub(super) fn request(
        &mut self,
        text: &str,
        speaker: u32,
        speed: f32,
        timeout: Duration,
    ) -> Result<Vec<u8>, VoiceError> {
        let length =
            u32::try_from(text.len()).map_err(|_| VoiceError::new(VoiceErrorCode::InvalidInput))?;
        let mut request = Vec::with_capacity(12 + text.len());
        request.extend(length.to_le_bytes());
        request.extend(speaker.to_le_bytes());
        request.extend(speed.to_le_bytes());
        request.extend(text.as_bytes());
        self.stdin
            .write_all(&request)
            .and_then(|()| self.stdin.flush())
            .map_err(|_| VoiceError::new(VoiceErrorCode::ProcessFailed))?;
        let wav = self.frames.recv_timeout(timeout).map_err(|e| match e {
            mpsc::RecvTimeoutError::Timeout => VoiceError::new(VoiceErrorCode::Timeout),
            mpsc::RecvTimeoutError::Disconnected => VoiceError::new(VoiceErrorCode::ProcessFailed),
        })?;
        if wav.len() < 44 || &wav[..4] != b"RIFF" || &wav[8..12] != b"WAVE" {
            return Err(VoiceError::new(VoiceErrorCode::ProcessFailed));
        }
        Ok(wav)
    }
}
pub(super) fn read_frame(reader: &mut impl Read) -> std::io::Result<Vec<u8>> {
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
