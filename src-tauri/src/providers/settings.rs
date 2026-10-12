use crate::ai_settings::AgyModel;

impl AgyModel {
    pub(super) fn cli_id(self) -> &'static str {
        match self {
            Self::Default => super::agy::runner::AGY_DEFAULT_MODEL,
            Self::FlashLow => "gemini-3.8-flash-low",
            Self::FlashHigh => "gemini-3.8-flash-high",
        }
    }
}
