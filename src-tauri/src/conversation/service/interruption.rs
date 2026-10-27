use super::{active_session_mut, SessionStore};
use crate::conversation::error::ConversationError;
use std::sync::atomic::Ordering;

impl SessionStore {
    pub fn cancel_pending_reply(&self, session_id: u64) -> Result<bool, ConversationError> {
        let mut state = self.lock();
        let session = active_session_mut(&mut state, session_id)?;
        if !session.in_flight {
            return Ok(false);
        }
        session.reply_cancelled.store(true, Ordering::Release);
        session.in_flight = false;
        Ok(true)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::conversation::service::code_of;
    use crate::core::IpcErrorCode;
    use crate::providers::ConversationTurn;
    use std::sync::mpsc;

    fn turn() -> ConversationTurn {
        ConversationTurn {
            spoken_reply: "Thanks.".into(),
            question: Some("What next?".into()),
            session_phase: "conversation".into(),
            is_complete: false,
            provider_latency_ms: None,
            first_token_ms: None,
            answered_by: None,
        }
    }

    #[test]
    fn cancelled_reply_cannot_persist_or_clear_a_newer_pending_turn() {
        let store = SessionStore::default();
        let session = store.start().unwrap();
        let (began, started) = mpsc::channel();
        let (release, wait) = mpsc::channel();
        let other = store.clone();
        let id = session.session_id;
        let old = std::thread::spawn(move || {
            other.send_turn(id, "Old answer.".into(), |_| {
                began.send(()).unwrap();
                wait.recv().unwrap();
                Ok(turn())
            })
        });
        started.recv().unwrap();
        assert!(store.cancel_pending_reply(id).unwrap());
        let (began, started) = mpsc::channel();
        let (release_new, wait) = mpsc::channel();
        let other = store.clone();
        let new = std::thread::spawn(move || {
            other.send_turn(id, "New answer.".into(), |_| {
                began.send(()).unwrap();
                wait.recv().unwrap();
                Ok(turn())
            })
        });
        started.recv().unwrap();
        release.send(()).unwrap();
        assert_eq!(
            code_of(old.join().unwrap().unwrap_err()),
            IpcErrorCode::Cancelled
        );
        assert_eq!(
            code_of(
                store
                    .send_turn(id, "Third answer.".into(), |_| Ok(turn()))
                    .unwrap_err()
            ),
            IpcErrorCode::Busy
        );
        release_new.send(()).unwrap();
        new.join().unwrap().unwrap();
        let dialogue = store.dialogue(id).unwrap();
        assert_eq!(dialogue.turns.len(), 1);
        assert_eq!(dialogue.turns[0].learner, "New answer.");
        assert!(!store.cancel_pending_reply(id).unwrap());
    }
}
