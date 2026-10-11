use super::error::GeminiKeyError;
use serde::{Deserialize, Serialize};
use ts_rs::TS;

const MIN_KEY_CHARS: usize = 20;
const MAX_KEY_CHARS: usize = 256;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "snake_case")]
#[ts(export)]
pub enum KeySource {
    Settings,
    Environment,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct GeminiKeyStatus {
    pub configured: bool,
    pub source: Option<KeySource>,
}

impl GeminiKeyStatus {
    pub fn missing() -> Self {
        Self {
            configured: false,
            source: None,
        }
    }

    pub fn from_source(source: KeySource) -> Self {
        Self {
            configured: true,
            source: Some(source),
        }
    }
}

pub fn validate_key(key: &str) -> Result<&str, GeminiKeyError> {
    let key = key.trim();
    let is_plausible = (MIN_KEY_CHARS..=MAX_KEY_CHARS).contains(&key.len())
        && key.chars().all(|character| character.is_ascii_graphic());
    if is_plausible {
        Ok(key)
    } else {
        Err(GeminiKeyError::Implausible)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const KEY: &str = "AIzaSyExampleExampleExample1";

    #[test]
    fn keys_are_trimmed_and_sanity_checked() {
        assert_eq!(validate_key(&format!("  {KEY}  ")).unwrap(), KEY);
        for bad in [
            "",
            "short",
            "has space inside the key value 123",
            "ключ-ключ-ключ-ключ-ключ",
        ] {
            assert!(matches!(
                validate_key(bad),
                Err(GeminiKeyError::Implausible)
            ));
        }
    }

    #[test]
    fn status_serializes_without_any_key_material() {
        assert_eq!(
            serde_json::to_value(GeminiKeyStatus::from_source(KeySource::Settings)).unwrap(),
            serde_json::json!({"configured": true, "source": "settings"})
        );
        assert_eq!(
            serde_json::to_value(GeminiKeyStatus::missing()).unwrap(),
            serde_json::json!({"configured": false, "source": null})
        );
    }
}
