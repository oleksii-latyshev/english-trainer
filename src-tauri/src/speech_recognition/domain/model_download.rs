use serde::Serialize;
use ts_rs::TS;

pub struct ModelSource {
    pub file: &'static str,
    pub url: &'static str,
    pub sha256: &'static str,
    pub size_bytes: u64,
}

pub const PREFERRED_MODEL_SOURCE: ModelSource = ModelSource {
    file: "ggml-small.en.bin",
    url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/5359861c739e955e79d9a303bcbc70fb988958b1/ggml-small.en.bin",
    sha256: "c6138d6d58ecc8322097e0f987c32f1be8bb0a18532a3f88f734d1bbf9c41e5d",
    size_bytes: 487_614_201,
};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, TS)]
#[ts(export)]
pub struct ModelDownloadProgress {
    pub downloaded_bytes: u64,
    pub total_bytes: u64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, TS)]
#[ts(export)]
pub struct ModelDownloadOffer {
    pub file: String,
    pub size_bytes: u64,
    pub is_installed: bool,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_pinned_model_is_the_preferred_small_english_model() {
        assert_eq!(
            PREFERRED_MODEL_SOURCE.file,
            super::super::PREFERRED_MODEL_FILE
        );
        assert!(PREFERRED_MODEL_SOURCE
            .url
            .starts_with("https://huggingface.co/"));
        assert!(PREFERRED_MODEL_SOURCE
            .url
            .ends_with(PREFERRED_MODEL_SOURCE.file));
        assert_eq!(PREFERRED_MODEL_SOURCE.sha256.len(), 64);
    }
}
