use super::*;
use crate::conversation::InputSource;
use crate::providers::ConversationTurn;

fn reply() -> ConversationTurn {
    ConversationTurn {
        spoken_reply: "Nice.".into(),
        question: Some("And then?".into()),
        session_phase: "active".into(),
        is_complete: false,
        provider_latency_ms: None,
        first_token_ms: None,
        answered_by: None,
    }
}

fn finished(store: &SessionStore, answers: usize) -> u64 {
    let session = store.start().unwrap();
    for _ in 0..answers {
        store
            .send_turn_with_source(
                session.session_id,
                "I work there.".into(),
                InputSource::Voice,
                None,
                |_| Ok(reply()),
            )
            .unwrap();
    }
    store.finish(session.session_id).unwrap();
    session.session_id
}

#[test]
fn lists_finished_sessions_with_answers_newest_first() {
    let store = SessionStore::default();
    let first = finished(&store, 1);
    let empty = finished(&store, 0);
    let second = finished(&store, 2);
    let page = store.finished_sessions(5, 0).unwrap();
    let ids: Vec<u64> = page.sessions.iter().map(|item| item.session_id).collect();
    assert_eq!(ids, [second, first]);
    assert!(!ids.contains(&empty));
    assert_eq!(page.sessions[0].answer_count, 2);
    assert!(!page.has_more);
}

#[test]
fn pages_through_the_list_and_reports_whether_more_follow() {
    let store = SessionStore::default();
    let ids: Vec<u64> = (0..3).map(|_| finished(&store, 1)).collect();
    let first = store.finished_sessions(2, 0).unwrap();
    assert_eq!(first.sessions.len(), 2);
    assert!(first.has_more);
    let rest = store.finished_sessions(2, 2).unwrap();
    assert_eq!(rest.sessions.len(), 1);
    assert_eq!(rest.sessions[0].session_id, ids[0]);
    assert!(!rest.has_more);
}

#[test]
fn an_open_session_is_not_listed() {
    let store = SessionStore::default();
    let session = store.start().unwrap();
    store
        .send_turn_with_source(
            session.session_id,
            "Hi.".into(),
            InputSource::Voice,
            None,
            |_| Ok(reply()),
        )
        .unwrap();
    assert!(store.finished_sessions(5, 0).unwrap().sessions.is_empty());
}
