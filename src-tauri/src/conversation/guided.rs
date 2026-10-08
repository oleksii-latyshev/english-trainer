use super::{busy_error, database_error, invalid_session_error, SessionStore};
use crate::providers::{GuidedAnswer, ProviderError, ProviderErrorCode};

impl SessionStore {
    pub fn guided_answer<F>(
        &self,
        session_id: u64,
        sequence: usize,
        question: &str,
        generate: F,
    ) -> Result<GuidedAnswer, ProviderError>
    where
        F: FnOnce(&str) -> Result<GuidedAnswer, ProviderError>,
    {
        {
            let mut state = self.lock();
            let active = state
                .active
                .as_ref()
                .filter(|active| active.id == session_id)
                .ok_or_else(invalid_session_error)?;
            if active.in_flight {
                return Err(busy_error());
            }
            if sequence != active.turns.len() + 1 || question != active.current_question() {
                return Err(stale_example());
            }
            // Conservatively exclude later answers from spontaneous mastery after an example request.
            // Save before generation, so a concurrent submission cannot escape cue exposure.
            state
                .database
                .record_session_cue_exposure(session_id, None, None, super::usage_support::now_ms())
                .map_err(database_error)?;
        }
        let answer = generate(question)?;
        let state = self.lock();
        let active = state
            .active
            .as_ref()
            .filter(|active| active.id == session_id)
            .ok_or_else(invalid_session_error)?;
        if active.turns.len() + 1 != sequence || active.in_flight {
            return Err(stale_example());
        }
        Ok(answer)
    }
}

impl SessionStore {
    /// Records that help was opened for the answer to the current question, once per answer.
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

fn stale_example() -> ProviderError {
    ProviderError::new(
        ProviderErrorCode::InvalidRequest,
        "The question changed while preparing the example. Request help for the current question.",
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    fn example() -> GuidedAnswer {
        GuidedAnswer {
            model_answer: "I am building an app.".into(),
            adaptation: "I am building [a project].".into(),
        }
    }

    #[test]
    fn example_exposure_is_persisted_before_generation_and_stale_requests_are_rejected() {
        let store = SessionStore::default();
        let session = store.start().unwrap();
        store
            .guided_answer(session.session_id, 1, &session.opening_question, |_| {
                assert!(store
                    .lock()
                    .database
                    .has_session_cue_exposure_before(
                        session.session_id,
                        Some("phrase"),
                        Some(1),
                        i64::MAX
                    )
                    .unwrap());
                Ok(example())
            })
            .unwrap();
        assert!(store
            .guided_answer(
                session.session_id,
                2,
                &session.opening_question,
                |_| panic!("stale request must not generate")
            )
            .is_err());
        assert!(store
            .guided_answer(session.session_id, 1, "Wrong question?", |_| panic!(
                "wrong question must not generate"
            ))
            .is_err());
    }

    #[test]
    fn example_exposure_survives_restart_and_late_example_is_rejected() {
        let directory = crate::providers::agy::runner::ScratchDirectory::new().unwrap();
        let path = directory.path().join("session.sqlite");
        let store = SessionStore::open(&path).unwrap();
        let session = store.start().unwrap();
        store
            .guided_answer(session.session_id, 1, &session.opening_question, |_| {
                Ok(example())
            })
            .unwrap();
        drop(store);
        let restored = SessionStore::open(path).unwrap();
        assert!(restored
            .lock()
            .database
            .has_session_cue_exposure_before(session.session_id, Some("phrase"), Some(1), i64::MAX)
            .unwrap());
        let late = restored.guided_answer(session.session_id, 1, &session.opening_question, |_| {
            restored
                .send_turn(session.session_id, "I am making an app.".into(), |_| {
                    Ok(crate::providers::ConversationTurn {
                        spoken_reply: "I see.".into(),
                        question: Some("Why?".into()),
                        session_phase: "active".into(),
                        is_complete: false,
                        provider_latency_ms: None,
                        first_token_ms: None,
                        answered_by: None,
                    })
                })
                .unwrap();
            Ok(example())
        });
        assert_eq!(late.unwrap_err().code, ProviderErrorCode::InvalidRequest);
        assert_eq!(restored.get_active().unwrap().unwrap().turn_count, 1);
    }

    #[test]
    fn failed_generation_preserves_session_and_recoverable_help() {
        let store = SessionStore::default();
        let session = store.start().unwrap();
        let error = store
            .guided_answer(session.session_id, 1, &session.opening_question, |_| {
                Err(ProviderError::new(
                    ProviderErrorCode::Timeout,
                    "Retry example",
                ))
            })
            .unwrap_err();
        assert_eq!(error.code, ProviderErrorCode::Timeout);
        assert_eq!(store.get_active().unwrap().unwrap().turn_count, 0);
        assert!(store
            .guided_answer(session.session_id, 1, &session.opening_question, |_| Ok(
                example()
            ))
            .is_ok());
    }
}

#[cfg(test)]
mod help_use_tests {
    use super::*;
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
                super::super::InputSource::Voice,
                Some(14_000),
                |_| Ok(reply(Some(800), Some(2_000))),
            )
            .unwrap();
        store
            .send_turn_with_source(
                session.session_id,
                "Because it is fun.".into(),
                super::super::InputSource::Text,
                Some(5_000),
                |_| Ok(reply(None, Some(1_200))),
            )
            .unwrap();
        let dialogue = store.dialogue(session.session_id).unwrap();
        assert_eq!(dialogue.help_used, vec![true, false]);
        assert_eq!(dialogue.reply_times_ms, vec![Some(800), Some(1_200)]);
        // Typed answers keep no duration even when one is sent.
        assert_eq!(dialogue.answer_durations_ms, vec![Some(14_000), None]);
    }

    #[test]
    fn help_use_for_stale_sequence_or_other_session_is_rejected() {
        let store = SessionStore::default();
        let session = store.start().unwrap();
        let other = store
            .record_answer_help_used(session.session_id + 1, 1)
            .unwrap_err();
        assert_eq!(other.code, ProviderErrorCode::InvalidSession);
        let stale = store
            .record_answer_help_used(session.session_id, 2)
            .unwrap_err();
        assert_eq!(stale.code, ProviderErrorCode::InvalidRequest);
        assert_eq!(
            store.dialogue(session.session_id).unwrap().help_used,
            Vec::<bool>::new()
        );
    }
}
