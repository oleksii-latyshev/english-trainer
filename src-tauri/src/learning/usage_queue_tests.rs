use super::usage_queue::{Next, UsageReviewQueue, UsageReviewWorker};
use super::usage_test_support::{all_correct, finished_steered_session, sequences, usage_service};
use crate::providers::{ProviderError, ProviderErrorCode, UsageBatchAnswer};
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;

const RETRY: Duration = Duration::from_secs(7);
const PAUSE: Duration = Duration::from_secs(99);

fn failing(code: ProviderErrorCode) -> ProviderError {
    ProviderError::new(code, "The review failed.")
}

#[test]
fn a_finished_session_is_reviewed_with_one_call_and_is_done() {
    let steered = finished_steered_session();
    let calls = Arc::new(Mutex::new(Vec::new()));
    let seen = calls.clone();
    let worker = UsageReviewWorker::new(
        usage_service(&steered.store),
        move |answers: &[UsageBatchAnswer]| {
            seen.lock().unwrap().push(sequences(answers));
            Ok(all_correct(answers))
        },
        RETRY,
        PAUSE,
    );

    assert_eq!(worker.run(steered.session_id, 1), Next::Done);
    assert_eq!(*calls.lock().unwrap(), [vec![1, 2, 5]]);
}

#[test]
fn a_failure_is_retried_once_and_then_given_up() {
    let steered = finished_steered_session();
    let worker = UsageReviewWorker::new(
        usage_service(&steered.store),
        |_: &[UsageBatchAnswer]| Err(failing(ProviderErrorCode::ProcessFailed)),
        RETRY,
        PAUSE,
    );

    assert_eq!(worker.run(steered.session_id, 1), Next::RetryAfter(RETRY));
    assert_eq!(worker.run(steered.session_id, 2), Next::GiveUp);
}

#[test]
fn the_retry_reviews_what_the_first_try_missed() {
    let steered = finished_steered_session();
    let tries = Arc::new(AtomicUsize::new(0));
    let counted = tries.clone();
    let worker = UsageReviewWorker::new(
        usage_service(&steered.store),
        move |answers: &[UsageBatchAnswer]| {
            if counted.fetch_add(1, Ordering::SeqCst) == 0 {
                Err(failing(ProviderErrorCode::InvalidOutput))
            } else {
                Ok(all_correct(answers))
            }
        },
        RETRY,
        PAUSE,
    );

    assert_eq!(worker.run(steered.session_id, 1), Next::RetryAfter(RETRY));
    assert_eq!(worker.run(steered.session_id, 2), Next::Done);
    assert!(usage_service(&steered.store)
        .saved(steered.session_id, 5)
        .unwrap()
        .is_some());
}

#[test]
fn a_used_up_quota_pauses_without_using_a_try() {
    let steered = finished_steered_session();
    let worker = UsageReviewWorker::new(
        usage_service(&steered.store),
        |_: &[UsageBatchAnswer]| Err(failing(ProviderErrorCode::RateLimited)),
        RETRY,
        PAUSE,
    );

    assert_eq!(worker.run(steered.session_id, 2), Next::PausedFor(PAUSE));
}

#[test]
fn a_session_without_anything_to_review_makes_no_call() {
    let store = crate::conversation::SessionStore::default();
    let session = store.start().unwrap();
    store.finish(session.session_id).unwrap();
    let worker = UsageReviewWorker::new(
        usage_service(&store),
        |_: &[UsageBatchAnswer]| panic!("nothing to review"),
        RETRY,
        PAUSE,
    );

    assert_eq!(worker.run(session.session_id, 1), Next::Done);
}

#[test]
fn the_queue_runs_a_queued_session_off_the_calling_thread_and_notifies() {
    let steered = finished_steered_session();
    let (notified, wait) = std::sync::mpsc::channel();
    let worker = UsageReviewWorker::new(
        usage_service(&steered.store),
        |answers: &[UsageBatchAnswer]| Ok(all_correct(answers)),
        RETRY,
        PAUSE,
    );
    let queue = UsageReviewQueue::start(worker, move |session_id| {
        notified.send(session_id).unwrap();
    })
    .unwrap();

    queue.enqueue(steered.session_id);

    assert_eq!(
        wait.recv_timeout(Duration::from_secs(5)).unwrap(),
        steered.session_id
    );
    assert!(usage_service(&steered.store)
        .saved(steered.session_id, 1)
        .unwrap()
        .is_some());
}

fn started_queue(
    steered: &super::usage_test_support::Steered,
    runs: Arc<Mutex<Vec<u64>>>,
) -> UsageReviewQueue {
    let worker = UsageReviewWorker::new(
        usage_service(&steered.store),
        |answers: &[UsageBatchAnswer]| Ok(all_correct(answers)),
        RETRY,
        PAUSE,
    );
    UsageReviewQueue::start(worker, move |session_id| {
        runs.lock().unwrap().push(session_id)
    })
    .unwrap()
}

fn wait_for(runs: &Arc<Mutex<Vec<u64>>>, count: usize) {
    for _ in 0..200 {
        if runs.lock().unwrap().len() >= count {
            return;
        }
        std::thread::sleep(Duration::from_millis(10));
    }
}

#[test]
fn a_restart_queues_a_recent_session_that_was_never_reviewed() {
    let steered = finished_steered_session();
    let runs = Arc::new(Mutex::new(Vec::new()));
    let queue = started_queue(&steered, runs.clone());
    let service = usage_service(&steered.store);

    assert_eq!(queue.resume(&service, crate::learning::now_ms()), 2);
    wait_for(&runs, 2);

    assert!(runs.lock().unwrap().contains(&steered.session_id));
    assert_eq!(queue.resume(&service, crate::learning::now_ms()), 0);
}

#[test]
fn a_restart_skips_sessions_older_than_the_window() {
    let steered = finished_steered_session();
    let runs = Arc::new(Mutex::new(Vec::new()));
    let queue = started_queue(&steered, runs);
    let service = usage_service(&steered.store);
    let later = crate::learning::now_ms()
        + i64::try_from(super::usage_queue::RESUME_WINDOW.as_millis()).unwrap()
        + 60_000;

    assert_eq!(queue.resume(&service, later), 0);
}
