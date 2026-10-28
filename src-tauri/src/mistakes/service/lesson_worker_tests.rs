use super::lesson_worker::{BatchOutcome, LessonWorker};
use crate::conversation::SessionStore;
use crate::mistakes::domain::lesson::RawLessonBatch;
use crate::mistakes::domain::rules::RuleKey;
use crate::mistakes::error::LessonProviderError;
use crate::mistakes::infra::SessionMistakeStore;
use crate::mistakes::test_support::*;
use serde_json::json;
use std::sync::Arc;

struct Fixture {
    sessions: SessionStore,
    provider: Arc<ScriptedProvider>,
    notifier: Arc<CountingNotifier>,
    worker: LessonWorker,
}

fn fixture(replies: Vec<Reply>) -> Fixture {
    let sessions = SessionStore::default();
    let provider = Arc::new(ScriptedProvider::with(replies));
    let notifier = Arc::new(CountingNotifier::default());
    let worker = LessonWorker::new(
        Arc::new(SessionMistakeStore::new(sessions.clone())),
        provider.clone(),
        notifier.clone(),
        Arc::new(FixedClock::at(NOW)),
    );
    Fixture {
        sessions,
        provider,
        notifier,
        worker,
    }
}

fn batch(lessons: Vec<serde_json::Value>, cards: Vec<serde_json::Value>) -> Reply {
    Ok(RawLessonBatch {
        lessons,
        rule_cards: cards,
    })
}

fn gap_after_i() -> serde_json::Value {
    json!([{"start": 1, "end": 2}])
}

const LESSON_STATE: &str = "SELECT state FROM mistake_lessons WHERE mistake_id = ?1";
const LESSON_FAILURES: &str = "SELECT failures FROM mistake_lessons WHERE mistake_id = ?1";
const RULE: &str = "SELECT rule_key FROM mistakes WHERE id = ?1";

#[test]
fn nothing_waiting_is_idle_and_never_calls_the_provider() {
    let f = fixture(vec![]);
    assert_eq!(f.worker.run_batch().unwrap(), BatchOutcome::Idle);
    assert_eq!(f.provider.call_count(), 0);
}

#[test]
fn a_ready_lesson_sets_the_rule_and_stores_the_rule_card_once() {
    let f = fixture(vec![batch(
        vec![lesson_json(1, "articles", gap_after_i())],
        vec![card_json("articles")],
    )]);
    let mut seeded = seed_session(&f.sessions, "Tell me about work.");
    let id = add_mistake(
        &f.sessions,
        &mut seeded,
        "I has a job",
        "I have a job",
        "Why?",
    );
    assert_eq!(id, 1);

    assert_eq!(f.worker.run_batch().unwrap(), BatchOutcome::Processed);

    assert_eq!(single::<String>(&f.sessions, LESSON_STATE, id), "ready");
    assert_eq!(single::<String>(&f.sessions, RULE, id), "articles");
    let cards: i64 = single(
        &f.sessions,
        "SELECT COUNT(*) FROM rule_cards WHERE rule_key = 'articles' AND ?1 > 0",
        id,
    );
    assert_eq!(cards, 1);
    assert_eq!(*f.notifier.0.lock().unwrap(), [1]);
    assert_eq!(f.worker.run_batch().unwrap(), BatchOutcome::Idle);
}

#[test]
fn the_request_carries_the_question_the_sentences_and_the_missing_cards() {
    let f = fixture(vec![batch(vec![], vec![])]);
    let mut seeded = seed_session(&f.sessions, "Tell me about work.");
    add_turn(&f.sessions, &mut seeded, "Hello", "What is your job?");
    add_mistake(
        &f.sessions,
        &mut seeded,
        "I has a job",
        "I have a job",
        "Why?",
    );

    f.worker.run_batch().unwrap();

    let requests = f.provider.requests.lock().unwrap();
    let mistake = &requests[0].mistakes[0];
    assert_eq!(mistake.question, "What is your job?");
    assert_eq!(mistake.said, "I has a job");
    assert_eq!(mistake.corrected, "I have a job");
    assert_eq!(mistake.review_explanation, "Because.");
    assert!(requests[0].missing_card_keys.contains(&RuleKey::Articles));
    assert!(!requests[0].missing_card_keys.contains(&RuleKey::Other));
}

#[test]
fn the_first_answer_is_asked_with_the_opening_question() {
    let f = fixture(vec![batch(vec![], vec![])]);
    let mut seeded = seed_session(&f.sessions, "Tell me about work.");
    add_mistake(
        &f.sessions,
        &mut seeded,
        "I has a job",
        "I have a job",
        "Why?",
    );
    f.worker.run_batch().unwrap();
    assert_eq!(
        f.provider.requests.lock().unwrap()[0].mistakes[0].question,
        "Tell me about work."
    );
}

#[test]
fn batches_hold_at_most_five_mistakes_newest_first() {
    let f = fixture(vec![batch(vec![], vec![]), batch(vec![], vec![])]);
    let mut seeded = seed_session(&f.sessions, "Q?");
    for index in 0..7 {
        add_mistake(
            &f.sessions,
            &mut seeded,
            &format!("I has {index}"),
            &format!("I have {index}"),
            "Q?",
        );
    }
    f.worker.run_batch().unwrap();
    let requests = f.provider.requests.lock().unwrap();
    let ids: Vec<_> = requests[0]
        .mistakes
        .iter()
        .map(|item| item.mistake_id)
        .collect();
    assert_eq!(ids, [7, 6, 5, 4, 3]);
}

#[test]
fn an_invalid_entry_is_counted_alone_and_the_good_one_is_saved() {
    let f = fixture(vec![batch(
        vec![
            lesson_json(1, "articles", gap_after_i()),
            lesson_json(2, "not_a_rule", gap_after_i()),
        ],
        vec![],
    )]);
    let mut seeded = seed_session(&f.sessions, "Q?");
    let good = add_mistake(
        &f.sessions,
        &mut seeded,
        "I has a job",
        "I have a job",
        "Q?",
    );
    let bad = add_mistake(
        &f.sessions,
        &mut seeded,
        "I has a car",
        "I have a car",
        "Q?",
    );

    f.worker.run_batch().unwrap();

    assert_eq!(single::<String>(&f.sessions, LESSON_STATE, good), "ready");
    assert_eq!(single::<String>(&f.sessions, LESSON_STATE, bad), "pending");
    assert_eq!(single::<i64>(&f.sessions, LESSON_FAILURES, bad), 1);
}

#[test]
fn a_mistake_missing_from_the_reply_is_counted_as_a_failure() {
    let f = fixture(vec![batch(vec![], vec![])]);
    let mut seeded = seed_session(&f.sessions, "Q?");
    let id = add_mistake(
        &f.sessions,
        &mut seeded,
        "I has a job",
        "I have a job",
        "Q?",
    );
    f.worker.run_batch().unwrap();
    assert_eq!(single::<i64>(&f.sessions, LESSON_FAILURES, id), 1);
}

#[test]
fn a_mistake_fails_for_good_after_two_failures_and_leaves_the_queue() {
    let f = fixture(vec![
        Err(LessonProviderError::Failed),
        Err(LessonProviderError::Failed),
    ]);
    let mut seeded = seed_session(&f.sessions, "Q?");
    let id = add_mistake(
        &f.sessions,
        &mut seeded,
        "I has a job",
        "I have a job",
        "Q?",
    );

    assert_eq!(f.worker.run_batch().unwrap(), BatchOutcome::Processed);
    assert_eq!(single::<String>(&f.sessions, LESSON_STATE, id), "pending");
    assert_eq!(f.worker.run_batch().unwrap(), BatchOutcome::Processed);
    assert_eq!(single::<String>(&f.sessions, LESSON_STATE, id), "failed");
    assert_eq!(single::<i64>(&f.sessions, LESSON_FAILURES, id), 2);

    assert_eq!(f.worker.run_batch().unwrap(), BatchOutcome::Idle);
    assert_eq!(f.provider.call_count(), 2);
}

#[test]
fn a_used_up_quota_pauses_without_counting_a_failure() {
    let f = fixture(vec![Err(LessonProviderError::QuotaExhausted)]);
    let mut seeded = seed_session(&f.sessions, "Q?");
    let id = add_mistake(
        &f.sessions,
        &mut seeded,
        "I has a job",
        "I have a job",
        "Q?",
    );

    assert_eq!(f.worker.run_batch().unwrap(), BatchOutcome::QuotaPaused);

    let rows: i64 = single(
        &f.sessions,
        "SELECT COUNT(*) FROM mistake_lessons WHERE mistake_id = ?1",
        id,
    );
    assert_eq!(rows, 0);
    assert!(f.notifier.0.lock().unwrap().is_empty());
}

#[test]
fn archived_mistakes_are_not_prepared() {
    let f = fixture(vec![]);
    let mut seeded = seed_session(&f.sessions, "Q?");
    let id = add_mistake(
        &f.sessions,
        &mut seeded,
        "I has a job",
        "I have a job",
        "Q?",
    );
    f.sessions
        .with_connection(|connection| {
            connection.execute(
                "UPDATE mistakes SET status = 'archived' WHERE id = ?1",
                [id as i64],
            )
        })
        .unwrap();
    assert_eq!(f.worker.run_batch().unwrap(), BatchOutcome::Idle);
}

#[test]
fn a_lesson_for_a_mistake_deleted_meanwhile_is_skipped() {
    let f = fixture(vec![batch(
        vec![lesson_json(1, "articles", gap_after_i())],
        vec![],
    )]);
    let mut seeded = seed_session(&f.sessions, "Q?");
    let id = add_mistake(
        &f.sessions,
        &mut seeded,
        "I has a job",
        "I have a job",
        "Q?",
    );
    let store = SessionMistakeStore::new(f.sessions.clone());
    let outcome = crate::mistakes::ports::LessonOutcome {
        lessons: vec![(id + 50, ready_lesson(RuleKey::Articles))],
        cards: vec![],
        failed: vec![id + 50],
    };
    let saved = crate::mistakes::ports::LessonStore::save(&store, &outcome, NOW).unwrap();
    assert_eq!(saved.lessons_ready, 0);
}

#[test]
fn a_second_mistake_with_the_same_rule_is_back_again_and_resets_the_rule() {
    let f = fixture(vec![
        batch(vec![lesson_json(1, "articles", gap_after_i())], vec![]),
        batch(vec![lesson_json(2, "articles", gap_after_i())], vec![]),
    ]);
    let mut seeded = seed_session(&f.sessions, "Q?");
    let first = add_mistake(
        &f.sessions,
        &mut seeded,
        "I has a job",
        "I have a job",
        "Q?",
    );
    f.worker.run_batch().unwrap();
    f.sessions
        .with_connection(|connection| {
            connection.execute(
                "UPDATE mistakes SET ladder_step = 3, step4_pass_days = 1, next_review_at = ?2 WHERE id = ?1",
                [first as i64, NOW + 9_000_000],
            )
        })
        .unwrap();
    assert_eq!(
        single::<i64>(
            &f.sessions,
            "SELECT COUNT(*) FROM rule_relapses WHERE ?1 > 0",
            first
        ),
        0
    );

    let second = add_mistake(
        &f.sessions,
        &mut seeded,
        "I has a car",
        "I have a car",
        "Q?",
    );
    f.worker.run_batch().unwrap();

    assert_eq!(
        single::<i64>(
            &f.sessions,
            "SELECT COUNT(*) FROM rule_relapses WHERE ?1 > 0",
            second
        ),
        1
    );
    assert_eq!(
        single::<i64>(
            &f.sessions,
            "SELECT ladder_step FROM mistakes WHERE id = ?1",
            first
        ),
        1
    );
    assert_eq!(
        single::<i64>(
            &f.sessions,
            "SELECT step4_pass_days FROM mistakes WHERE id = ?1",
            first
        ),
        0
    );
    assert_eq!(
        single::<i64>(
            &f.sessions,
            "SELECT next_review_at FROM mistakes WHERE id = ?1",
            first
        ),
        NOW
    );
    let (session, sequence): (i64, i64) = f
        .sessions
        .with_connection(|c| {
            c.query_row("SELECT session_id, sequence FROM rule_relapses", [], |r| {
                Ok((r.get(0)?, r.get(1)?))
            })
        })
        .unwrap();
    assert_eq!((session, sequence), (seeded.session_id, 2));
}

#[test]
fn a_fixed_mistake_stays_fixed_when_its_rule_comes_back() {
    let f = fixture(vec![
        batch(vec![lesson_json(1, "articles", gap_after_i())], vec![]),
        batch(vec![lesson_json(2, "articles", gap_after_i())], vec![]),
    ]);
    let mut seeded = seed_session(&f.sessions, "Q?");
    let fixed = add_mistake(
        &f.sessions,
        &mut seeded,
        "I has a job",
        "I have a job",
        "Q?",
    );
    f.worker.run_batch().unwrap();
    f.sessions
        .with_connection(|connection| {
            connection.execute(
                "UPDATE mistakes SET ladder_step = 4, fixed_at = 5 WHERE id = ?1",
                [fixed as i64],
            )
        })
        .unwrap();
    add_mistake(
        &f.sessions,
        &mut seeded,
        "I has a car",
        "I have a car",
        "Q?",
    );
    f.worker.run_batch().unwrap();
    assert_eq!(
        single::<i64>(
            &f.sessions,
            "SELECT ladder_step FROM mistakes WHERE id = ?1",
            fixed
        ),
        4
    );
    assert_eq!(
        single::<i64>(
            &f.sessions,
            "SELECT fixed_at FROM mistakes WHERE id = ?1",
            fixed
        ),
        5
    );
    assert_eq!(
        single::<i64>(
            &f.sessions,
            "SELECT COUNT(*) FROM rule_relapses WHERE ?1 > 0",
            fixed
        ),
        1
    );
}

#[test]
fn the_other_rule_never_counts_as_back_again() {
    let f = fixture(vec![batch(
        vec![
            lesson_json(1, "other", gap_after_i()),
            lesson_json(2, "other", gap_after_i()),
        ],
        vec![],
    )]);
    let mut seeded = seed_session(&f.sessions, "Q?");
    add_mistake(
        &f.sessions,
        &mut seeded,
        "I has a job",
        "I have a job",
        "Q?",
    );
    add_mistake(
        &f.sessions,
        &mut seeded,
        "I has a car",
        "I have a car",
        "Q?",
    );
    f.worker.run_batch().unwrap();
    assert_eq!(
        single::<i64>(
            &f.sessions,
            "SELECT COUNT(*) FROM rule_relapses WHERE ?1 > 0",
            1
        ),
        0
    );
}

#[test]
fn saving_the_same_answer_twice_writes_one_relapse() {
    use crate::mistakes::ports::{LessonOutcome, LessonStore};
    let f = fixture(vec![]);
    let mut seeded = seed_session(&f.sessions, "Q?");
    let first = add_mistake(
        &f.sessions,
        &mut seeded,
        "I has a job",
        "I have a job",
        "Q?",
    );
    let second = add_mistake(
        &f.sessions,
        &mut seeded,
        "I has a car",
        "I have a car",
        "Q?",
    );
    let store = SessionMistakeStore::new(f.sessions.clone());
    let both = LessonOutcome {
        lessons: vec![
            (first, ready_lesson(RuleKey::Articles)),
            (second, ready_lesson(RuleKey::Articles)),
        ],
        ..LessonOutcome::default()
    };
    assert_eq!(store.save(&both, NOW).unwrap().relapses, 1);
    f.sessions
        .with_connection(|c| c.execute("UPDATE mistakes SET ladder_step = 2", []))
        .unwrap();
    assert_eq!(store.save(&both, NOW + 1).unwrap().relapses, 0);
    assert_eq!(
        single::<i64>(
            &f.sessions,
            "SELECT COUNT(*) FROM rule_relapses WHERE ?1 > 0",
            1
        ),
        1
    );
    assert_eq!(
        single::<i64>(
            &f.sessions,
            "SELECT ladder_step FROM mistakes WHERE id = ?1",
            first
        ),
        2
    );
}

#[test]
fn the_newer_mistake_is_back_again_even_when_the_older_lesson_is_ready_last() {
    use crate::mistakes::ports::{LessonOutcome, LessonStore};
    let f = fixture(vec![]);
    let mut seeded = seed_session(&f.sessions, "Q?");
    let older = add_mistake(
        &f.sessions,
        &mut seeded,
        "I has a job",
        "I have a job",
        "Q?",
    );
    let newer = add_mistake(
        &f.sessions,
        &mut seeded,
        "I has a car",
        "I have a car",
        "Q?",
    );
    let store = SessionMistakeStore::new(f.sessions.clone());
    let save = |id| LessonOutcome {
        lessons: vec![(id, ready_lesson(RuleKey::Articles))],
        ..LessonOutcome::default()
    };

    assert_eq!(store.save(&save(newer), NOW).unwrap().relapses, 0);
    assert_eq!(store.save(&save(older), NOW).unwrap().relapses, 1);

    let relapses: i64 = single(
        &f.sessions,
        "SELECT COUNT(*) FROM rule_relapses WHERE sequence = 2 AND ?1 > 0",
        1,
    );
    assert_eq!(relapses, 1);
    assert_eq!(
        single::<i64>(
            &f.sessions,
            "SELECT COUNT(*) FROM rule_relapses WHERE ?1 > 0",
            1
        ),
        1
    );
}
