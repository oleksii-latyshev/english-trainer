use crate::mistakes::domain::check_prompt::CheckRequest;
use crate::mistakes::domain::ladder::{schedule, ScheduleUpdate};
use crate::mistakes::domain::practice::{
    decide, exercise_view, plan_run, AttemptOutcome, CheckedBy, Decision, ExerciseView, InputKind,
    RunItem, RunRecord, RunView, MISS_NOTE, PASS_NOTE,
};
use crate::mistakes::domain::rules::RuleKey;
use crate::mistakes::error::MistakesError;
use crate::mistakes::ports::{
    AnswerChecker, Clock, MistakesNotifier, NewAttempt, PracticeStore, RunTarget,
};
use std::collections::HashSet;
use std::sync::{Arc, Mutex, MutexGuard};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Answered {
    pub exercise: ExerciseView,
    pub check: Option<u64>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CheckOutcome {
    Resolved(AttemptOutcome),
    AlreadyRunning,
    Settled,
}

#[derive(Clone)]
pub struct PracticeService {
    store: Arc<dyn PracticeStore>,
    checker: Arc<dyn AnswerChecker>,
    notifier: Arc<dyn MistakesNotifier>,
    clock: Arc<dyn Clock>,
    gate: Arc<Mutex<()>>,
    in_flight: Arc<Mutex<HashSet<u64>>>,
}

struct InFlight<'a> {
    set: &'a Mutex<HashSet<u64>>,
    id: u64,
}

impl Drop for InFlight<'_> {
    fn drop(&mut self) {
        if let Ok(mut set) = self.set.lock() {
            set.remove(&self.id);
        }
    }
}

fn lock<T>(mutex: &Mutex<T>) -> MutexGuard<'_, T> {
    mutex
        .lock()
        .unwrap_or_else(std::sync::PoisonError::into_inner)
}

impl PracticeService {
    pub fn new(
        store: Arc<dyn PracticeStore>,
        checker: Arc<dyn AnswerChecker>,
        notifier: Arc<dyn MistakesNotifier>,
        clock: Arc<dyn Clock>,
    ) -> Self {
        Self {
            store,
            checker,
            notifier,
            clock,
            gate: Arc::default(),
            in_flight: Arc::default(),
        }
    }

    pub fn start(&self, target: RunTarget) -> Result<RunView, MistakesError> {
        let _gate = lock(&self.gate);
        let run = self
            .store
            .start_run(target, self.clock.now_ms(), &plan_run)?
            .ok_or(MistakesError::NothingToPractice)?;
        Ok(crate::mistakes::domain::practice::run_view(&run))
    }

    pub fn target(
        kind: crate::mistakes::domain::practice::RunKind,
        id: Option<u64>,
        rule: Option<RuleKey>,
    ) -> Result<RunTarget, MistakesError> {
        use crate::mistakes::domain::practice::RunKind;
        match kind {
            RunKind::Due => Ok(RunTarget::Due),
            RunKind::One => id.map(RunTarget::One).ok_or(MistakesError::MissingTarget),
            RunKind::Rule => rule
                .map(RunTarget::Rule)
                .ok_or(MistakesError::MissingTarget),
        }
    }

    pub fn run(&self, run_id: u64) -> Result<RunView, MistakesError> {
        let run = self.open_record(run_id)?;
        Ok(crate::mistakes::domain::practice::run_view(&run))
    }

    pub fn answer(
        &self,
        run_id: u64,
        position: u32,
        answer: &str,
        input: InputKind,
    ) -> Result<Answered, MistakesError> {
        let _gate = lock(&self.gate);
        let run = self.open_record(run_id)?;
        if run.finished_at.is_some() {
            return Err(MistakesError::RunFinished);
        }
        let item = item_at(&run, position)?;
        let now = self.clock.now_ms();
        let mut attempt = NewAttempt {
            mistake_id: item.mistake_id,
            run_id,
            step: item.step,
            input,
            answer: answer.trim().to_string(),
            outcome: AttemptOutcome::Retry,
            checked_by: CheckedBy::Local,
            note: String::new(),
            created_at: now,
        };
        let mut update = None;
        match decide(item, &run.attempts, answer) {
            Decision::Reject(rejection) => return Err(MistakesError::Rejected(rejection)),
            Decision::Retry { note } => attempt.note = note.to_string(),
            Decision::Local { passed } => {
                attempt.outcome = if passed {
                    AttemptOutcome::Pass
                } else {
                    AttemptOutcome::Miss
                };
                attempt.note = if passed { PASS_NOTE } else { MISS_NOTE }.to_string();
                update = self.schedule_for(item, passed, now)?;
            }
            Decision::Background => {
                attempt.outcome = AttemptOutcome::Checking;
                attempt.checked_by = CheckedBy::Ai;
            }
        }
        let attempt_id = self.store.record(&attempt, update)?;
        let exercise = self.exercise(run_id, position)?;
        let check = (attempt.outcome == AttemptOutcome::Checking).then_some(attempt_id);
        Ok(Answered { exercise, check })
    }

    pub fn request_check(&self, run_id: u64, position: u32) -> Result<Answered, MistakesError> {
        let _gate = lock(&self.gate);
        let run = self.open_record(run_id)?;
        if run.finished_at.is_some() {
            return Err(MistakesError::RunFinished);
        }
        let item = item_at(&run, position)?;
        let attempt = run
            .attempts
            .iter()
            .find(|attempt| {
                attempt.mistake_id == item.mistake_id && attempt.outcome != AttemptOutcome::Retry
            })
            .ok_or(MistakesError::CheckUnavailable(0))?;
        if !self.store.begin_check(attempt.id)? {
            return Err(MistakesError::CheckUnavailable(attempt.id));
        }
        Ok(Answered {
            exercise: self.exercise(run_id, position)?,
            check: Some(attempt.id),
        })
    }

    pub fn retry_check(&self, attempt_id: u64) -> Result<u64, MistakesError> {
        let attempt = self
            .store
            .attempt(attempt_id)?
            .ok_or(MistakesError::CheckUnavailable(attempt_id))?;
        if attempt.outcome == AttemptOutcome::Checking {
            Ok(attempt_id)
        } else {
            Err(MistakesError::CheckUnavailable(attempt_id))
        }
    }

    pub fn run_check(&self, attempt_id: u64) -> Result<CheckOutcome, MistakesError> {
        {
            let mut running = lock(&self.in_flight);
            if !running.insert(attempt_id) {
                return Ok(CheckOutcome::AlreadyRunning);
            }
        }
        let _guard = InFlight {
            set: &self.in_flight,
            id: attempt_id,
        };
        let Some(attempt) = self.store.attempt(attempt_id)? else {
            return Ok(CheckOutcome::Settled);
        };
        if attempt.outcome != AttemptOutcome::Checking {
            return Ok(CheckOutcome::Settled);
        }
        let run = self.open_record(attempt.run_id)?;
        let item = run
            .items
            .iter()
            .find(|item| item.mistake_id == attempt.mistake_id)
            .ok_or(MistakesError::ExerciseNotFound(0))?;
        let request = CheckRequest {
            step: attempt.step,
            question: item
                .situation
                .clone()
                .unwrap_or_else(|| item.question.clone()),
            said: item.said.clone(),
            corrected: item.corrected.clone(),
            accepted: item.accepted.clone(),
            answer: attempt.answer.clone(),
            rule_title: item.rule_title.clone(),
            explanation: item.explanation.clone(),
        };
        let verdict = self
            .checker
            .check(&request)
            .map_err(|_| MistakesError::CheckFailed)?;
        let outcome = if verdict.passed {
            AttemptOutcome::Pass
        } else {
            AttemptOutcome::Miss
        };
        let _gate = lock(&self.gate);
        let update = self.schedule_for(item, verdict.passed, self.clock.now_ms())?;
        if self
            .store
            .resolve(attempt_id, outcome, &verdict.note, update)?
        {
            self.notifier.updated(0);
            Ok(CheckOutcome::Resolved(outcome))
        } else {
            Ok(CheckOutcome::Settled)
        }
    }

    pub fn finish(&self, run_id: u64) -> Result<RunView, MistakesError> {
        let _gate = lock(&self.gate);
        if !self.store.finish_run(run_id, self.clock.now_ms())? {
            return Err(MistakesError::RunNotFound(run_id));
        }
        self.run(run_id)
    }

    fn open_record(&self, run_id: u64) -> Result<RunRecord, MistakesError> {
        self.store
            .run(run_id)?
            .ok_or(MistakesError::RunNotFound(run_id))
    }

    fn exercise(&self, run_id: u64, position: u32) -> Result<ExerciseView, MistakesError> {
        let run = self.open_record(run_id)?;
        let item = item_at(&run, position)?;
        Ok(exercise_view(item, &run.attempts))
    }

    fn schedule_for(
        &self,
        item: &RunItem,
        passed: bool,
        now_ms: i64,
    ) -> Result<Option<(u64, ScheduleUpdate)>, MistakesError> {
        let Some(progress) = self.store.progress(item.mistake_id)? else {
            return Ok(None);
        };
        let offset = self.store.utc_offset_ms(now_ms)?;
        Ok(Some((
            item.mistake_id,
            schedule(progress, item.step, passed, now_ms, offset),
        )))
    }
}

fn item_at(run: &RunRecord, position: u32) -> Result<&RunItem, MistakesError> {
    run.items
        .iter()
        .find(|item| item.position == position)
        .ok_or(MistakesError::ExerciseNotFound(position))
}
