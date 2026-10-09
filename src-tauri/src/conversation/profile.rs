//! Personal profile for learner background (role, stack, interests, goals).

use crate::providers::{ProviderError, ProviderErrorCode};
use serde::{Deserialize, Serialize};

pub const MAX_PROFILE_FIELD_CHARS: usize = 150;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(deny_unknown_fields)]
pub struct PersonalProfile {
    #[serde(default)]
    pub role: String,
    #[serde(default)]
    pub stack: String,
    #[serde(default)]
    pub interests: String,
    #[serde(default)]
    pub goals: String,
}

impl PersonalProfile {
    pub fn validate(&self) -> Result<(), ProviderError> {
        for (field_name, value) in [
            ("Role", &self.role),
            ("Stack", &self.stack),
            ("Interests", &self.interests),
            ("Goals", &self.goals),
        ] {
            if value.trim().chars().count() > MAX_PROFILE_FIELD_CHARS {
                return Err(ProviderError::new(
                    ProviderErrorCode::InvalidRequest,
                    format!("{field_name} must be 150 characters or fewer."),
                ));
            }
        }
        Ok(())
    }

    /// Feeds profile terms into the effective STT glossary: comma-separated stack, interests, and role.
    pub fn extract_glossary_terms(&self) -> Vec<String> {
        let mut terms = Vec::new();
        let role = self.role.trim();
        if !role.is_empty() {
            terms.push(role.to_string());
        }

        for chunk in self.stack.split(',') {
            let term = chunk.trim();
            if !term.is_empty()
                && term.chars().count() <= 40
                && !terms.iter().any(|t| t.eq_ignore_ascii_case(term))
            {
                terms.push(term.to_string());
            }
        }

        for chunk in self.interests.split(',') {
            let term = chunk.trim();
            if !term.is_empty()
                && term.chars().count() <= 40
                && !terms.iter().any(|t| t.eq_ignore_ascii_case(term))
            {
                terms.push(term.to_string());
            }
        }

        terms
    }
}
