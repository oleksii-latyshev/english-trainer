use super::PracticeService;
use crate::conversation::SessionStore;
use crate::mistakes::domain::check_prompt::{CheckRequest, Verdict};
use crate::mistakes::domain::ladder::DAY_MS;
use crate::mistakes::domain::lesson::WordRange;
use crate::mistakes::domain::practice::{AttemptOutcome, InputKind, RunKind, RunView};
use crate::mistakes::domain::rules::RuleKey;
use crate::mistakes::error::{CheckError, MistakesError};
use crate::mistakes::infra::SessionMistakeStore;
use crate::mistakes::ports::{
    AnswerChecker, LessonOutcome, LessonStore, MistakeStore, PracticeStore, RunTarget,
};
use crate::mistakes::test_support::*;
use std::sync::{Arc, Mutex};
use std::time::Duration;

const NOW_LATER: i64 = NOW + 10_000;

#[derive(Default)]
struct FakeChecker {
    replies: Mutex<Vec<Result<Verdict, CheckError>>>,
    requests: Mutex<Vec<CheckRequest>>,
    delay: Duration,
}

impl FakeChecker {
    fn replying(replies: Vec<Result<Verdict, CheckError>>) -> Self {
        Self {
            replies: Mutex::new(replies),
            ..Self::default()
        }
    }

    fn calls(&self) -> usize {
        self.requests.lock().map_or(0, |requests| requests.len())
    }
}

impl AnswerChecker for FakeChecker {
    fn check(&self, request: &CheckRequest) -> Result<Verdict, CheckError> {
        if let Ok(mut requests) = self.requests.lock() {
            requests.push(request.clone());
        }
        std::thread::sleep(self.delay);
        let mut replies = self.replies.lock().map_err(|_| CheckError::Failed)?;
        if replies.is_empty() {
            return Err(CheckError::Failed);
        }
        replies.remove(0)
    }
}

fn verdict(passed: bool, note: &str) -> Result<Verdict, CheckError> {
    Ok(Verdict {
        passed,
        note: note.into(),
    })
}

struct Fixture {
    sessions: SessionStore,
    store: SessionMistakeStore,
    clock: Arc<FixedClock>,
    notifier: Arc<CountingNotifier>,
    checker: Arc<FakeChecker>,
    service: PracticeService,
    seeded: Seeded,
}

fn fixture_with(checker: FakeChecker) -> Fixture {
    let sessions = SessionStore::default();
    let store = SessionMistakeStore::new(sessions.clone());
    let clock = Arc::new(FixedClock::at(NOW_LATER));
    let notifier = Arc::new(CountingNotifier::default());
    let checker = Arc::new(checker);
    let service = PracticeService::new(
        Arc::new(store.clone()),
        checker.clone(),
        notifier.clone(),
        clock.clone(),
    );
    let seeded = seed_session(&sessions, "Where were you?");
    Fixture {
        sessions,
        store,
        clock,
        notifier,
        checker,
        service,
        seeded,
    }
}

fn fixture() -> Fixture {
    fixture_with(FakeChecker::default())
}

fn lesson_for(rule: RuleKey) -> crate::mistakes::domain::lesson::Lesson {
    crate::mistakes::domain::lesson::Lesson {
        gaps: vec![WordRange { start: 1, end: 2 }],
        accepted: vec!["I did work there".into()],
        situations: vec![
            "Where else have you worked?".into(),
            "What was your job?".into(),
        ],
        ..ready_lesson(rule)
    }
}

impl Fixture {
    fn mistake(&mut self, said: &str, corrected: &str, rule: Option<RuleKey>) -> u64 {
        let id = add_mistake(
            &self.sessions,
            &mut self.seeded,
            said,
            corrected,
            "Where were you?",
        );
        if let Some(rule) = rule {
            let outcome = LessonOutcome {
                lessons: vec![(id, lesson_for(rule))],
                ..LessonOutcome::default()
            };
            self.store.save(&outcome, NOW).unwrap();
        }
        id
    }

    fn set(&self, id: u64, sql: &str) {
        self.sessions
            .with_connection(|connection| {
                connection.execute(
                    &format!("UPDATE mistakes SET {sql} WHERE id = ?1"),
                    [i64::try_from(id).unwrap()],
                )
            })
            .unwrap();
    }

    fn column(&self, id: u64, column: &str) -> i64 {
        single::<i64>(
            &self.sessions,
            &format!("SELECT COALESCE({column}, -1) FROM mistakes WHERE id = ?1"),
            id,
        )
    }

    fn one(&self, id: u64) -> RunView {
        self.service.start(RunTarget::One(id)).unwrap()
    }

    fn answer(
        &self,
        run: u64,
        position: u32,
        text: &str,
    ) -> Result<super::practice_service::Answered, MistakesError> {
        self.service.answer(run, position, text, InputKind::Typed)
    }

    fn offset(&self) -> i64 {
        self.store.utc_offset_ms(NOW_LATER).unwrap()
    }
}

fn result_of(view: &RunView, position: usize) -> crate::mistakes::domain::practice::ExerciseResult {
    view.items[position].result.clone().unwrap()
}

#[test]
fn a_due_run_takes_up_to_six_open_mistakes_most_frequent_rule_first() {
    let mut f = fixture();
    let article_a = f.mistake("I have job", "I have a job", Some(RuleKey::Articles));
    let article_b = f.mistake("I have car", "I have a car", Some(RuleKey::Articles));
    let article_c = f.mistake("I have dog", "I have a dog", Some(RuleKey::Articles));
    let preposition = f.mistake("in Monday", "on Monday", Some(RuleKey::Prepositions));
    let fixed = f.mistake("a b", "a c", Some(RuleKey::Articles));
    f.set(fixed, "fixed_at = 5");
    let future = f.mistake("x y", "x z", Some(RuleKey::Prepositions));
    f.set(future, &format!("next_review_at = {}", NOW_LATER + DAY_MS));
    let view = f.service.start(RunTarget::Due).unwrap();
    let ids: Vec<u64> = view.items.iter().map(|item| item.mistake_id).collect();
    assert_eq!(ids.len(), 4);
    assert!(ids[..3].contains(&article_a));
    assert!(ids[..3].contains(&article_b));
    assert!(ids[..3].contains(&article_c));
    assert_eq!(ids[3], preposition);
    assert!(!ids.contains(&fixed) && !ids.contains(&future));
    assert_eq!(view.kind, RunKind::Due);
    assert!(!view.finished);
}

#[test]
fn a_run_is_capped_at_six_exercises() {
    let mut f = fixture();
    for index in 0..9 {
        f.mistake(
            &format!("I go {index}"),
            &format!("I went {index}"),
            Some(RuleKey::Articles),
        );
    }
    assert_eq!(f.service.start(RunTarget::Due).unwrap().items.len(), 6);
}

#[test]
fn practising_one_mistake_works_even_when_it_is_not_due() {
    let mut f = fixture();
    let id = f.mistake("I work there", "I worked there", Some(RuleKey::Articles));
    f.set(id, &format!("next_review_at = {}", NOW_LATER + 5 * DAY_MS));
    assert!(matches!(
        f.service.start(RunTarget::Due),
        Err(MistakesError::NothingToPractice)
    ));
    let view = f.one(id);
    assert_eq!(view.items.len(), 1);
    assert_eq!(view.kind, RunKind::One);
}

#[test]
fn a_rule_run_takes_that_rules_open_mistakes_due_or_not() {
    let mut f = fixture();
    let a = f.mistake("in Monday", "on Monday", Some(RuleKey::Prepositions));
    let b = f.mistake("on 2020", "in 2020", Some(RuleKey::Prepositions));
    f.set(b, &format!("next_review_at = {}", NOW_LATER + DAY_MS));
    let other = f.mistake("I have job", "I have a job", Some(RuleKey::Articles));
    let view = f
        .service
        .start(RunTarget::Rule(RuleKey::Prepositions))
        .unwrap();
    let ids: Vec<u64> = view.items.iter().map(|item| item.mistake_id).collect();
    assert_eq!(ids.len(), 2);
    assert!(ids.contains(&a) && ids.contains(&b) && !ids.contains(&other));
    assert_eq!(view.kind, RunKind::Rule);
}

#[test]
fn an_open_run_is_returned_unchanged_and_resumes_after_answers() {
    let mut f = fixture();
    let id = f.mistake("I work there", "I worked there", Some(RuleKey::Articles));
    let other = f.mistake("in Monday", "on Monday", Some(RuleKey::Prepositions));
    let first = f.service.start(RunTarget::Due).unwrap();
    f.set(id, "ladder_step = 3");
    let again = f.service.start(RunTarget::Due).unwrap();
    assert_eq!(first, again);
    let different_target = f.service.start(RunTarget::One(other)).unwrap();
    assert_eq!(first, different_target);
    let position = first
        .items
        .iter()
        .position(|item| item.mistake_id == id)
        .unwrap();
    f.answer(first.run_id, u32::try_from(position).unwrap(), "worked")
        .unwrap();
    let resumed = f.service.start(RunTarget::Due).unwrap();
    assert_eq!(resumed.run_id, first.run_id);
    assert!(resumed.items[position].result.is_some());
    assert_eq!(f.service.run(first.run_id).unwrap(), resumed);
}

#[test]
fn a_finished_run_lets_a_new_one_start() {
    let mut f = fixture();
    let id = f.mistake("I work there", "I worked there", Some(RuleKey::Articles));
    let first = f.one(id);
    f.service.finish(first.run_id).unwrap();
    let second = f.one(id);
    assert_ne!(first.run_id, second.run_id);
}

#[test]
fn a_mistake_without_lesson_data_gets_the_say_it_step() {
    let mut f = fixture();
    let id = f.mistake("I work there", "I worked there", None);
    let view = f.one(id);
    assert_eq!(view.items[0].step, 3);
    assert_eq!(view.items[0].question, "Where were you?");
    let run = view.run_id;
    let answered = f
        .service
        .answer(run, 0, "yes I worked there for a year", InputKind::Spoken)
        .unwrap();
    assert_eq!(
        answered.exercise.result.unwrap().outcome,
        AttemptOutcome::Pass
    );
    assert_eq!(f.column(id, "ladder_step"), 2);
}

#[test]
fn fill_the_gaps_hides_the_words_and_checks_locally() {
    let mut f = fixture();
    let id = f.mistake("I work there", "I worked there", Some(RuleKey::Articles));
    let view = f.one(id);
    let json = serde_json::to_string(&view).unwrap();
    assert!(!json.contains("worked"));
    assert_eq!(view.items[0].step, 1);
    let answered = f.answer(view.run_id, 0, "Worked").unwrap();
    assert!(answered.check.is_none());
    let result = answered.exercise.result.unwrap();
    assert_eq!(result.outcome, AttemptOutcome::Pass);
    assert_eq!(result.keep, "I worked there");
    assert_eq!(f.column(id, "ladder_step"), 2);
    assert_eq!(f.column(id, "next_review_at"), NOW_LATER + DAY_MS);
    assert_eq!(f.checker.calls(), 0);
}

#[test]
fn a_miss_keeps_the_step_and_returns_on_the_next_local_day() {
    let mut f = fixture();
    let id = f.mistake("I work there", "I worked there", Some(RuleKey::Articles));
    let view = f.one(id);
    let answered = f.answer(view.run_id, 0, "work").unwrap();
    let result = answered.exercise.result.unwrap();
    assert_eq!(result.outcome, AttemptOutcome::Miss);
    assert!(result.note.starts_with("Not quite"));
    assert_eq!(f.column(id, "ladder_step"), 1);
    let due = f.column(id, "next_review_at");
    assert!(due > NOW_LATER && due <= NOW_LATER + DAY_MS);
    assert_eq!((due + f.offset()).rem_euclid(DAY_MS), 0);
}

#[test]
fn a_retry_after_a_miss_is_saved_and_changes_nothing() {
    let mut f = fixture();
    let id = f.mistake("I work there", "I worked there", Some(RuleKey::Articles));
    let view = f.one(id);
    f.answer(view.run_id, 0, "work").unwrap();
    let due = f.column(id, "next_review_at");
    let retried = f.answer(view.run_id, 0, "worked").unwrap();
    let result = retried.exercise.result.unwrap();
    assert_eq!(result.outcome, AttemptOutcome::Miss);
    assert!(result.retried);
    assert_eq!(
        result.retry_note.as_deref(),
        Some("That matches the version to keep.")
    );
    assert_eq!(f.column(id, "ladder_step"), 1);
    assert_eq!(f.column(id, "next_review_at"), due);
    let outcomes: i64 = single(
        &f.sessions,
        "SELECT COUNT(*) FROM mistake_attempts WHERE mistake_id = ?1 AND outcome = 'retry'",
        id,
    );
    assert_eq!(outcomes, 1);
    assert!(matches!(
        f.answer(view.run_id, 0, "worked"),
        Err(MistakesError::Rejected(_))
    ));
}

#[test]
fn an_answer_after_a_pass_is_rejected() {
    let mut f = fixture();
    let id = f.mistake("I work there", "I worked there", Some(RuleKey::Articles));
    let view = f.one(id);
    f.answer(view.run_id, 0, "worked").unwrap();
    assert!(matches!(
        f.answer(view.run_id, 0, "worked"),
        Err(MistakesError::Rejected(_))
    ));
    assert!(matches!(
        f.answer(view.run_id, 9, "worked"),
        Err(MistakesError::ExerciseNotFound(9))
    ));
}

#[test]
fn fix_it_accepts_the_corrected_sentence_and_prepared_rewrites_locally() {
    let mut f = fixture();
    let id = f.mistake("I work there", "I worked there", Some(RuleKey::Articles));
    f.set(id, "ladder_step = 2");
    let view = f.one(id);
    assert_eq!(view.items[0].step, 2);
    assert_eq!(view.items[0].said.as_deref(), Some("I work there"));
    let answered = f.answer(view.run_id, 0, "i did work there!").unwrap();
    assert_eq!(
        answered.exercise.result.unwrap().outcome,
        AttemptOutcome::Pass
    );
    assert_eq!(f.column(id, "ladder_step"), 3);
    assert_eq!(f.column(id, "next_review_at"), NOW_LATER + 3 * DAY_MS);
}

#[test]
fn check_it_asks_the_background_check_and_a_pass_replaces_the_local_miss() {
    let mut f = fixture_with(FakeChecker::replying(vec![verdict(
        true,
        "Same meaning, correct tense.",
    )]));
    let id = f.mistake("I work there", "I worked there", Some(RuleKey::Articles));
    f.set(id, "ladder_step = 2");
    let view = f.one(id);
    let missed = f.answer(view.run_id, 0, "I had worked there").unwrap();
    assert!(missed.exercise.result.as_ref().unwrap().can_check);
    assert_eq!(f.column(id, "ladder_step"), 2);
    let checking = f.service.request_check(view.run_id, 0).unwrap();
    let attempt = checking.check.unwrap();
    let result = checking.exercise.result.unwrap();
    assert_eq!(result.outcome, AttemptOutcome::Checking);
    assert!(!result.can_check);
    assert!(f.notifier.0.lock().unwrap().is_empty());
    let outcome = f.service.run_check(attempt).unwrap();
    assert_eq!(
        outcome,
        super::practice_service::CheckOutcome::Resolved(AttemptOutcome::Pass)
    );
    let request = f.checker.requests.lock().unwrap()[0].clone();
    assert_eq!(request.step, 2);
    assert_eq!(request.answer, "I had worked there");
    assert_eq!(request.said, "I work there");
    let done = f.service.run(view.run_id).unwrap();
    assert_eq!(result_of(&done, 0).outcome, AttemptOutcome::Pass);
    assert_eq!(result_of(&done, 0).note, "Same meaning, correct tense.");
    assert_eq!(f.column(id, "ladder_step"), 3);
    assert_eq!(f.column(id, "next_review_at"), NOW_LATER + 3 * DAY_MS);
    assert_eq!(f.notifier.0.lock().unwrap().len(), 1);
}

#[test]
fn check_it_is_refused_for_a_step_that_is_not_fix_it_or_after_a_retry() {
    let mut f = fixture();
    let id = f.mistake("I work there", "I worked there", Some(RuleKey::Articles));
    let view = f.one(id);
    f.answer(view.run_id, 0, "work").unwrap();
    assert!(matches!(
        f.service.request_check(view.run_id, 0),
        Err(MistakesError::CheckUnavailable(_))
    ));
    let second = f.mistake("in Monday", "on Monday", Some(RuleKey::Prepositions));
    f.service.finish(view.run_id).unwrap();
    f.set(second, "ladder_step = 2");
    let run = f.one(second);
    f.answer(run.run_id, 0, "at Monday").unwrap();
    f.answer(run.run_id, 0, "at Monday").unwrap();
    assert!(matches!(
        f.service.request_check(run.run_id, 0),
        Err(MistakesError::CheckUnavailable(_))
    ));
}

#[test]
fn use_it_is_saved_as_checking_and_resolved_by_one_background_call() {
    let mut f = fixture_with(FakeChecker::replying(vec![verdict(
        true,
        "You used it well.",
    )]));
    let id = f.mistake("I work there", "I worked there", Some(RuleKey::Articles));
    f.set(id, "ladder_step = 4");
    let view = f.one(id);
    assert_eq!(view.items[0].step, 4);
    assert_eq!(view.items[0].question, "Where else have you worked?");
    let answered = f
        .service
        .answer(view.run_id, 0, "I worked at a bank", InputKind::Spoken)
        .unwrap();
    let attempt = answered.check.unwrap();
    assert_eq!(
        answered.exercise.result.unwrap().outcome,
        AttemptOutcome::Checking
    );
    assert_eq!(f.column(id, "ladder_step"), 4);
    assert_eq!(f.column(id, "step4_pass_days"), 0);
    assert_eq!(f.checker.calls(), 0);
    assert!(matches!(
        f.answer(view.run_id, 0, "again"),
        Err(MistakesError::Rejected(_))
    ));
    f.service.run_check(attempt).unwrap();
    assert_eq!(f.checker.calls(), 1);
    let request = f.checker.requests.lock().unwrap()[0].clone();
    assert_eq!(request.step, 4);
    assert_eq!(request.question, "Where else have you worked?");
    assert_eq!(f.column(id, "step4_pass_days"), 1);
    assert_eq!(f.column(id, "next_review_at"), NOW_LATER + 14 * DAY_MS);
    assert_eq!(f.column(id, "fixed_at"), -1);
    let done = f.service.run(view.run_id).unwrap();
    assert_eq!(result_of(&done, 0).outcome, AttemptOutcome::Pass);
    assert_eq!(result_of(&done, 0).note, "You used it well.");
}

#[test]
fn two_use_it_passes_on_different_days_fix_the_mistake() {
    let mut f = fixture_with(FakeChecker::replying(vec![
        verdict(true, "Good."),
        verdict(true, "Good again."),
    ]));
    let id = f.mistake("I work there", "I worked there", Some(RuleKey::Articles));
    f.set(id, "ladder_step = 4");
    for day in 0..2 {
        f.clock.0.store(
            NOW_LATER + day * 15 * DAY_MS,
            std::sync::atomic::Ordering::SeqCst,
        );
        let view = f.one(id);
        let attempt = f
            .answer(view.run_id, 0, "I worked at a bank")
            .unwrap()
            .check
            .unwrap();
        f.service.run_check(attempt).unwrap();
        f.service.finish(view.run_id).unwrap();
    }
    assert_eq!(f.column(id, "step4_pass_days"), 2);
    assert!(f.column(id, "fixed_at") > 0);
    let summary = f.store.mistake(id, NOW_LATER).unwrap().unwrap();
    assert!(!summary.is_due);
    assert!(f.service.start(RunTarget::Due).is_err());
}

#[test]
fn a_second_use_it_pass_on_the_same_day_does_not_fix_the_mistake() {
    let mut f = fixture_with(FakeChecker::replying(vec![
        verdict(true, "Good."),
        verdict(true, "Good again."),
    ]));
    let id = f.mistake("I work there", "I worked there", Some(RuleKey::Articles));
    f.set(id, "ladder_step = 4");
    for _ in 0..2 {
        let view = f.one(id);
        let attempt = f
            .answer(view.run_id, 0, "I worked at a bank")
            .unwrap()
            .check
            .unwrap();
        f.service.run_check(attempt).unwrap();
        f.service.finish(view.run_id).unwrap();
    }
    assert_eq!(f.column(id, "step4_pass_days"), 1);
    assert_eq!(f.column(id, "fixed_at"), -1);
}

#[test]
fn a_use_it_miss_keeps_the_step_and_a_retry_does_not_call_the_check_again() {
    let mut f = fixture_with(FakeChecker::replying(vec![verdict(
        false,
        "The tense is still off.",
    )]));
    let id = f.mistake("I work there", "I worked there", Some(RuleKey::Articles));
    f.set(id, "ladder_step = 4");
    let view = f.one(id);
    let attempt = f
        .answer(view.run_id, 0, "I work at a bank")
        .unwrap()
        .check
        .unwrap();
    assert_eq!(
        f.service.run_check(attempt).unwrap(),
        super::practice_service::CheckOutcome::Resolved(AttemptOutcome::Miss)
    );
    assert_eq!(f.column(id, "ladder_step"), 4);
    let due = f.column(id, "next_review_at");
    assert!(due > NOW_LATER && due <= NOW_LATER + DAY_MS);
    let retried = f.answer(view.run_id, 0, "I worked at a bank").unwrap();
    assert!(retried.check.is_none());
    assert!(retried.exercise.result.unwrap().retried);
    assert_eq!(f.checker.calls(), 1);
    assert_eq!(f.column(id, "next_review_at"), due);
}

#[test]
fn a_failed_check_stays_checking_changes_no_schedule_and_can_be_retried() {
    let mut f = fixture_with(FakeChecker::replying(vec![
        Err(CheckError::Failed),
        verdict(true, "Fine."),
    ]));
    let id = f.mistake("I work there", "I worked there", Some(RuleKey::Articles));
    f.set(id, "ladder_step = 4");
    let before = f.column(id, "next_review_at");
    let view = f.one(id);
    let attempt = f
        .answer(view.run_id, 0, "I worked at a bank")
        .unwrap()
        .check
        .unwrap();
    assert!(matches!(
        f.service.run_check(attempt),
        Err(MistakesError::CheckFailed)
    ));
    let state = f.service.run(view.run_id).unwrap();
    assert_eq!(result_of(&state, 0).outcome, AttemptOutcome::Checking);
    assert_eq!(f.column(id, "next_review_at"), before);
    assert_eq!(f.column(id, "step4_pass_days"), 0);
    assert!(f.notifier.0.lock().unwrap().is_empty());
    assert_eq!(f.service.retry_check(attempt).unwrap(), attempt);
    f.service.run_check(attempt).unwrap();
    assert_eq!(
        result_of(&f.service.run(view.run_id).unwrap(), 0).outcome,
        AttemptOutcome::Pass
    );
    assert!(matches!(
        f.service.retry_check(attempt),
        Err(MistakesError::CheckUnavailable(_))
    ));
    assert_eq!(
        f.service.run_check(attempt).unwrap(),
        super::practice_service::CheckOutcome::Settled
    );
    assert_eq!(f.checker.calls(), 2);
}

#[test]
fn answers_after_finish_are_rejected_and_finishing_twice_is_harmless() {
    let mut f = fixture();
    let id = f.mistake("I work there", "I worked there", Some(RuleKey::Articles));
    let view = f.one(id);
    let finished = f.service.finish(view.run_id).unwrap();
    assert!(finished.finished);
    assert!(matches!(
        f.answer(view.run_id, 0, "worked"),
        Err(MistakesError::RunFinished)
    ));
    assert!(matches!(
        f.service.request_check(view.run_id, 0),
        Err(MistakesError::RunFinished)
    ));
    assert!(f.service.finish(view.run_id).unwrap().finished);
    assert!(matches!(
        f.service.finish(999),
        Err(MistakesError::RunNotFound(999))
    ));
    assert!(matches!(
        f.service.run(999),
        Err(MistakesError::RunNotFound(999))
    ));
}

#[test]
fn a_check_still_resolves_after_the_run_is_finished() {
    let mut f = fixture_with(FakeChecker::replying(vec![verdict(true, "Good.")]));
    let id = f.mistake("I work there", "I worked there", Some(RuleKey::Articles));
    f.set(id, "ladder_step = 4");
    let view = f.one(id);
    let attempt = f
        .answer(view.run_id, 0, "I worked at a bank")
        .unwrap()
        .check
        .unwrap();
    f.service.finish(view.run_id).unwrap();
    f.service.run_check(attempt).unwrap();
    assert_eq!(
        result_of(&f.service.run(view.run_id).unwrap(), 0).outcome,
        AttemptOutcome::Pass
    );
}

#[test]
fn an_empty_answer_is_rejected_and_the_target_must_be_complete() {
    let mut f = fixture();
    let id = f.mistake("I work there", "I worked there", Some(RuleKey::Articles));
    let view = f.one(id);
    assert!(matches!(
        f.answer(view.run_id, 0, "   "),
        Err(MistakesError::Rejected(_))
    ));
    assert!(matches!(
        PracticeService::target(RunKind::One, None, None),
        Err(MistakesError::MissingTarget)
    ));
    assert!(matches!(
        PracticeService::target(RunKind::Rule, Some(3), None),
        Err(MistakesError::MissingTarget)
    ));
    assert_eq!(
        PracticeService::target(RunKind::Rule, None, Some(RuleKey::Articles)).unwrap(),
        RunTarget::Rule(RuleKey::Articles)
    );
}

#[test]
fn concurrent_answers_to_one_exercise_count_once() {
    let mut f = fixture();
    let id = f.mistake("I work there", "I worked there", Some(RuleKey::Articles));
    let view = f.one(id);
    let handles: Vec<_> = (0..6)
        .map(|_| {
            let service = f.service.clone();
            let run = view.run_id;
            std::thread::spawn(move || service.answer(run, 0, "worked", InputKind::Typed).is_ok())
        })
        .collect();
    let accepted = handles
        .into_iter()
        .map(|handle| handle.join().unwrap())
        .filter(|ok| *ok)
        .count();
    assert_eq!(accepted, 1);
    let attempts: i64 = single(
        &f.sessions,
        "SELECT COUNT(*) FROM mistake_attempts WHERE mistake_id = ?1",
        id,
    );
    assert_eq!(attempts, 1);
    assert_eq!(f.column(id, "ladder_step"), 2);
}

#[test]
fn concurrent_checks_of_one_attempt_call_the_provider_once() {
    let checker = FakeChecker {
        replies: Mutex::new(vec![verdict(true, "Good."), verdict(true, "Good.")]),
        delay: Duration::from_millis(80),
        ..FakeChecker::default()
    };
    let mut f = fixture_with(checker);
    let id = f.mistake("I work there", "I worked there", Some(RuleKey::Articles));
    f.set(id, "ladder_step = 4");
    let view = f.one(id);
    let attempt = f
        .answer(view.run_id, 0, "I worked at a bank")
        .unwrap()
        .check
        .unwrap();
    let handles: Vec<_> = (0..4)
        .map(|_| {
            let service = f.service.clone();
            std::thread::spawn(move || service.run_check(attempt).unwrap())
        })
        .collect();
    for handle in handles {
        handle.join().unwrap();
    }
    assert_eq!(f.checker.calls(), 1);
    assert_eq!(f.column(id, "step4_pass_days"), 1);
    assert_eq!(f.notifier.0.lock().unwrap().len(), 1);
}

#[test]
fn a_mistake_archived_mid_run_can_still_be_answered_without_touching_the_schedule() {
    let mut f = fixture();
    let id = f.mistake("I work there", "I worked there", Some(RuleKey::Articles));
    let view = f.one(id);
    f.store.archive(id).unwrap();
    let answered = f.answer(view.run_id, 0, "worked").unwrap();
    assert_eq!(
        answered.exercise.result.unwrap().outcome,
        AttemptOutcome::Pass
    );
    assert_eq!(f.column(id, "ladder_step"), 1);
}
