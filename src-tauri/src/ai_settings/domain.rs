use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "snake_case")]
#[ts(export)]
pub enum ConversationProvider {
    #[default]
    Gemini,
    Apple,
    Agy,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
pub enum AgyModel {
    #[default]
    #[serde(rename = "default")]
    Default,
    #[serde(rename = "gemini-3.8-flash-low")]
    FlashLow,
    #[serde(rename = "gemini-3.8-flash-high")]
    FlashHigh,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "snake_case")]
#[ts(export)]
pub enum EvaStyle {
    ShortAndSimple,
    #[default]
    Natural,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(deny_unknown_fields)]
#[ts(export)]
pub struct AiSettings {
    pub provider: ConversationProvider,
    pub agy_model: AgyModel,
    #[serde(default)]
    pub eva_style: EvaStyle,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn defaults_are_gemini_with_the_pinned_model_and_natural_style() {
        assert_eq!(
            serde_json::to_value(AiSettings::default()).unwrap(),
            serde_json::json!({"provider": "gemini", "agy_model": "default", "eva_style": "natural"})
        );
    }

    #[test]
    fn unknown_providers_and_models_are_rejected() {
        assert!(serde_json::from_str::<AiSettings>(
            r#"{"provider":"unknown","agy_model":"default"}"#
        )
        .is_err());
        assert!(serde_json::from_str::<AiSettings>(
            r#"{"provider":"agy","agy_model":"arbitrary"}"#
        )
        .is_err());
        assert!(serde_json::from_str::<AiSettings>(
            r#"{"provider":"apple","agy_model":"default","eva_style":"chatty"}"#
        )
        .is_err());
    }

    #[test]
    fn settings_saved_before_the_style_existed_read_as_natural() {
        let settings: AiSettings =
            serde_json::from_str(r#"{"provider":"apple","agy_model":"default"}"#).unwrap();
        assert_eq!(settings.provider, ConversationProvider::Apple);
        assert_eq!(settings.eva_style, EvaStyle::Natural);
    }
}
