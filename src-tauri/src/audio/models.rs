use serde::{Deserialize, Serialize};
use std::{
    fs,
    path::{Path, PathBuf},
};

pub const DEFAULT_MODEL_FILE: &str = "ggml-base.en.bin";

/// Where the learner's choice and the speech settings live: Whisper model and raw-audio retention.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct SpeechSettings {
    pub model_file: String,
    pub keep_raw_audio: bool,
}

impl Default for SpeechSettings {
    fn default() -> Self {
        Self {
            model_file: DEFAULT_MODEL_FILE.into(),
            keep_raw_audio: false,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct SpeechModel {
    pub file: String,
    pub size_bytes: u64,
}

pub fn models_dir(app_data: &Path) -> PathBuf {
    app_data.join("models")
}

/// A plain `ggml-*.bin` file name; partial downloads (`.part`) and paths are not models.
pub fn is_model_file_name(name: &str) -> bool {
    const PREFIX: &str = "ggml-";
    const SUFFIX: &str = ".bin";
    name.len() > PREFIX.len() + SUFFIX.len()
        && name.starts_with(PREFIX)
        && name.ends_with(SUFFIX)
        && name
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '-' | '_'))
}

/// The ggml models present in the models folder, smallest first.
pub fn list_models(app_data: &Path) -> Vec<SpeechModel> {
    let Ok(entries) = fs::read_dir(models_dir(app_data)) else {
        return Vec::new();
    };
    let mut models: Vec<SpeechModel> = entries
        .filter_map(Result::ok)
        .filter_map(|entry| {
            let file = entry.file_name().into_string().ok()?;
            let metadata = entry.metadata().ok()?;
            (is_model_file_name(&file) && metadata.is_file()).then_some(SpeechModel {
                file,
                size_bytes: metadata.len(),
            })
        })
        .collect();
    models.sort_by(|a, b| (a.size_bytes, &a.file).cmp(&(b.size_bytes, &b.file)));
    models
}

/// `ENG_TRAINER_WHISPER_MODEL` wins over the learner's choice so a developer can pin a model.
pub fn model_path(app_data: &Path, model_file: &str) -> PathBuf {
    model_path_from(
        app_data,
        model_file,
        std::env::var_os("ENG_TRAINER_WHISPER_MODEL"),
    )
}

pub(super) fn model_path_from(
    app_data: &Path,
    model_file: &str,
    configured: Option<std::ffi::OsString>,
) -> PathBuf {
    configured
        .map(PathBuf::from)
        .unwrap_or_else(|| models_dir(app_data).join(model_file))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_plain_ggml_bin_names_are_models() {
        assert!(is_model_file_name("ggml-base.en.bin"));
        assert!(is_model_file_name("ggml-large-v3-turbo-q5_0.bin"));
        assert!(!is_model_file_name("ggml-small.en.bin.part"));
        assert!(!is_model_file_name("ggml-.bin"));
        assert!(!is_model_file_name("../ggml-base.en.bin"));
        assert!(!is_model_file_name("ggml-a/b.bin"));
        assert!(!is_model_file_name("base.en.bin"));
    }

    #[test]
    fn lists_present_models_smallest_first_without_partial_downloads() {
        let directory = crate::providers::agy::runner::ScratchDirectory::new().unwrap();
        let models = models_dir(directory.path());
        fs::create_dir(&models).unwrap();
        fs::write(models.join("ggml-small.en.bin"), vec![0; 30]).unwrap();
        fs::write(models.join("ggml-base.en.bin"), vec![0; 10]).unwrap();
        fs::write(models.join("ggml-medium.en.bin.part"), vec![0; 99]).unwrap();
        fs::write(models.join("notes.txt"), b"x").unwrap();
        let files: Vec<String> = list_models(directory.path())
            .into_iter()
            .map(|model| model.file)
            .collect();
        assert_eq!(files, ["ggml-base.en.bin", "ggml-small.en.bin"]);
        assert!(list_models(&directory.path().join("missing")).is_empty());
    }

    #[test]
    fn model_path_prefers_the_override_then_the_chosen_file() {
        assert_eq!(
            model_path_from(Path::new("/data"), "ggml-small.en.bin", None),
            PathBuf::from("/data/models/ggml-small.en.bin")
        );
        assert_eq!(
            model_path_from(
                Path::new("/data"),
                "ggml-small.en.bin",
                Some(std::ffi::OsString::from("/custom/model.bin"))
            ),
            PathBuf::from("/custom/model.bin")
        );
    }
}
