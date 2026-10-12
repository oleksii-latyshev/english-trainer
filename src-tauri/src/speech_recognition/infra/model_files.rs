use crate::speech_recognition::{
    domain::{is_model_file_name, SpeechModel},
    error::SpeechRecognitionError,
    ports::ModelCatalog,
};
use std::{
    fs,
    path::{Path, PathBuf},
};

const MODEL_OVERRIDE_VARIABLE: &str = "ENG_TRAINER_WHISPER_MODEL";

pub struct ModelFiles {
    app_data: PathBuf,
}

impl ModelFiles {
    pub fn new(app_data: PathBuf) -> Self {
        Self { app_data }
    }
}

pub fn models_dir(app_data: &Path) -> PathBuf {
    app_data.join("models")
}

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

pub fn model_path(app_data: &Path, model_file: &str) -> PathBuf {
    model_path_from(
        app_data,
        model_file,
        std::env::var_os(MODEL_OVERRIDE_VARIABLE),
    )
}

fn model_path_from(
    app_data: &Path,
    model_file: &str,
    configured: Option<std::ffi::OsString>,
) -> PathBuf {
    configured
        .map(PathBuf::from)
        .unwrap_or_else(|| models_dir(app_data).join(model_file))
}

pub fn ready_model(model: &Path) -> Result<PathBuf, SpeechRecognitionError> {
    if !model.is_file() {
        return Err(SpeechRecognitionError::ModelMissing(format!(
            "Whisper model is missing at {}. Choose another model in Settings, or set ENG_TRAINER_WHISPER_MODEL to a local ggml model file, then restart the app.",
            model.display()
        )));
    }
    fs::canonicalize(model).map_err(|_| {
        SpeechRecognitionError::ModelMissing(
            "Cannot read the Whisper model. Check its permissions, then retry.".into(),
        )
    })
}

impl ModelCatalog for ModelFiles {
    fn list(&self) -> Vec<SpeechModel> {
        list_models(&self.app_data)
    }

    fn override_path(&self) -> Option<String> {
        std::env::var_os(MODEL_OVERRIDE_VARIABLE).map(|path| path.to_string_lossy().into_owned())
    }

    fn path(&self, model_file: &str) -> PathBuf {
        model_path(&self.app_data, model_file)
    }

    fn is_installed(&self, model_file: &str) -> bool {
        models_dir(&self.app_data).join(model_file).is_file()
    }

    fn ready_installed(&self, model_file: &str) -> Result<PathBuf, SpeechRecognitionError> {
        ready_model(&models_dir(&self.app_data).join(model_file))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::providers::agy::runner::ScratchDirectory;

    #[test]
    fn lists_present_models_smallest_first_without_partial_downloads() {
        let directory = ScratchDirectory::new().unwrap();
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

    #[test]
    fn a_missing_model_is_reported_as_missing() {
        let directory = ScratchDirectory::new().unwrap();
        assert!(matches!(
            ready_model(&directory.path().join("ggml-none.bin")),
            Err(SpeechRecognitionError::ModelMissing(_))
        ));
    }
}
