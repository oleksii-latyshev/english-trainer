use serde::{Deserialize, Serialize};
use ts_rs::TS;

pub const PREFERRED_MODEL_FILE: &str = "ggml-small.en.bin";
const FALLBACK_MODEL_FILE: &str = "ggml-base.en.bin";

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(deny_unknown_fields)]
#[ts(export)]
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

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SettingsChange {
    ModelFile(String),
    LiveTranscript(bool),
    KeepRawAudio(bool),
}

impl SettingsChange {
    pub fn apply(&self, settings: &mut SpeechSettings) {
        match self {
            Self::ModelFile(file) => settings.model_file.clone_from(file),
            Self::LiveTranscript(enabled) => settings.live_transcript = *enabled,
            Self::KeepRawAudio(enabled) => settings.keep_raw_audio = *enabled,
        }
    }
}

pub fn effective_model_file(chosen: &str, preferred_installed: bool) -> String {
    if !chosen.is_empty() {
        return chosen.to_string();
    }
    if preferred_installed {
        PREFERRED_MODEL_FILE
    } else {
        FALLBACK_MODEL_FILE
    }
    .to_string()
}

impl SpeechSettings {
    pub fn resolved(self, preferred_installed: bool) -> Self {
        Self {
            model_file: effective_model_file(&self.model_file, preferred_installed),
            ..self
        }
    }

    pub fn is_live_transcript_available(&self) -> bool {
        self.live_transcript && is_light_model(&self.model_file)
    }
}

pub fn is_light_model(model_file: &str) -> bool {
    let name = model_file.strip_prefix("ggml-").unwrap_or(model_file);
    ["tiny", "base", "small"].iter().any(|size| {
        name.strip_prefix(size)
            .is_some_and(|rest| rest.starts_with(['.', '-', '_']))
    })
}

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

#[derive(Debug, Clone, PartialEq, Eq, Serialize, TS)]
#[ts(export)]
pub struct SpeechModel {
    pub file: String,
    pub size_bytes: u64,
}

#[derive(Debug, Serialize, TS)]
#[ts(export)]
pub struct SpeechModels {
    pub models: Vec<SpeechModel>,
    pub override_path: Option<String>,
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
    fn an_unchosen_model_is_small_when_installed_and_base_otherwise() {
        assert_eq!(effective_model_file("", false), "ggml-base.en.bin");
        assert_eq!(effective_model_file("", true), "ggml-small.en.bin");
        assert_eq!(
            effective_model_file("ggml-base.en.bin", true),
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
    fn each_change_touches_only_its_own_field() {
        let mut settings = SpeechSettings::default();
        SettingsChange::KeepRawAudio(true).apply(&mut settings);
        SettingsChange::ModelFile("ggml-small.en.bin".into()).apply(&mut settings);
        SettingsChange::LiveTranscript(false).apply(&mut settings);
        assert_eq!(
            settings,
            SpeechSettings {
                model_file: "ggml-small.en.bin".into(),
                keep_raw_audio: true,
                live_transcript: false
            }
        );
    }

    #[test]
    fn live_transcript_needs_the_switch_and_a_light_model() {
        let settings = |model: &str, live| SpeechSettings {
            model_file: model.into(),
            live_transcript: live,
            ..SpeechSettings::default()
        };
        assert!(settings("ggml-small.en.bin", true).is_live_transcript_available());
        assert!(!settings("ggml-small.en.bin", false).is_live_transcript_available());
        assert!(!settings("ggml-medium.en.bin", true).is_live_transcript_available());
    }
}
