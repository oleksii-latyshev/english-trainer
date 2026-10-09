//! Predefined topics, start options validation, and deterministic opening questions.

use super::rules::OPENING_QUESTION;
use crate::providers::{ProviderError, ProviderErrorCode};
use serde::{Deserialize, Serialize};

pub const DEFAULT_DURATION_GOAL_SECONDS: u32 = 600;
pub const MAX_CUSTOM_TOPIC_CHARS: usize = 150;

pub const TOPIC_WORK_TECHNOLOGY: &str = "work_technology";
pub const TOPIC_DAILY_LIFE: &str = "daily_life";
pub const TOPIC_OPINIONS_DEBATES: &str = "opinions_debates";
pub const TOPIC_PLANS_STORIES: &str = "plans_stories";
pub const TOPIC_JOB_INTERVIEW_HR: &str = "job_interview_hr";
pub const TOPIC_JOB_INTERVIEW_BEHAVIOURAL: &str = "job_interview_behavioural";
pub const TOPIC_JOB_INTERVIEW_TECHNICAL: &str = "job_interview_technical";
pub const TOPIC_FREE_TOPIC: &str = "free_topic";
pub const TOPIC_FREE_CONVERSATION: &str = "free_conversation";

pub const PREDEFINED_TOPIC_IDS: &[&str] = &[
    TOPIC_WORK_TECHNOLOGY,
    TOPIC_DAILY_LIFE,
    TOPIC_OPINIONS_DEBATES,
    TOPIC_PLANS_STORIES,
    TOPIC_JOB_INTERVIEW_HR,
    TOPIC_JOB_INTERVIEW_BEHAVIOURAL,
    TOPIC_JOB_INTERVIEW_TECHNICAL,
];

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct TopicSelection {
    pub topic_id: String,
    pub topic_label: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub topic_custom: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(deny_unknown_fields)]
pub struct StartPracticeOptions {
    #[serde(default)]
    pub practice_mode: Option<PracticeMode>,
    pub topic_id: Option<String>,
    pub topic_custom: Option<String>,
    pub duration_goal_seconds: Option<u32>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "snake_case")]
pub enum PracticeMode {
    #[default]
    Voice,
    TextChat,
    WriteThenSpeak,
}

impl PracticeMode {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Voice => "voice",
            Self::TextChat => "text_chat",
            Self::WriteThenSpeak => "write_then_speak",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "snake_case")]
pub enum PracticePhase {
    Writing,
    WritingReview,
    #[default]
    Speaking,
    SpeakingReview,
}

impl PracticePhase {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Writing => "writing",
            Self::WritingReview => "writing_review",
            Self::Speaking => "speaking",
            Self::SpeakingReview => "speaking_review",
        }
    }

    pub fn is_review(self) -> bool {
        matches!(self, Self::WritingReview | Self::SpeakingReview)
    }
}

pub fn topic_label(topic_id: &str) -> &'static str {
    match topic_id {
        TOPIC_WORK_TECHNOLOGY => "Work & technology",
        TOPIC_DAILY_LIFE => "Daily life",
        TOPIC_OPINIONS_DEBATES => "Opinions & debates",
        TOPIC_PLANS_STORIES => "Plans & stories",
        TOPIC_JOB_INTERVIEW_HR => "Job interview (HR)",
        TOPIC_JOB_INTERVIEW_BEHAVIOURAL => "Job interview (Behavioural)",
        TOPIC_JOB_INTERVIEW_TECHNICAL => "Job interview (Technical)",
        TOPIC_FREE_TOPIC => "Free topic",
        TOPIC_FREE_CONVERSATION => "Free conversation",
        _ => "Free conversation",
    }
}

pub fn is_valid_topic_id(topic_id: &str) -> bool {
    matches!(
        topic_id,
        TOPIC_WORK_TECHNOLOGY
            | TOPIC_DAILY_LIFE
            | TOPIC_OPINIONS_DEBATES
            | TOPIC_PLANS_STORIES
            | TOPIC_JOB_INTERVIEW_HR
            | TOPIC_JOB_INTERVIEW_BEHAVIOURAL
            | TOPIC_JOB_INTERVIEW_TECHNICAL
            | TOPIC_FREE_TOPIC
            | TOPIC_FREE_CONVERSATION
            | "random"
    )
}

pub fn is_valid_duration_goal(seconds: u32) -> bool {
    matches!(seconds, 300 | 600 | 900)
}

pub fn validate_start_options(options: &StartPracticeOptions) -> Result<(), ProviderError> {
    if let Some(topic_id) = &options.topic_id {
        let trimmed = topic_id.trim();
        if !is_valid_topic_id(trimmed) {
            return Err(ProviderError::new(
                ProviderErrorCode::InvalidRequest,
                "Unknown topic. Please choose a valid practice topic.",
            ));
        }
    }

    if let Some(duration) = options.duration_goal_seconds {
        if !is_valid_duration_goal(duration) {
            return Err(ProviderError::new(
                ProviderErrorCode::InvalidRequest,
                "Session duration must be 5, 10, or 15 minutes.",
            ));
        }
    }

    if let Some(custom) = &options.topic_custom {
        let trimmed = custom.trim();
        if trimmed.chars().count() > MAX_CUSTOM_TOPIC_CHARS {
            return Err(ProviderError::new(
                ProviderErrorCode::InvalidRequest,
                "Custom topic must be 150 characters or fewer.",
            ));
        }
        if options
            .topic_id
            .as_deref()
            .is_some_and(|id| id.trim() != TOPIC_FREE_TOPIC)
            && !trimmed.is_empty()
        {
            return Err(ProviderError::new(
                ProviderErrorCode::InvalidRequest,
                "Custom topic text is only valid for a free topic.",
            ));
        }
    }

    if options
        .topic_id
        .as_deref()
        .is_some_and(|id| id.trim() == TOPIC_FREE_TOPIC)
        && options
            .topic_custom
            .as_deref()
            .is_none_or(|text| text.trim().is_empty())
    {
        return Err(ProviderError::new(
            ProviderErrorCode::InvalidRequest,
            "Enter a topic before starting a free-topic session.",
        ));
    }

    Ok(())
}

pub fn pick_random_predefined_topic(seed: usize) -> TopicSelection {
    use std::io::Read;
    let mut bytes = [0_u8; 8];
    let random = std::fs::File::open("/dev/urandom")
        .and_then(|mut file| file.read_exact(&mut bytes))
        .map(|()| u64::from_ne_bytes(bytes))
        .unwrap_or_else(|_| {
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map_or(seed as u64, |duration| duration.as_nanos() as u64)
        });
    let index = (random % PREDEFINED_TOPIC_IDS.len() as u64) as usize;
    let topic_id = PREDEFINED_TOPIC_IDS[index];
    TopicSelection {
        topic_id: topic_id.to_string(),
        topic_label: topic_label(topic_id).to_string(),
        topic_custom: None,
    }
}

const WORK_QUESTIONS: &[&str] = &[
    "What is a project or technical challenge you've been working on recently?",
    "What's a bug or technical problem you solved lately that felt satisfying to fix?",
    "How do you prefer to organise your daily software development work and workflow?",
];

const DAILY_QUESTIONS: &[&str] = &[
    "How has your week been going so far, and what has taken up most of your time?",
    "What is something you enjoy doing to unwind after a busy day?",
    "Have you picked up any new routines or habits lately that you've been enjoying?",
];

const OPINIONS_QUESTIONS: &[&str] = &[
    "Do you think fully remote work is better than working together in an office?",
    "What is a common opinion in software or tech that you strongly disagree with?",
    "Do you prefer deep technical specialisation, or being a generalist across different areas?",
];

const PLANS_QUESTIONS: &[&str] = &[
    "What is something you are planning or looking forward to over the coming weeks?",
    "Can you tell me about a memorable trip or unexpected experience you had recently?",
    "Is there a personal goal or creative project you've been wanting to make time for?",
];

const INTERVIEW_HR_QUESTIONS: &[&str] = &[
    "Could you introduce yourself and tell me a bit about your background and what you're looking for next?",
    "What kind of team environment and culture allows you to do your best work?",
    "Why are you interested in taking on a new challenge at this stage in your career?",
];

const INTERVIEW_BEHAVIOURAL_QUESTIONS: &[&str] = &[
    "Tell me about a time you had a technical disagreement with a teammate and how you handled it.",
    "Can you share an example of a project where priorities changed quickly, and how you adapted?",
    "Describe a situation where a project ran into an unexpected obstacle, and what you did.",
];

const INTERVIEW_TECHNICAL_QUESTIONS: &[&str] = &[
    "Can you walk me through the architecture of a system or service you designed recently?",
    "How do you approach investigating and resolving a subtle performance bottleneck in production?",
    "What trade-offs do you consider when choosing between a proven technology and a newer tool?",
];

const FREE_QUESTIONS: &[&str] = &[
    "What is something interesting that happened to you recently?",
    "What is on your mind today that you'd like to chat about?",
    "What is a topic or question you've been thinking about lately?",
];

pub fn topic_opening_question(topic_id: &str, custom_text: Option<&str>, seed: usize) -> String {
    if topic_id == TOPIC_FREE_TOPIC {
        if let Some(custom) = custom_text {
            let trimmed = custom.trim();
            if !trimmed.is_empty() {
                return format!(
                    "Let's talk about {trimmed}. What are your initial thoughts on it?"
                );
            }
        }
    }

    let questions = match topic_id {
        TOPIC_FREE_CONVERSATION => return OPENING_QUESTION.to_string(),
        TOPIC_WORK_TECHNOLOGY => WORK_QUESTIONS,
        TOPIC_DAILY_LIFE => DAILY_QUESTIONS,
        TOPIC_OPINIONS_DEBATES => OPINIONS_QUESTIONS,
        TOPIC_PLANS_STORIES => PLANS_QUESTIONS,
        TOPIC_JOB_INTERVIEW_HR => INTERVIEW_HR_QUESTIONS,
        TOPIC_JOB_INTERVIEW_BEHAVIOURAL => INTERVIEW_BEHAVIOURAL_QUESTIONS,
        TOPIC_JOB_INTERVIEW_TECHNICAL => INTERVIEW_TECHNICAL_QUESTIONS,
        _ => FREE_QUESTIONS,
    };

    let index = seed % questions.len();
    questions[index].to_string()
}

pub fn resolve_start_options(
    options: Option<StartPracticeOptions>,
    session_count: usize,
) -> Result<(TopicSelection, u32, String), ProviderError> {
    let options = options.unwrap_or_default();
    validate_start_options(&options)?;

    let duration_goal = options
        .duration_goal_seconds
        .unwrap_or(DEFAULT_DURATION_GOAL_SECONDS);

    let topic_id_raw = options
        .topic_id
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| TOPIC_FREE_CONVERSATION.to_string());

    let (selection, question) = if topic_id_raw == "random" {
        let picked = pick_random_predefined_topic(session_count);
        let question = topic_opening_question(&picked.topic_id, None, session_count);
        (picked, question)
    } else {
        let custom_trimmed = options
            .topic_custom
            .map(|c| c.trim().to_string())
            .filter(|c| !c.is_empty());

        let label = if topic_id_raw == TOPIC_FREE_TOPIC {
            if let Some(custom) = &custom_trimmed {
                custom.clone()
            } else {
                topic_label(&topic_id_raw).to_string()
            }
        } else {
            topic_label(&topic_id_raw).to_string()
        };

        let question =
            topic_opening_question(&topic_id_raw, custom_trimmed.as_deref(), session_count);

        let sel = TopicSelection {
            topic_id: topic_id_raw,
            topic_label: label,
            topic_custom: custom_trimmed,
        };
        (sel, question)
    };

    Ok((selection, duration_goal, question))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validates_topic_duration_and_free_text_bounds() {
        let valid = StartPracticeOptions {
            practice_mode: None,
            topic_id: Some(TOPIC_FREE_TOPIC.into()),
            topic_custom: Some("  Open source software  ".into()),
            duration_goal_seconds: Some(900),
        };
        assert!(validate_start_options(&valid).is_ok());
        assert!(validate_start_options(&StartPracticeOptions {
            topic_id: Some("unknown".into()),
            ..Default::default()
        })
        .is_err());
        assert!(validate_start_options(&StartPracticeOptions {
            duration_goal_seconds: Some(420),
            ..Default::default()
        })
        .is_err());
        assert!(validate_start_options(&StartPracticeOptions {
            topic_id: Some(TOPIC_FREE_TOPIC.into()),
            topic_custom: Some("x".repeat(151)),
            ..Default::default()
        })
        .is_err());
        assert!(validate_start_options(&StartPracticeOptions {
            topic_id: Some(TOPIC_FREE_TOPIC.into()),
            ..Default::default()
        })
        .is_err());
    }

    #[test]
    fn opening_questions_vary_between_repeated_sessions_and_match_the_topic() {
        let first = topic_opening_question(TOPIC_WORK_TECHNOLOGY, None, 0);
        let second = topic_opening_question(TOPIC_WORK_TECHNOLOGY, None, 1);
        let daily = topic_opening_question(TOPIC_DAILY_LIFE, None, 0);
        assert_ne!(first, second);
        assert_ne!(first, daily);
    }

    #[test]
    fn random_selection_always_resolves_to_a_predefined_topic() {
        for seed in 0..100 {
            let selection = pick_random_predefined_topic(seed);
            assert!(PREDEFINED_TOPIC_IDS.contains(&selection.topic_id.as_str()));
            assert_eq!(selection.topic_label, topic_label(&selection.topic_id));
        }
    }
}
