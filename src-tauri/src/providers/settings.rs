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
    /// The `--model` value for this choice. `Default` is the pinned Gemini model, never agy's own default.
    pub(super) fn cli_id(self) -> &'static str {
        match self {
            Self::Default => super::agy::runner::AGY_DEFAULT_MODEL,
            Self::FlashLow => "gemini-3.8-flash-low",
            Self::FlashHigh => "gemini-3.8-flash-high",
        }
    }
}

/// How long and how lively Eva's replies are.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum EvaStyle {
    /// One or two short, simple sentences and a question.
    ShortAndSimple,
    /// Two to four natural sentences with a reaction of her own, then a question.
    #[default]
    Natural,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct AiSettings {
    pub provider: ConversationProvider,
    pub agy_model: AgyModel,
    /// Absent in settings saved before the style existed; those learners get the default.
    #[serde(default)]
    pub eva_style: EvaStyle,
}
