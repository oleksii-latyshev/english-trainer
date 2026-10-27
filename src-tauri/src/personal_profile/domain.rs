use serde::{Deserialize, Serialize};
use ts_rs::TS;

pub const MAX_PROFILE_FIELD_CHARS: usize = 150;
pub const MAX_PROFILE_NAME_CHARS: usize = 40;
const MAX_GLOSSARY_TERM_CHARS: usize = 40;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS, Default)]
#[serde(deny_unknown_fields)]
#[ts(export)]
pub struct PersonalProfile {
    #[serde(default)]
    pub name: String,
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
    pub fn trimmed(&self) -> Self {
        Self {
            name: self.name.trim().to_string(),
            role: self.role.trim().to_string(),
            stack: self.stack.trim().to_string(),
            interests: self.interests.trim().to_string(),
            goals: self.goals.trim().to_string(),
        }
    }

    pub fn without_name(&self) -> Self {
        Self {
            name: String::new(),
            ..self.clone()
        }
    }

    pub fn first_field_over_limit(&self) -> Option<&'static str> {
        if self.name.trim().chars().count() > MAX_PROFILE_NAME_CHARS {
            return Some("Name");
        }
        [
            ("Role", &self.role),
            ("Stack", &self.stack),
            ("Interests", &self.interests),
            ("Goals", &self.goals),
        ]
        .into_iter()
        .find(|(_, value)| value.trim().chars().count() > MAX_PROFILE_FIELD_CHARS)
        .map(|(name, _)| name)
    }

    pub fn extract_glossary_terms(&self) -> Vec<String> {
        let mut terms = Vec::new();
        let role = self.role.trim();
        if !role.is_empty() {
            terms.push(role.to_string());
        }
        for list in [&self.stack, &self.interests] {
            for chunk in list.split(',') {
                let term = chunk.trim();
                if !term.is_empty()
                    && term.chars().count() <= MAX_GLOSSARY_TERM_CHARS
                    && !terms.iter().any(|known| known.eq_ignore_ascii_case(term))
                {
                    terms.push(term.to_string());
                }
            }
        }
        terms
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn trimming_strips_outer_whitespace_from_every_field() {
        let profile = PersonalProfile {
            name: "  Oleksii ".into(),
            role: "  Engineer ".into(),
            stack: " Rust ".into(),
            interests: " ".into(),
            goals: "\tSpeak\n".into(),
        };
        assert_eq!(
            profile.trimmed(),
            PersonalProfile {
                name: "Oleksii".into(),
                role: "Engineer".into(),
                stack: "Rust".into(),
                interests: String::new(),
                goals: "Speak".into(),
            }
        );
    }

    #[test]
    fn names_the_first_field_over_the_limit() {
        let within = PersonalProfile {
            role: "x".repeat(MAX_PROFILE_FIELD_CHARS),
            ..Default::default()
        };
        assert_eq!(within.first_field_over_limit(), None);
        let over = PersonalProfile {
            stack: "x".repeat(MAX_PROFILE_FIELD_CHARS + 1),
            ..Default::default()
        };
        assert_eq!(over.first_field_over_limit(), Some("Stack"));
    }

    #[test]
    fn the_name_has_its_own_forty_character_limit() {
        let within = PersonalProfile {
            name: format!(" {} ", "x".repeat(MAX_PROFILE_NAME_CHARS)),
            ..Default::default()
        };
        assert_eq!(within.first_field_over_limit(), None);
        let over = PersonalProfile {
            name: "x".repeat(MAX_PROFILE_NAME_CHARS + 1),
            ..Default::default()
        };
        assert_eq!(over.first_field_over_limit(), Some("Name"));
    }

    #[test]
    fn providers_see_the_profile_without_the_name() {
        let profile = PersonalProfile {
            name: "Oleksii".into(),
            role: "Engineer".into(),
            ..Default::default()
        };
        let shared = profile.without_name();
        assert_eq!(shared.name, "");
        assert_eq!(shared.role, "Engineer");
    }

    #[test]
    fn glossary_terms_come_from_role_stack_and_interests_without_duplicates() {
        let profile = PersonalProfile {
            name: "Oleksii".into(),
            role: "Engineer".into(),
            stack: "Rust, Tauri".into(),
            interests: "tauri, hiking".into(),
            goals: "Speak more naturally".into(),
        };
        assert_eq!(
            profile.extract_glossary_terms(),
            ["Engineer", "Rust", "Tauri", "hiking"]
        );
    }
}
