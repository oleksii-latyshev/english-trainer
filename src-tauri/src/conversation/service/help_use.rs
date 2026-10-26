use super::SessionStore;
use crate::conversation::error::{database_error, invalid_session_error};
use crate::providers::{ProviderError, ProviderErrorCode};

impl SessionStore {
    pub fn record_answer_help_used(
        &self,
        session_id: u64,
        sequence: usize,
    ) -> Result<(), ProviderError> {
        let mut state = self.lock();
        let active = state
            .active
            .as_ref()
            .filter(|active| active.id == session_id)
            .ok_or_else(invalid_session_error)?;
        if sequence != active.turns.len() + 1 {
            return Err(ProviderError::new(
                ProviderErrorCode::InvalidRequest,
                "The question changed before help was recorded. Open help again for the current question.",
            ));
        }
        state
            .database
            .record_answer_help_used(session_id, sequence)
            .map_err(database_error)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::conversation::service::code_of;
    use crate::providers::ConversationTurn;

    fn reply(first_token_ms: Option<u64>, latency_ms: Option<u64>) -> ConversationTurn {
        ConversationTurn {
            spoken_reply: "I see.".into(),
            question: Some("Why?".into()),
            session_phase: "active".into(),
            is_complete: false,
            provider_latency_ms: latency_ms,
            first_token_ms,
            answered_by: None,
        }
    }

    #[test]
    fn help_use_is_recorded_once_per_answer_and_shown_in_the_dialogue() {
        let store = SessionStore::default();
        let session = store.start().unwrap();
        store
            .record_answer_help_used(session.session_id, 1)
            .unwrap();
        store
            .record_answer_help_used(session.session_id, 1)
            .unwrap();
        store
            .send_turn_with_source(
                session.session_id,
                "I am building an app.".into(),
                crate::conversation::InputSource::Voice,
                Some(14_000),
                |_| Ok(reply(Some(800), Some(2_000))),
            )
            .unwrap();
        store
            .send_turn_with_source(
                session.session_id,
                "Because it is fun.".into(),
                crate::conversation::InputSource::Text,
                Some(5_000),
                |_| Ok(reply(None, Some(1_200))),
            )
            .unwrap();
        let dialogue = store.dialogue(session.session_id).unwrap();
        assert_eq!(dialogue.help_used, vec![true, false]);
        assert_eq!(dialogue.reply_times_ms, vec![Some(800), Some(1_200)]);
        assert_eq!(dialogue.answer_durations_ms, vec![Some(14_000), None]);
    }

    #[test]
    fn help_use_for_stale_sequence_or_other_session_is_rejected() {
        let store = SessionStore::default();
        let session = store.start().unwrap();
        let other = store
            .record_answer_help_used(session.session_id + 1, 1)
            .unwrap_err();
        assert_eq!(code_of(other), ProviderErrorCode::InvalidSession);
        let stale = store
            .record_answer_help_used(session.session_id, 2)
            .unwrap_err();
        assert_eq!(code_of(stale), ProviderErrorCode::InvalidRequest);
        assert_eq!(
            store.dialogue(session.session_id).unwrap().help_used,
            Vec::<bool>::new()
        );
    }
}
