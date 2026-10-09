use serde::{Deserialize, Serialize};
use std::{
    fs,
    path::{Path, PathBuf},
};

/// Measured on the learner's recordings (F3): the most accurate model that is also fast enough
/// to answer in well under 1.5 s with the model kept loaded.
const PREFERRED_MODEL_FILE: &str = "ggml-small.en.bin";
const FALLBACK_MODEL_FILE: &str = "ggml-base.en.bin";

/// Where the learner's choices live: Whisper model, raw-audio retention, live transcript.
/// An empty `model_file` means the learner has not chosen; `effective_model_file` picks one.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct SpeechSettings {
    pub model_file: String,
    pub keep_raw_audio: bool,
    pub live_transcript: bool,
}

impl Default for SpeechSettings {
    fn default() -> Self {
        Self {
            model_file: String::new(),
            keep_raw_audio: false,
            live_transcript: true,
        }
    }
}

/// The model file to use: the learner's choice, else small.en when installed, else base.en.
pub fn effective_model_file(app_data: &Path, chosen: &str) -> String {
    if !chosen.is_empty() {
        return chosen.to_string();
    }
    let has_preferred = models_dir(app_data).join(PREFERRED_MODEL_FILE).is_file();
    if has_preferred {
        PREFERRED_MODEL_FILE
    } else {
        FALLBACK_MODEL_FILE
    }
    .to_string()
}

impl SpeechSettings {
    /// The same settings with the model choice resolved, as the rest of the app should see them.
    pub fn resolved(self, app_data: &Path) -> Self {
        Self {
            model_file: effective_model_file(app_data, &self.model_file),
            ..self
        }
    }
}

/// Live partial transcripts re-run the model every ~1.5 s, which only the small models do fast
/// enough on a Mac (measured: small.en 0.3 s warm, large-v3-turbo 1.2 s).
pub fn is_light_model(model_file: &str) -> bool {
    let name = model_file.strip_prefix("ggml-").unwrap_or(model_file);
    ["tiny", "base", "small"].iter().any(|size| {
        name.strip_prefix(size)
            .is_some_and(|rest| rest.starts_with(['.', '-', '_']))
    })
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
    fn an_unchosen_model_is_small_when_installed_and_base_otherwise() {
        let directory = crate::providers::agy::runner::ScratchDirectory::new().unwrap();
        assert_eq!(
            effective_model_file(directory.path(), ""),
            "ggml-base.en.bin"
        );
        let models = models_dir(directory.path());
        fs::create_dir(&models).unwrap();
        fs::write(models.join("ggml-small.en.bin"), b"x").unwrap();
        assert_eq!(
            effective_model_file(directory.path(), ""),
            "ggml-small.en.bin"
        );
        assert_eq!(
            effective_model_file(directory.path(), "ggml-base.en.bin"),
            "ggml-base.en.bin"
        );
    }

    #[test]
    fn only_the_small_models_are_light() {
        for light in [
            "ggml-tiny.en.bin",
            "ggml-base.en.bin",
            "ggml-small.en.bin",
            "ggml-small.bin",
            "ggml-base-q5_1.bin",
        ] {
            assert!(is_light_model(light), "{light}");
        }
        for heavy in [
            "ggml-medium.en.bin",
            "ggml-large-v3-turbo-q5_0.bin",
            "ggml-basement.bin",
        ] {
            assert!(!is_light_model(heavy), "{heavy}");
        }
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
