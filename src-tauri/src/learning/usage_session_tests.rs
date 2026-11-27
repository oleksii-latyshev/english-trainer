use super::usage_test_support::{
    all_correct, correct_for, finished_steered_session, sequences, usage_service,
};
use crate::providers::{ProviderError, ProviderErrorCode, UsageBatchAnswer, UsageBatchResult};
use std::cell::RefCell;

fn usage_events(store: &crate::conversation::SessionStore) -> i64 {
    store
        .lock()
        .database
        .connection()
        .query_row("SELECT COUNT(*) FROM learning_usage_events", [], |row| {
            row.get(0)
        })
        .unwrap()
}

#[test]
fn eva_steering_is_saved_with_the_turn_that_asked_the_question() {
    let steered = finished_steered_session();

    let links: Vec<(i64, i64)> = {
        let state = steered.store.lock();
        let mut statement = state
            .database
            .connection()
            .prepare("SELECT sequence, item_id FROM turn_steering WHERE session_id = ?1 ORDER BY sequence")
            .unwrap();
        statement
            .query_map([steered.session_id as i64], |row| {
                Ok((row.get(0)?, row.get(1)?))
            })
            .unwrap()
            .map(Result::unwrap)
            .collect()
    };

    assert_eq!(
        links,
        [
            (1, steered.phrase_ids[0] as i64),
            (4, steered.phrase_ids[1] as i64)
        ]
    );
}

#[test]
fn one_provider_call_reviews_answers_one_two_and_the_steered_one() {
    let steered = finished_steered_session();
    let calls = RefCell::new(Vec::new());

    let report = usage_service(&steered.store)
        .review_session(steered.session_id, |answers| {
            calls.borrow_mut().push(sequences(answers));
            Ok(all_correct(answers))
        })
        .unwrap();

    assert_eq!(*calls.borrow(), [vec![1, 2, 5]]);
    assert_eq!(report.failed, 0);
    let reviewed: Vec<usize> = report
        .assessments
        .iter()
        .map(|assessment| assessment.sequence)
        .collect();
    assert_eq!(reviewed, [1, 2, 5]);
    let steered_answer = &report.assessments[2];
    assert_eq!(steered_answer.findings[0].item_id, steered.phrase_ids[1]);
    assert!(steered_answer.findings[0].credited);
}

#[test]
fn a_win_on_a_steered_answer_reaches_the_debrief() {
    let steered = finished_steered_session();

    usage_service(&steered.store)
        .review_session(steered.session_id, |answers| Ok(all_correct(answers)))
        .unwrap();

    let wins = steered
        .store
        .lock()
        .database
        .session_wins(steered.session_id)
        .unwrap();
    assert!(wins
        .iter()
        .any(|win| win.sequence == 5 && win.phrase == "makes sense"));
}

#[test]
fn a_repeated_run_returns_the_first_assessments_without_asking_again() {
    let steered = finished_steered_session();
    let service = usage_service(&steered.store);
    let first = service
        .review_session(steered.session_id, |answers| Ok(all_correct(answers)))
        .unwrap();
    let events = usage_events(&steered.store);

    let second = service
        .review_session(steered.session_id, |_| {
            panic!("a saved answer is never reviewed again")
        })
        .unwrap();

    assert_eq!(second, first);
    assert_eq!(usage_events(&steered.store), events);
}

#[test]
fn a_failed_call_saves_nothing_and_a_later_run_reviews_everything() {
    let steered = finished_steered_session();
    let service = usage_service(&steered.store);

    let failed = service.review_session(steered.session_id, |_| {
        Err(ProviderError::new(
            ProviderErrorCode::ProcessFailed,
            "The CLI failed.",
        ))
    });

    assert!(failed.is_err());
    assert_eq!(usage_events(&steered.store), 0);
    assert!(service.saved(steered.session_id, 1).unwrap().is_none());

    let retried = RefCell::new(Vec::new());
    service
        .review_session(steered.session_id, |answers| {
            retried.borrow_mut().push(sequences(answers));
            Ok(all_correct(answers))
        })
        .unwrap();
    assert_eq!(*retried.borrow(), [vec![1, 2, 5]]);
}

#[test]
fn an_answer_missing_from_the_reply_is_retried_alone_and_the_rest_stay_saved() {
    let steered = finished_steered_session();
    let service = usage_service(&steered.store);

    let report = service
        .review_session(steered.session_id, |answers| {
            Ok(answers
                .iter()
                .filter(|answer| answer.sequence != 5)
                .map(correct_for)
                .collect::<Vec<UsageBatchResult>>())
        })
        .unwrap();

    assert_eq!(report.failed, 1);
    assert_eq!(report.assessments.len(), 2);
    assert!(service.saved(steered.session_id, 5).unwrap().is_none());

    let retried = RefCell::new(Vec::new());
    let report = service
        .review_session(steered.session_id, |answers: &[UsageBatchAnswer]| {
            retried.borrow_mut().push(sequences(answers));
            Ok(all_correct(answers))
        })
        .unwrap();
    assert_eq!(*retried.borrow(), [vec![5]]);
    assert_eq!(report.failed, 0);
    assert_eq!(report.assessments.len(), 3);
}

#[test]
fn findings_that_fail_validation_leave_that_answer_unreviewed() {
    let steered = finished_steered_session();
    let service = usage_service(&steered.store);

    let report = service
        .review_session(steered.session_id, |answers| {
            Ok(answers
                .iter()
                .map(|answer| {
                    let mut result = correct_for(answer);
                    if answer.sequence == 2 {
                        result.response.findings[0].exact_excerpt = "never said".into();
                    }
                    result
                })
                .collect())
        })
        .unwrap();

    assert_eq!(report.failed, 1);
    assert!(service.saved(steered.session_id, 2).unwrap().is_none());
    assert!(service.saved(steered.session_id, 1).unwrap().is_some());
}

#[test]
fn an_answer_that_did_not_follow_a_steered_question_is_never_reviewed() {
    let steered = finished_steered_session();
    let service = usage_service(&steered.store);

    for sequence in [3, 4, 6] {
        let error = service
            .review(steered.session_id, sequence, |_| {
                panic!("not an answer the usage review covers")
            })
            .unwrap_err();
        assert_eq!(
            crate::core::IpcError::from(error).code,
            crate::core::IpcErrorCode::InvalidRequest
        );
    }
}
