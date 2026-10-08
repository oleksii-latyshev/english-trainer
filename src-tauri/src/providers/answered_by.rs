//! Which model produced a conversation reply, recorded with the turn so the learner can see it.

use super::AgyModel;
use serde::{Deserialize, Serialize};

pub(super) const GEMINI_CONVERSATION_MODEL: &str = "gemini-3.5-flash-lite";
pub(super) const APPLE_MODEL: &str = "apple-foundation-models";

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AnswerProvider {
    Gemini,
    Apple,
    Agy,
}

impl AnswerProvider {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Gemini => "gemini",
            Self::Apple => "apple",
            Self::Agy => "agy",
        }
    }

    pub fn parse(value: &str) -> Option<Self> {
        match value {
            "gemini" => Some(Self::Gemini),
            "apple" => Some(Self::Apple),
            "agy" => Some(Self::Agy),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AnsweredBy {
    pub provider: AnswerProvider,
    pub model: String,
    /// True when this model answered because the provider the learner chose stalled or failed.
    pub is_backup: bool,
}

impl AnsweredBy {
    pub fn gemini() -> Self {
        Self {
            provider: AnswerProvider::Gemini,
            model: GEMINI_CONVERSATION_MODEL.into(),
            is_backup: false,
        }
    }

    pub fn apple(is_backup: bool) -> Self {
        Self {
            provider: AnswerProvider::Apple,
            model: APPLE_MODEL.into(),
            is_backup,
        }
    }

    pub fn agy(model: AgyModel) -> Self {
        Self {
            provider: AnswerProvider::Agy,
            model: model.cli_id().into(),
            is_backup: false,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn labels_name_provider_model_and_backup_role() {
        assert_eq!(AnsweredBy::gemini().model, "gemini-3.5-flash-lite");
        let backup = AnsweredBy::apple(true);
        assert_eq!(backup.provider, AnswerProvider::Apple);
        assert!(backup.is_backup);
        assert_eq!(
            AnsweredBy::agy(AgyModel::FlashLow).model,
            "gemini-3.8-flash-low"
        );
        assert_eq!(
            AnsweredBy::agy(AgyModel::Default).model,
            "gemini-3.8-flash-medium"
        );
    }

    #[test]
    fn provider_text_round_trips() {
        for provider in [
            AnswerProvider::Gemini,
            AnswerProvider::Apple,
            AnswerProvider::Agy,
        ] {
            assert_eq!(AnswerProvider::parse(provider.as_str()), Some(provider));
        }
        assert_eq!(AnswerProvider::parse("other"), None);
    }
}
