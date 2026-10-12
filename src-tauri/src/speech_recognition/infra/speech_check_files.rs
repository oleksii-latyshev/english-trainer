use super::private_files;
use crate::speech_recognition::{
    domain::{CheckRecording, SpeechCheckResults, SENTENCE_COUNT},
    error::SpeechRecognitionError,
    ports::{PortResult, SpeechCheckStore},
};
use std::{
    fs, io,
    path::{Path, PathBuf},
};

pub struct SpeechCheckFiles {
    directory: PathBuf,
}

impl SpeechCheckFiles {
    pub fn new(app_data: &Path) -> Self {
        Self {
            directory: app_data.join("speech-check"),
        }
    }

    fn wav_path(&self, index: u32) -> PathBuf {
        self.directory.join(format!("{}.wav", stem(index)))
    }

    fn text_path(&self, index: u32) -> PathBuf {
        self.directory.join(format!("{}.txt", stem(index)))
    }
}

fn stem(index: u32) -> String {
    format!("{index:02}")
}

fn storage_failure(message: &'static str) -> impl Fn(io::Error) -> SpeechRecognitionError {
    move |_| SpeechRecognitionError::Storage(message.into())
}

impl SpeechCheckStore for SpeechCheckFiles {
    fn recorded_indices(&self) -> Vec<u32> {
        (1..=SENTENCE_COUNT)
            .filter(|index| self.wav_path(*index).is_file())
            .collect()
    }

    fn recordings(&self) -> Vec<CheckRecording> {
        (1..=SENTENCE_COUNT)
            .filter_map(|index| {
                let path = self.wav_path(index);
                let reference = fs::read_to_string(self.text_path(index)).ok()?;
                path.is_file().then_some(CheckRecording {
                    index,
                    reference,
                    path,
                })
            })
            .collect()
    }

    fn results(&self) -> SpeechCheckResults {
        fs::read_to_string(self.directory.join("results.json"))
            .ok()
            .and_then(|json| serde_json::from_str(&json).ok())
            .unwrap_or_default()
    }

    fn save_recording(&self, index: u32, sentence: &str, wav: &[u8]) -> PortResult<()> {
        let failure = storage_failure(
            "Cannot save the recording locally. Check disk space, then record again.",
        );
        private_files::create_dir_all(&self.directory).map_err(&failure)?;
        private_files::write(&self.wav_path(index), wav).map_err(&failure)?;
        private_files::write(&self.text_path(index), sentence.as_bytes()).map_err(&failure)
    }

    fn save_results(&self, results: &SpeechCheckResults) -> PortResult<()> {
        let json = serde_json::to_vec(results).map_err(|_| {
            SpeechRecognitionError::Storage("Cannot save the measurements. Please retry.".into())
        })?;
        private_files::write(&self.directory.join("results.json"), &json).map_err(storage_failure(
            "Cannot save the measurements locally. Please retry.",
        ))
    }

    fn delete_all(&self) -> PortResult<()> {
        match fs::remove_dir_all(&self.directory) {
            Err(error) if error.kind() != io::ErrorKind::NotFound => {
                Err(SpeechRecognitionError::Storage(
                    "Cannot delete the speech check recordings. Close anything using them, then retry."
                        .into(),
                ))
            }
            _ => Ok(()),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::providers::agy::runner::ScratchDirectory;

    #[test]
    fn a_recording_is_stored_with_its_sentence_and_replaced_by_a_redo() {
        let directory = ScratchDirectory::new().unwrap();
        let files = SpeechCheckFiles::new(directory.path());
        assert!(files.recorded_indices().is_empty());
        files.save_recording(3, "Third sentence.", b"one").unwrap();
        files.save_recording(3, "Third sentence.", b"two").unwrap();
        assert_eq!(files.recorded_indices(), [3]);
        let recordings = files.recordings();
        assert_eq!(recordings.len(), 1);
        assert_eq!(recordings[0].reference, "Third sentence.");
        assert_eq!(fs::read(&recordings[0].path).unwrap(), b"two");
    }

    #[test]
    fn results_survive_and_an_unreadable_file_reads_as_empty() {
        let directory = ScratchDirectory::new().unwrap();
        let files = SpeechCheckFiles::new(directory.path());
        files.save_recording(1, "One.", b"a").unwrap();
        files.save_results(&SpeechCheckResults::default()).unwrap();
        assert_eq!(files.results(), SpeechCheckResults::default());
        fs::write(directory.path().join("speech-check/results.json"), b"{").unwrap();
        assert_eq!(files.results(), SpeechCheckResults::default());
    }

    #[test]
    fn deleting_removes_recordings_and_is_harmless_when_there_are_none() {
        let directory = ScratchDirectory::new().unwrap();
        let files = SpeechCheckFiles::new(directory.path());
        files.delete_all().unwrap();
        files.save_recording(2, "Two.", b"a").unwrap();
        files.delete_all().unwrap();
        assert!(files.recorded_indices().is_empty());
    }
}
