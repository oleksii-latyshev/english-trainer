use crate::conversation::SessionStore;
use crate::speech_recognition::{
    domain::{AnswerContext, SettingsChange, SpeechSettings},
    error::SpeechRecognitionError,
    ports::{GlossaryStore, PortResult, PracticeConversation, SettingsStore},
};

#[derive(Clone)]
pub struct SessionSpeechStore {
    sessions: SessionStore,
}

impl SessionSpeechStore {
    pub fn new(sessions: SessionStore) -> Self {
        Self { sessions }
    }
}

impl SettingsStore for SessionSpeechStore {
    fn load(&self) -> PortResult<SpeechSettings> {
        self.sessions
            .speech_settings()
            .map_err(|_| SpeechRecognitionError::SettingsStorage)
    }

    fn apply(&self, change: &SettingsChange) -> PortResult<SpeechSettings> {
        self.sessions
            .update_speech_settings(|settings| change.apply(settings))
            .map_err(|_| SpeechRecognitionError::SettingsStorage)
    }
}

impl GlossaryStore for SessionSpeechStore {
    fn terms(&self) -> PortResult<Vec<String>> {
        self.sessions
            .glossary_terms()
            .map_err(|_| SpeechRecognitionError::SettingsStorage)
    }

    fn effective_terms(&self) -> PortResult<Vec<String>> {
        self.sessions
            .effective_glossary_terms()
            .map_err(|_| SpeechRecognitionError::SettingsStorage)
    }

    fn replace(&self, terms: &[String]) -> PortResult<()> {
        self.sessions
            .save_glossary_terms(terms.to_vec())
            .map(drop)
            .map_err(|_| SpeechRecognitionError::SettingsStorage)
    }
}

impl PracticeConversation for SessionSpeechStore {
    fn next_turn_slot(&self) -> Option<(u64, usize)> {
        self.sessions.next_turn_slot()
    }

    fn answer_context(&self) -> Option<AnswerContext> {
        self.sessions.answer_context()
    }

    fn rescue_question(
        &self,
        session_id: u64,
        sequence: usize,
        question: Option<&str>,
    ) -> PortResult<String> {
        self.sessions
            .rescue_question(session_id, sequence, question)
            .map_err(SpeechRecognitionError::Conversation)
    }
}
