use crate::conversation::error::ConversationError;
use crate::conversation::SessionStore;
use crate::speech_recognition::{AnswerContext, SpeechSettings};

impl SessionStore {
    pub fn speech_settings(&self) -> Result<SpeechSettings, ConversationError> {
        Ok(self.lock().database.speech_settings()?)
    }

    pub fn update_speech_settings(
        &self,
        change: impl FnOnce(&mut SpeechSettings),
    ) -> Result<SpeechSettings, ConversationError> {
        let state = self.lock();
        let mut settings = state.database.speech_settings()?;
        change(&mut settings);
        state.database.save_speech_settings(&settings)?;
        Ok(settings)
    }

    pub fn glossary_terms(&self) -> Result<Vec<String>, ConversationError> {
        Ok(self.lock().database.glossary_terms()?)
    }

    pub fn save_glossary_terms(
        &self,
        terms: Vec<String>,
    ) -> Result<Vec<String>, ConversationError> {
        self.lock().database.replace_glossary_terms(&terms)?;
        Ok(terms)
    }

    pub fn next_turn_slot(&self) -> Option<(u64, usize)> {
        self.lock()
            .active
            .as_ref()
            .map(|session| (session.id, session.turns.len() + 1))
    }

    pub fn answer_context(&self) -> Option<AnswerContext> {
        self.lock().active.as_ref().map(|session| AnswerContext {
            question: session.current_question(),
            recent_answers: session
                .turns
                .iter()
                .map(|turn| turn.learner.clone())
                .collect(),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn changing_one_setting_keeps_the_other() {
        let store = SessionStore::default();
        store
            .update_speech_settings(|settings| settings.keep_raw_audio = true)
            .unwrap();
        let settings = store
            .update_speech_settings(|settings| settings.model_file = "ggml-small.en.bin".into())
            .unwrap();
        assert!(settings.keep_raw_audio);
        assert_eq!(store.speech_settings().unwrap(), settings);
    }

    #[test]
    fn the_answer_context_is_the_open_question_and_the_earlier_answers() {
        let store = SessionStore::default();
        assert_eq!(store.answer_context(), None);
        let session = store.start().unwrap();
        let context = store.answer_context().unwrap();
        assert_eq!(context.question, session.opening_question);
        assert!(context.recent_answers.is_empty());
    }

    #[test]
    fn the_next_turn_slot_follows_the_open_session() {
        let store = SessionStore::default();
        assert_eq!(store.next_turn_slot(), None);
        let session = store.start().unwrap();
        assert_eq!(store.next_turn_slot(), Some((session.session_id, 1)));
    }
}
