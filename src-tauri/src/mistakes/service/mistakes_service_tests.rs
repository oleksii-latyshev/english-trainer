use super::MistakesService;
use crate::conversation::SessionStore;
use crate::mistakes::domain::rules::RuleKey;
use crate::mistakes::domain::view::LessonState;
use crate::mistakes::error::MistakesError;
use crate::mistakes::infra::SessionMistakeStore;
use crate::mistakes::ports::{LessonOutcome, LessonStore};
use crate::mistakes::test_support::*;
use std::sync::atomic::Ordering;
use std::sync::Arc;

struct Fixture {
    sessions: SessionStore,
    store: SessionMistakeStore,
    kick: Arc<CountingKick>,
    service: MistakesService,
}

fn fixture() -> Fixture {
    let sessions = SessionStore::default();
    let store = SessionMistakeStore::new(sessions.clone());
    let kick = Arc::new(CountingKick::default());
    let service = MistakesService::new(
        Arc::new(store.clone()),
        kick.clone(),
        Arc::new(FixedClock::at(NOW + 10_000)),
    );
    Fixture {
        sessions,
        store,
        kick,
        service,
    }
}

fn ready(f: &Fixture, ids: &[(u64, RuleKey)]) {
    let outcome = LessonOutcome {
        lessons: ids
            .iter()
            .map(|(id, rule)| (*id, ready_lesson(*rule)))
            .collect(),
        ..LessonOutcome::default()
    };
    f.store.save(&outcome, NOW).unwrap();
}

#[test]
fn groups_list_every_non_archived_mistake_by_rule_with_the_most_relapsed_first() {
    let f = fixture();
    let mut seeded = seed_session(&f.sessions, "Q?");
    let a1 = add_mistake(&f.sessions, &mut seeded, "I have job", "I have a job", "Q?");
    let a2 = add_mistake(&f.sessions, &mut seeded, "I have car", "I have a car", "Q?");
    let p1 = add_mistake(&f.sessions, &mut seeded, "in Monday", "on Monday", "Q?");
    let p2 = add_mistake(&f.sessions, &mut seeded, "on 2020", "in 2020", "Q?");
    let p3 = add_mistake(&f.sessions, &mut seeded, "at winter", "in winter", "Q?");
    let waiting = add_mistake(&f.sessions, &mut seeded, "he go", "he goes", "Q?");
    let odd = add_mistake(&f.sessions, &mut seeded, "weird", "fine", "Q?");
    let gone = add_mistake(&f.sessions, &mut seeded, "old", "older", "Q?");
    ready(
        &f,
        &[
            (a1, RuleKey::Articles),
            (a2, RuleKey::Articles),
            (p1, RuleKey::Prepositions),
            (p2, RuleKey::Prepositions),
            (p3, RuleKey::Prepositions),
            (odd, RuleKey::Other),
        ],
    );
    f.service.archive(gone).unwrap();

    let groups = f.service.groups().unwrap();

    let keys: Vec<_> = groups.groups.iter().map(|group| group.rule_key).collect();
    assert_eq!(keys, [RuleKey::Prepositions, RuleKey::Articles]);
    assert_eq!(groups.groups[0].mistake_count, 3);
    assert_eq!(groups.groups[0].title, "Prepositions");
    assert_eq!(groups.groups[0].relapse_count, 2);
    assert_eq!(groups.groups[1].relapse_count, 1);
    assert!(groups.groups[1].last_relapse_at.is_some());
    let loose: Vec<_> = groups.ungrouped.iter().map(|item| item.id).collect();
    assert!(loose.contains(&waiting) && loose.contains(&odd) && !loose.contains(&gone));
    assert_eq!(
        groups
            .ungrouped
            .iter()
            .find(|i| i.id == waiting)
            .unwrap()
            .lesson_state,
        LessonState::Pending
    );
    assert_eq!(groups.due_count, 7);
}

#[test]
fn fixed_mistakes_stay_listed_but_are_not_due() {
    let f = fixture();
    let mut seeded = seed_session(&f.sessions, "Q?");
    let id = add_mistake(&f.sessions, &mut seeded, "I have job", "I have a job", "Q?");
    ready(&f, &[(id, RuleKey::Articles)]);
    f.sessions
        .with_connection(|c| c.execute("UPDATE mistakes SET fixed_at = 1, ladder_step = 4", []))
        .unwrap();
    let groups = f.service.groups().unwrap();
    assert_eq!(groups.groups[0].fixed_count, 1);
    assert_eq!(groups.groups[0].due_count, 0);
    assert_eq!(groups.due_count, 0);
}

#[test]
fn a_mistake_card_has_its_question_lesson_and_rule() {
    let f = fixture();
    let mut seeded = seed_session(&f.sessions, "Q?");
    add_turn(&f.sessions, &mut seeded, "Hi", "What is your job?");
    let id = add_mistake(&f.sessions, &mut seeded, "I have job", "I have a job", "Q?");
    ready(&f, &[(id, RuleKey::Articles)]);

    let detail = f.service.mistake(id).unwrap();

    assert_eq!(detail.question, "What is your job?");
    assert_eq!(detail.said, "I have job");
    assert_eq!(detail.corrected, "I have a job");
    assert_eq!(detail.rule.unwrap().rule_key, RuleKey::Articles);
    assert_eq!(detail.lesson_state, LessonState::Ready);
    assert_eq!(detail.lesson.unwrap().explanation, "Because.");
    assert_eq!(detail.ladder_step, 1);
    assert!(detail.is_due);
    assert_eq!((detail.session_id, detail.sequence), (Some(1), Some(2)));
}

#[test]
fn a_mistake_without_a_lesson_shows_what_was_said_and_the_correction() {
    let f = fixture();
    let mut seeded = seed_session(&f.sessions, "Q?");
    let id = add_mistake(&f.sessions, &mut seeded, "I have job", "I have a job", "Q?");
    let detail = f.service.mistake(id).unwrap();
    assert_eq!(detail.lesson_state, LessonState::Pending);
    assert!(detail.lesson.is_none() && detail.rule.is_none());
}

#[test]
fn an_unknown_or_archived_mistake_is_not_found() {
    let f = fixture();
    assert!(matches!(
        f.service.mistake(99),
        Err(MistakesError::NotFound(99))
    ));
    assert!(matches!(
        f.service.archive(99),
        Err(MistakesError::NotFound(99))
    ));
    let mut seeded = seed_session(&f.sessions, "Q?");
    let id = add_mistake(&f.sessions, &mut seeded, "I have job", "I have a job", "Q?");
    f.service.archive(id).unwrap();
    f.service.archive(id).unwrap();
    assert!(f.service.mistake(id).is_err());
}

#[test]
fn a_rule_card_shows_title_and_summary_and_the_body_once_prepared() {
    let f = fixture();
    let before = f.service.rule_card(RuleKey::Articles).unwrap();
    assert_eq!(before.title, "Articles");
    assert!(before.body.is_none() && before.examples.is_empty());

    let outcome = LessonOutcome {
        cards: vec![crate::mistakes::domain::lesson::RuleCardContent {
            rule_key: RuleKey::Articles,
            body: "Use a before new things.".into(),
            examples: vec!["A cat.".into(), "The cat.".into()],
        }],
        ..LessonOutcome::default()
    };
    f.store.save(&outcome, NOW).unwrap();
    let after = f.service.rule_card(RuleKey::Articles).unwrap();
    assert_eq!(after.body.as_deref(), Some("Use a before new things."));
    assert_eq!(after.examples.len(), 2);
}

#[test]
fn retrying_a_failed_lesson_resets_it_and_wakes_the_worker() {
    let f = fixture();
    let mut seeded = seed_session(&f.sessions, "Q?");
    let id = add_mistake(&f.sessions, &mut seeded, "I have job", "I have a job", "Q?");
    let failed = LessonOutcome {
        failed: vec![id],
        ..LessonOutcome::default()
    };
    f.store.save(&failed, NOW).unwrap();
    f.store.save(&failed, NOW).unwrap();
    assert_eq!(
        single::<String>(
            &f.sessions,
            "SELECT state FROM mistake_lessons WHERE mistake_id = ?1",
            id
        ),
        "failed"
    );

    f.service.retry_lesson(id).unwrap();

    assert_eq!(
        single::<String>(
            &f.sessions,
            "SELECT state FROM mistake_lessons WHERE mistake_id = ?1",
            id
        ),
        "pending"
    );
    assert_eq!(
        single::<i64>(
            &f.sessions,
            "SELECT failures FROM mistake_lessons WHERE mistake_id = ?1",
            id
        ),
        0
    );
    assert_eq!(f.kick.0.load(Ordering::SeqCst), 1);
    assert!(f.service.retry_lesson(404).is_err());
}

#[test]
fn retrying_a_ready_lesson_changes_nothing() {
    let f = fixture();
    let mut seeded = seed_session(&f.sessions, "Q?");
    let id = add_mistake(&f.sessions, &mut seeded, "I have job", "I have a job", "Q?");
    ready(&f, &[(id, RuleKey::Articles)]);
    f.service.retry_lesson(id).unwrap();
    assert_eq!(
        single::<String>(
            &f.sessions,
            "SELECT state FROM mistake_lessons WHERE mistake_id = ?1",
            id
        ),
        "ready"
    );
}

#[test]
fn a_mistake_counted_once_does_not_fail_a_ready_lesson() {
    let f = fixture();
    let mut seeded = seed_session(&f.sessions, "Q?");
    let id = add_mistake(&f.sessions, &mut seeded, "I have job", "I have a job", "Q?");
    ready(&f, &[(id, RuleKey::Articles)]);
    let failed = LessonOutcome {
        failed: vec![id],
        ..LessonOutcome::default()
    };
    f.store.save(&failed, NOW).unwrap();
    assert_eq!(
        single::<String>(
            &f.sessions,
            "SELECT state FROM mistake_lessons WHERE mistake_id = ?1",
            id
        ),
        "ready"
    );
}
