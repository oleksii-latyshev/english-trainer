use super::model_files::models_dir;
use crate::speech_recognition::{
    domain::{ModelDownloadProgress, ModelSource, PREFERRED_MODEL_SOURCE},
    error::SpeechRecognitionError,
    ports::{ModelDownloader, PortResult},
};
use sha2::{Digest, Sha256};
use std::{
    fs,
    io::{Read, Write},
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicBool, Ordering},
        mpsc, OnceLock,
    },
    thread,
    time::{Duration, Instant},
};

const CHUNK_BYTES: usize = 256 * 1024;
const PROGRESS_STEPS: u64 = 200;
const CONNECT_TIMEOUT: Duration = Duration::from_secs(15);
const STALL_TIMEOUT: Duration = Duration::from_secs(60);
const CANCEL_POLL: Duration = Duration::from_millis(250);
const TOTAL_TIMEOUT: Duration = Duration::from_secs(2 * 60 * 60);
const QUEUED_CHUNKS: usize = 4;
const PARTIAL_SUFFIX: &str = ".partial";

pub struct ModelDownloadFiles {
    app_data: PathBuf,
}

impl ModelDownloadFiles {
    pub fn new(app_data: PathBuf) -> Self {
        Self { app_data }
    }
}

fn failed(message: &str) -> SpeechRecognitionError {
    SpeechRecognitionError::DownloadFailed(message.into())
}

fn http_client() -> PortResult<&'static reqwest::blocking::Client> {
    static CLIENT: OnceLock<Option<reqwest::blocking::Client>> = OnceLock::new();
    CLIENT
        .get_or_init(|| {
            reqwest::blocking::Client::builder()
                .connect_timeout(CONNECT_TIMEOUT)
                .timeout(TOTAL_TIMEOUT)
                .build()
                .ok()
        })
        .as_ref()
        .ok_or_else(|| failed("The download could not be prepared. Please retry."))
}

fn open_download(source: &ModelSource) -> PortResult<reqwest::blocking::Response> {
    let response = http_client()?.get(source.url).send().map_err(|_| {
        failed("The speech model could not be downloaded. Check your connection and try again.")
    })?;
    if !response.status().is_success() {
        return Err(failed(
            "The model server did not provide the file. Please try again later.",
        ));
    }
    Ok(response)
}

impl ModelDownloader for ModelDownloadFiles {
    fn download(
        &self,
        cancel: &AtomicBool,
        on_progress: &mut dyn FnMut(ModelDownloadProgress),
    ) -> PortResult<()> {
        let source = PREFERRED_MODEL_SOURCE;
        let response = open_download(&source)?;
        let reader = ChunkReader::spawn(response, cancel);
        store_stream(
            reader,
            &models_dir(&self.app_data),
            &source,
            cancel,
            on_progress,
        )
    }
}

struct ChunkReader<'a> {
    chunks: mpsc::Receiver<std::io::Result<Vec<u8>>>,
    pending: Vec<u8>,
    offset: usize,
    cancel: &'a AtomicBool,
}

impl<'a> ChunkReader<'a> {
    fn spawn(mut source: impl Read + Send + 'static, cancel: &'a AtomicBool) -> Self {
        let (sender, chunks) = mpsc::sync_channel(QUEUED_CHUNKS);
        thread::spawn(move || loop {
            let mut chunk = vec![0u8; CHUNK_BYTES];
            let message = match source.read(&mut chunk) {
                Ok(0) => return,
                Ok(count) => {
                    chunk.truncate(count);
                    Ok(chunk)
                }
                Err(error) => Err(error),
            };
            let is_error = message.is_err();
            if sender.send(message).is_err() || is_error {
                return;
            }
        });
        Self {
            chunks,
            pending: Vec::new(),
            offset: 0,
            cancel,
        }
    }
}

impl Read for ChunkReader<'_> {
    fn read(&mut self, buffer: &mut [u8]) -> std::io::Result<usize> {
        if self.offset >= self.pending.len() {
            let waiting_since = Instant::now();
            loop {
                if self.cancel.load(Ordering::Acquire) {
                    return Err(std::io::ErrorKind::Interrupted.into());
                }
                match self.chunks.recv_timeout(CANCEL_POLL) {
                    Ok(chunk) => {
                        self.pending = chunk?;
                        self.offset = 0;
                        break;
                    }
                    Err(mpsc::RecvTimeoutError::Disconnected) => return Ok(0),
                    Err(mpsc::RecvTimeoutError::Timeout) => {
                        if waiting_since.elapsed() > STALL_TIMEOUT {
                            return Err(std::io::ErrorKind::TimedOut.into());
                        }
                    }
                }
            }
        }
        let count = buffer.len().min(self.pending.len() - self.offset);
        buffer[..count].copy_from_slice(&self.pending[self.offset..self.offset + count]);
        self.offset += count;
        Ok(count)
    }
}

fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|byte| format!("{byte:02x}")).collect()
}

fn partial_path(directory: &Path, file: &str) -> PathBuf {
    directory.join(format!("{file}{PARTIAL_SUFFIX}"))
}

pub(super) fn store_stream(
    reader: impl Read,
    directory: &Path,
    source: &ModelSource,
    cancel: &AtomicBool,
    on_progress: &mut dyn FnMut(ModelDownloadProgress),
) -> PortResult<()> {
    fs::create_dir_all(directory)
        .map_err(|_| failed("The models folder could not be created. Check its permissions."))?;
    let partial = partial_path(directory, source.file);
    let outcome = write_partial(reader, &partial, source, cancel, on_progress);
    if outcome.is_err() {
        let _ = fs::remove_file(&partial);
        return outcome;
    }
    let target = directory.join(source.file);
    let _ = fs::remove_file(&target);
    fs::rename(&partial, &target).map_err(|_| {
        let _ = fs::remove_file(&partial);
        failed("The downloaded model could not be saved. Check the models folder.")
    })
}

fn write_partial(
    mut reader: impl Read,
    partial: &Path,
    source: &ModelSource,
    cancel: &AtomicBool,
    on_progress: &mut dyn FnMut(ModelDownloadProgress),
) -> PortResult<()> {
    let save_failed = || failed("The model could not be written to disk. Check the free space.");
    let mut file = fs::File::create(partial).map_err(|_| save_failed())?;
    let mut hasher = Sha256::new();
    let mut buffer = vec![0u8; CHUNK_BYTES];
    let step = (source.size_bytes / PROGRESS_STEPS).max(1);
    let mut downloaded: u64 = 0;
    let mut reported: u64 = 0;
    on_progress(ModelDownloadProgress {
        downloaded_bytes: 0,
        total_bytes: source.size_bytes,
    });
    loop {
        if cancel.load(Ordering::Acquire) {
            return Err(SpeechRecognitionError::DownloadCancelled);
        }
        let count = reader.read(&mut buffer).map_err(|_| {
            if cancel.load(Ordering::Acquire) {
                SpeechRecognitionError::DownloadCancelled
            } else {
                failed("The download was interrupted. Check your connection and try again.")
            }
        })?;
        if count == 0 {
            break;
        }
        hasher.update(&buffer[..count]);
        file.write_all(&buffer[..count])
            .map_err(|_| save_failed())?;
        downloaded += count as u64;
        if downloaded - reported >= step {
            reported = downloaded;
            on_progress(ModelDownloadProgress {
                downloaded_bytes: downloaded,
                total_bytes: source.size_bytes,
            });
        }
    }
    file.sync_all().map_err(|_| save_failed())?;
    if downloaded != source.size_bytes || hex(&hasher.finalize()) != source.sha256 {
        return Err(failed(
            "The downloaded model did not match its checksum and was discarded. Please try again.",
        ));
    }
    on_progress(ModelDownloadProgress {
        downloaded_bytes: downloaded,
        total_bytes: source.size_bytes,
    });
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::providers::agy::runner::ScratchDirectory;
    use crate::speech_recognition::infra::model_files::list_models;

    const PAYLOAD: &[u8] = b"pretend this is a whisper model";
    const PAYLOAD_SHA256: &str = "SHA";

    fn payload_sha256() -> String {
        hex(&Sha256::digest(PAYLOAD))
    }

    fn source(sha256: &'static str, size_bytes: u64) -> ModelSource {
        ModelSource {
            file: "ggml-small.en.bin",
            url: "https://example.invalid/model",
            sha256,
            size_bytes,
        }
    }

    fn leaked_sha() -> &'static str {
        Box::leak(payload_sha256().into_boxed_str())
    }

    #[test]
    fn a_matching_download_is_renamed_and_listed() {
        let directory = ScratchDirectory::new().unwrap();
        let mut events = Vec::new();
        store_stream(
            PAYLOAD,
            &models_dir(directory.path()),
            &source(leaked_sha(), PAYLOAD.len() as u64),
            &AtomicBool::new(false),
            &mut |progress| events.push(progress.downloaded_bytes),
        )
        .unwrap();
        let models = list_models(directory.path());
        assert_eq!(models.len(), 1);
        assert_eq!(models[0].file, "ggml-small.en.bin");
        assert_eq!(models[0].size_bytes, PAYLOAD.len() as u64);
        assert!(!partial_path(&models_dir(directory.path()), "ggml-small.en.bin").exists());
        assert_eq!(events.first(), Some(&0));
        assert_eq!(events.last(), Some(&(PAYLOAD.len() as u64)));
    }

    #[test]
    fn a_checksum_mismatch_discards_the_partial_file_and_installs_nothing() {
        let directory = ScratchDirectory::new().unwrap();
        let models = models_dir(directory.path());
        let result = store_stream(
            PAYLOAD,
            &models,
            &source(PAYLOAD_SHA256, PAYLOAD.len() as u64),
            &AtomicBool::new(false),
            &mut |_| {},
        );
        assert!(matches!(
            result,
            Err(SpeechRecognitionError::DownloadFailed(_))
        ));
        assert!(list_models(directory.path()).is_empty());
        assert!(!partial_path(&models, "ggml-small.en.bin").exists());
    }

    #[test]
    fn a_truncated_download_is_not_installed_even_with_a_matching_prefix() {
        let directory = ScratchDirectory::new().unwrap();
        let models = models_dir(directory.path());
        let result = store_stream(
            &PAYLOAD[..5],
            &models,
            &source(leaked_sha(), PAYLOAD.len() as u64),
            &AtomicBool::new(false),
            &mut |_| {},
        );
        assert!(result.is_err());
        assert!(list_models(directory.path()).is_empty());
    }

    #[test]
    fn cancelling_stops_the_download_and_removes_the_partial_file() {
        let directory = ScratchDirectory::new().unwrap();
        let models = models_dir(directory.path());
        let cancel = AtomicBool::new(false);
        let result = store_stream(
            PAYLOAD,
            &models,
            &source(leaked_sha(), PAYLOAD.len() as u64),
            &cancel,
            &mut |progress| {
                if progress.downloaded_bytes == 0 {
                    cancel.store(true, Ordering::Release);
                }
            },
        );
        assert_eq!(result, Err(SpeechRecognitionError::DownloadCancelled));
        assert!(list_models(directory.path()).is_empty());
        assert!(!partial_path(&models, "ggml-small.en.bin").exists());
    }

    #[test]
    fn a_failed_retry_keeps_a_model_that_was_already_installed() {
        let directory = ScratchDirectory::new().unwrap();
        let models = models_dir(directory.path());
        fs::create_dir_all(&models).unwrap();
        fs::write(models.join("ggml-small.en.bin"), b"installed").unwrap();
        let _ = store_stream(
            PAYLOAD,
            &models,
            &source(PAYLOAD_SHA256, PAYLOAD.len() as u64),
            &AtomicBool::new(false),
            &mut |_| {},
        );
        assert_eq!(
            fs::read(models.join("ggml-small.en.bin")).unwrap(),
            b"installed"
        );
    }

    #[test]
    fn the_partial_file_is_never_listed_as_a_model() {
        let directory = ScratchDirectory::new().unwrap();
        let models = models_dir(directory.path());
        fs::create_dir_all(&models).unwrap();
        fs::write(partial_path(&models, "ggml-small.en.bin"), b"half").unwrap();
        assert!(list_models(directory.path()).is_empty());
    }
}
