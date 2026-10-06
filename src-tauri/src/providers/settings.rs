use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ConversationProvider {
    #[default]
    Gemini,
    Apple,
    Agy,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
pub enum AgyModel {
    #[default]
    #[serde(rename = "default")]
    Default,
    #[serde(rename = "gemini-3.8-flash-low")]
    FlashLow,
    #[serde(rename = "gemini-3.8-flash-high")]
    FlashHigh,
}

impl AgyModel {
    pub(super) fn cli_id(self) -> Option<&'static str> {
        match self {
            Self::Default => None,
            Self::FlashLow => Some("gemini-3.8-flash-low"),
            Self::FlashHigh => Some("gemini-3.8-flash-high"),
        }
    }
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct AiSettings {
    pub provider: ConversationProvider,
    pub agy_model: AgyModel,
}
