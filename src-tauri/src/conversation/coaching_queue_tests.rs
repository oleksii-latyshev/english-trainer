use super::*;
use crate::conversation::TurnCoaching;
use crate::providers::{ConversationTurn, FocusCategory, FocusFeedback, TurnFeedback};
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::mpsc;
use std::sync::Mutex as StdMutex;

const LONG: Duration = Duration::from_secs(3600);
const WAIT: Duration = Duration::from_secs(5);

fn eva(reply: &str) -> ConversationTurn {
    ConversationTurn {
        spoken_reply: reply.into(),
        question: Some("And then?".into()),
        session_phase: "active".into(),
        is_complete: false,
        provider_latency_ms: None,
        first_token_ms: None,
        answered_by: None,
    }
}

fn say(store: &SessionStore, session_id: u64, text: &str) {
    store
        .send_turn(session_id, text.into(), |_| Ok(eva("I see.")))
        .unwrap();
}

fn feedback_for(answer: &CoachingAnswer) -> CoachedAnswer {
    CoachedAnswer {
        sequence: answer.sequence,
        feedback: TurnFeedback {
            focus_feedback: vec![FocusFeedback {
                category: FocusCategory::Grammar,
                original: answer.transcript.clone(),
                improved: format!("{} correctly", answer.transcript),
                explanation: "Say it the natural way.".into(),
            }],
            b2_rewrite: format!("{}, said naturally.", answer.transcript),
        },
    }
}

type Reply = Box<
    dyn Fn(usize, &[CoachingAnswer]) -> Result<Vec<CoachedAnswer>, ProviderError> + Send + Sync,
>;

/// A fake coach that records each batch's sequences and answers with `reply`.
struct Recorder {
    batches: Arc<StdMutex<Vec<Vec<usize>>>>,
    seen: mpsc::Sender<Vec<usize>>,
    reply: Reply,
}

impl BatchCoach for Recorder {
    fn coach(&self, answers: &[CoachingAnswer]) -> Result<Vec<CoachedAnswer>, ProviderError> {
        let sequences: Vec<usize> = answers.iter().map(|answer| answer.sequence).collect();
        let call_number = {
            let mut batches = self.batches.lock().unwrap();
            batches.push(sequences.clone());
            batches.len()
        };
        let result = (self.reply)(call_number, answers);
        let _ = self.seen.send(sequences);
        result
    }
}

struct Fixture {
    store: SessionStore,
    queue: CoachingQueue,
    batches: Arc<StdMutex<Vec<Vec<usize>>>>,
    seen: mpsc::Receiver<Vec<usize>>,
    events: mpsc::Receiver<CoachingEvent>,
}

impl Fixture {
    fn new(
        store: SessionStore,
        idle: Duration,
        reply: impl Fn(usize, &[CoachingAnswer]) -> Result<Vec<CoachedAnswer>, ProviderError>
            + Send
            + Sync
            + 'static,
    ) -> Self {
        Self::with_pause(store, idle, QUOTA_PAUSE, reply)
    }

    fn with_pause(
        store: SessionStore,
        idle: Duration,
        quota_pause: Duration,
        reply: impl Fn(usize, &[CoachingAnswer]) -> Result<Vec<CoachedAnswer>, ProviderError>
            + Send
            + Sync
            + 'static,
    ) -> Self {
        let batches = Arc::new(StdMutex::new(Vec::new()));
        let (seen_tx, seen) = mpsc::channel();
        let (event_tx, events) = mpsc::channel();
        let event_tx = StdMutex::new(event_tx);
        let queue = CoachingQueue::start(
            store.clone(),
            Recorder {
                batches: batches.clone(),
                seen: seen_tx,
                reply: Box::new(reply),
            },
            idle,
            quota_pause,
            move |event| {
                let _ = event_tx.lock().unwrap().send(event);
            },
        );
        Self {
            store,
            queue,
            batches,
            seen,
            events,
        }
    }

    fn answer(&self, session_id: u64, text: &str) {
        say(&self.store, session_id, text);
        self.queue.answer_saved(session_id);
    }

    fn next_batch(&self) -> Vec<usize> {
        self.seen.recv_timeout(WAIT).expect("a batch should run")
    }

    fn assert_no_batch_within(&self, wait: Duration) {
        assert!(
            self.seen.recv_timeout(wait).is_err(),
            "no batch should run yet"
        );
    }

    fn next_event(&self) -> CoachingEvent {
        self.events.recv_timeout(WAIT).expect("an event")
    }

    fn coaching(&self, session_id: u64) -> Vec<TurnCoaching> {
        self.store.dialogue(session_id).unwrap().coaching
    }
}

fn all_ok(_: usize, answers: &[CoachingAnswer]) -> Result<Vec<CoachedAnswer>, ProviderError> {
    Ok(answers.iter().map(feedback_for).collect())
}

fn is_ready(coaching: &TurnCoaching) -> bool {
    matches!(coaching, TurnCoaching::Ready { .. })
}

#[test]
fn a_batch_starts_when_five_answers_wait_and_every_answer_gets_its_own_feedback() {
    let store = SessionStore::default();
    let session = store.start().unwrap();
    let fixture = Fixture::new(store, LONG, all_ok);

    for n in 1..=4 {
        fixture.answer(session.session_id, &format!("Answer number {n}"));
    }
    fixture.assert_no_batch_within(Duration::from_millis(200));
    assert!(fixture
        .coaching(session.session_id)
        .iter()
        .all(|state| *state == TurnCoaching::Pending));

    fixture.answer(session.session_id, "Answer number 5");
    assert_eq!(fixture.next_batch(), [1, 2, 3, 4, 5]);
    assert_eq!(fixture.next_event().session_id, session.session_id);

    let coaching = fixture.coaching(session.session_id);
    assert!(coaching.iter().all(is_ready));
    let TurnCoaching::Ready { feedback } = &coaching[2] else {
        panic!("answer 3 is coached");
    };
    assert_eq!(feedback.focus_feedback[0].original, "Answer number 3");
    // Each answer reached the learning engine as its own mistake.
    assert_eq!(
        fixture.store.get_learning_memory().unwrap().mistakes.len(),
        5
    );
}

#[test]
fn only_five_answers_go_in_one_batch_and_batches_never_overlap() {
    let store = SessionStore::default();
    let session = store.start().unwrap();
    let running = Arc::new(AtomicUsize::new(0));
    let most_at_once = Arc::new(AtomicUsize::new(0));
    let (running_in, most_in) = (running.clone(), most_at_once.clone());
    let fixture = Fixture::new(store, LONG, move |call, answers| {
        let now = running_in.fetch_add(1, Ordering::SeqCst) + 1;
        most_in.fetch_max(now, Ordering::SeqCst);
        thread::sleep(Duration::from_millis(100));
        running_in.fetch_sub(1, Ordering::SeqCst);
        all_ok(call, answers)
    });
    for n in 1..=7 {
        say(&fixture.store, session.session_id, &format!("Answer {n}"));
    }
    fixture.queue.answer_saved(session.session_id);
    assert_eq!(fixture.next_batch(), [1, 2, 3, 4, 5]);
    fixture.assert_no_batch_within(Duration::from_millis(300));

    fixture.queue.flush(session.session_id);
    assert_eq!(fixture.next_batch(), [6, 7]);
    assert_eq!(most_at_once.load(Ordering::SeqCst), 1);
}

#[test]
fn finishing_flushes_the_queue_and_the_wrap_up_fills_in_when_the_last_batch_lands() {
    let store = SessionStore::default();
    let session = store.start().unwrap();
    let (release_tx, release_rx) = mpsc::channel::<()>();
    let release_rx = StdMutex::new(release_rx);
    let fixture = Fixture::new(store, LONG, move |call, answers| {
        release_rx.lock().unwrap().recv().unwrap();
        all_ok(call, answers)
    });
    fixture.answer(session.session_id, "I work in there");
    fixture.answer(session.session_id, "He go home");

    let summary = fixture.store.finish(session.session_id).unwrap();
    fixture.queue.flush(session.session_id);
    assert_eq!(
        summary.pending_coaching, 2,
        "both answers are still unchecked"
    );
    assert!(summary.phrases.is_empty());

    release_tx.send(()).unwrap();
    assert_eq!(fixture.next_batch(), [1, 2]);
    assert_eq!(fixture.next_event().session_id, session.session_id);

    let later = fixture.store.session_wrapup(session.session_id).unwrap();
    assert_eq!(later.pending_coaching, 0);
    assert_eq!(later.phrases.len(), 3, "two focus points and a rewrite");
    assert_eq!(later.turn_count, 2);
    assert!(fixture.store.dialogue(session.session_id).is_err());
}

#[test]
fn a_quiet_learner_gets_the_waiting_answers_checked() {
    let store = SessionStore::default();
    let session = store.start().unwrap();
    let fixture = Fixture::new(store, Duration::from_millis(400), all_ok);

    fixture.answer(session.session_id, "First answer");
    fixture.assert_no_batch_within(Duration::from_millis(150));
    fixture.answer(session.session_id, "Second answer");
    // The clock restarts with every answer, so both are checked together after the pause.
    let started = Instant::now();
    assert_eq!(fixture.next_batch(), [1, 2]);
    assert!(started.elapsed() >= Duration::from_millis(300));
}

#[test]
fn an_empty_or_failed_batch_is_retried_once_then_the_answer_shows_it_could_not_be_checked() {
    let store = SessionStore::default();
    let session = store.start().unwrap();
    let fixture = Fixture::new(store, LONG, |call, answers| match call {
        1 => Ok(Vec::new()),
        2 => Err(ProviderError::new(ProviderErrorCode::Timeout, "slow")),
        _ => all_ok(call, answers),
    });
    fixture.answer(session.session_id, "I work in there");
    fixture.queue.flush(session.session_id);

    assert_eq!(fixture.next_batch(), [1], "first try came back empty");
    assert_eq!(fixture.next_batch(), [1], "retried once, right away");
    fixture.assert_no_batch_within(Duration::from_millis(300));
    assert_eq!(fixture.coaching(session.session_id), [TurnCoaching::Failed]);

    // The manual Retry gives the answer its tries back.
    fixture.queue.retry(session.session_id, 1).unwrap();
    assert_eq!(fixture.next_batch(), [1]);
    fixture.next_event();
    fixture.next_event();
    fixture.next_event();
    assert!(is_ready(&fixture.coaching(session.session_id)[0]));
}

#[test]
fn an_answer_missing_from_a_batch_is_retried_alone() {
    let store = SessionStore::default();
    let session = store.start().unwrap();
    let fixture = Fixture::new(store, LONG, |call, answers| {
        if call == 1 {
            return Ok(answers.iter().take(1).map(feedback_for).collect());
        }
        all_ok(call, answers)
    });
    fixture.answer(session.session_id, "I work in there");
    fixture.answer(session.session_id, "He go home");
    fixture.queue.flush(session.session_id);
    assert_eq!(fixture.next_batch(), [1, 2]);
    assert_eq!(fixture.next_batch(), [2]);
    fixture.next_event();
    fixture.next_event();
    assert!(fixture.coaching(session.session_id).iter().all(is_ready));
}

#[test]
fn an_exhausted_quota_pauses_coaching_without_blocking_talk_or_spending_attempts() {
    let store = SessionStore::default();
    let session = store.start().unwrap();
    let fixture = Fixture::new(store, LONG, |call, answers| {
        if call == 1 {
            return Err(ProviderError::new(
                ProviderErrorCode::RateLimited,
                "RESOURCE_EXHAUSTED",
            ));
        }
        all_ok(call, answers)
    });
    for n in 1..=5 {
        fixture.answer(session.session_id, &format!("Answer {n}"));
    }
    assert_eq!(fixture.next_batch(), [1, 2, 3, 4, 5]);
    fixture.next_event();
    assert!(fixture.store.is_coaching_paused());
    assert!(fixture
        .coaching(session.session_id)
        .iter()
        .all(|state| *state == TurnCoaching::Paused));

    // Talking goes on; paused coaching does not run another batch.
    fixture.answer(session.session_id, "Answer 6");
    fixture.queue.flush(session.session_id);
    fixture.assert_no_batch_within(Duration::from_millis(300));
    assert_eq!(fixture.store.get_active().unwrap().unwrap().turn_count, 6);

    // Asking again resumes it, and no attempt had been spent.
    fixture.queue.retry(session.session_id, 1).unwrap();
    assert!(!fixture.store.is_coaching_paused());
    assert_eq!(fixture.next_batch(), [1, 2, 3, 4, 5]);
    assert_eq!(fixture.batches.lock().unwrap().len(), 2);
}

#[test]
fn a_quota_pause_ends_on_its_own_with_one_probe_that_pauses_again_while_still_limited() {
    let store = SessionStore::default();
    let session = store.start().unwrap();
    let fixture = Fixture::with_pause(store, LONG, Duration::from_millis(400), |call, answers| {
        if call <= 2 {
            return Err(ProviderError::new(ProviderErrorCode::RateLimited, "429"));
        }
        all_ok(call, answers)
    });
    fixture.answer(session.session_id, "I work in there");
    fixture.queue.flush(session.session_id);
    assert_eq!(fixture.next_batch(), [1]);
    assert!(fixture.store.is_coaching_paused());
    // Nothing runs during the pause.
    fixture.assert_no_batch_within(Duration::from_millis(200));

    // The first probe is still limited: one batch only, then the pause starts over.
    let paused_at = Instant::now();
    assert_eq!(fixture.next_batch(), [1]);
    assert!(paused_at.elapsed() >= Duration::from_millis(100));
    fixture.assert_no_batch_within(Duration::from_millis(200));
    assert_eq!(fixture.batches.lock().unwrap().len(), 2);

    // The second probe succeeds and coaching is back without any manual retry.
    assert_eq!(fixture.next_batch(), [1]);
    fixture.next_event();
    fixture.next_event();
    fixture.next_event();
    assert!(!fixture.store.is_coaching_paused());
    assert!(is_ready(&fixture.coaching(session.session_id)[0]));
}

#[test]
fn the_wrap_up_of_a_paused_session_says_so_instead_of_waiting() {
    let store = SessionStore::default();
    let session = store.start().unwrap();
    let fixture = Fixture::new(store, LONG, |_, _| {
        Err(ProviderError::new(ProviderErrorCode::RateLimited, "429"))
    });
    fixture.answer(session.session_id, "I work in there");
    fixture.queue.flush(session.session_id);
    fixture.next_batch();
    fixture.next_event();
    let summary = fixture.store.finish(session.session_id).unwrap();
    assert!(summary.is_coaching_paused);
    assert_eq!(summary.pending_coaching, 0);
}

#[test]
fn a_restart_resumes_the_queue_from_the_database() {
    let path = std::env::temp_dir().join(format!(
        "english-trainer-queue-{}.sqlite3",
        std::process::id()
    ));
    let store = SessionStore::open(&path).unwrap();
    let session = store.start().unwrap();
    say(&store, session.session_id, "I work in there");
    say(&store, session.session_id, "He go home");
    drop(store);

    let reopened = SessionStore::open(&path).unwrap();
    let fixture = Fixture::new(reopened, Duration::from_millis(100), all_ok);
    assert_eq!(fixture.next_batch(), [1, 2]);
    fixture.next_event();
    assert!(fixture.coaching(session.session_id).iter().all(is_ready));
    drop(fixture);
    std::fs::remove_file(path).unwrap();
}

#[test]
fn the_question_each_answer_responded_to_travels_with_it() {
    let store = SessionStore::default();
    let session = store.start().unwrap();
    let questions = Arc::new(StdMutex::new(Vec::new()));
    let seen = questions.clone();
    let fixture = Fixture::new(store, LONG, move |call, answers| {
        seen.lock()
            .unwrap()
            .extend(answers.iter().map(|answer| answer.question.clone()));
        all_ok(call, answers)
    });
    fixture.answer(session.session_id, "First");
    fixture.answer(session.session_id, "Second");
    fixture.queue.flush(session.session_id);
    fixture.next_batch();
    assert_eq!(
        *questions.lock().unwrap(),
        [session.opening_question.as_str(), "And then?"]
    );
}

#[test]
fn coached_conversation_mistakes_become_memory_become_due_and_come_back_in_later_sessions() {
    let path = std::env::temp_dir().join(format!(
        "english-trainer-loop-{}.sqlite3",
        std::process::id()
    ));
    let store = SessionStore::open(&path).unwrap();
    let first = store.start().unwrap();
    let fixture = Fixture::new(store, LONG, |call, answers| {
        Ok(answers
            .iter()
            .map(|answer| {
                let mut coached = feedback_for(answer);
                coached.feedback.focus_feedback[0].original = "I work in there".into();
                coached.feedback.focus_feedback[0].improved = "I work there".into();
                let _ = call;
                coached
            })
            .collect())
    });
    fixture.answer(first.session_id, "I work in there");
    fixture.store.finish(first.session_id).unwrap();
    fixture.queue.flush(first.session_id);
    fixture.next_batch();
    fixture.next_event();

    // 1. The mistake is in Memory, observed once.
    let memory = fixture.store.get_learning_memory().unwrap();
    assert_eq!(memory.mistakes.len(), 1);
    assert_eq!(memory.mistakes[0].corrected_example, "I work there");
    assert_eq!(memory.mistakes[0].times_seen, 1);
    drop(fixture);

    // 2. It becomes due (here: a day later).
    let db = rusqlite::Connection::open(&path).unwrap();
    db.execute("UPDATE mistakes SET next_review_at = 0", [])
        .unwrap();
    drop(db);

    // 3. It is offered as a woven target in a later conversation, and in the spoken review.
    let later = SessionStore::open(&path).unwrap();
    let second = later.start().unwrap();
    later
        .send_turn(second.session_id, "Hello again".into(), |_| Ok(eva("Hi.")))
        .unwrap();
    later
        .send_turn(second.session_id, "Second answer".into(), |context| {
            assert_eq!(context.learning_targets.len(), 1);
            assert_eq!(context.learning_targets[0].kind, "mistake");
            assert_eq!(context.learning_targets[0].target, "I work there");
            Ok(eva("Thanks."))
        })
        .unwrap();
    let review = later.start_memory_review().unwrap().expect("a due review");
    assert_eq!(review.items.len(), 1);
    assert_eq!(
        review.items[0].item_type,
        crate::learning::LearningItemType::Mistake
    );
    std::fs::remove_file(path).unwrap();
}

#[test]
fn timing_rule_batches_at_five_on_flush_on_a_retry_and_after_the_quiet_period() {
    let now = Instant::now();
    let fresh = SessionTiming {
        last_answer_at: now,
        is_flushing: false,
    };
    let idle = Duration::from_secs(60);
    assert_eq!(
        due(
            0,
            false,
            SessionTiming {
                is_flushing: true,
                ..fresh
            },
            idle,
            now
        ),
        Due::Never
    );
    assert_eq!(due(4, false, fresh, idle, now), Due::At(now + idle));
    assert_eq!(due(5, false, fresh, idle, now), Due::Now);
    assert_eq!(
        due(
            1,
            false,
            SessionTiming {
                is_flushing: true,
                ..fresh
            },
            idle,
            now
        ),
        Due::Now
    );
    assert_eq!(due(1, true, fresh, idle, now), Due::Now);
    assert_eq!(due(2, false, fresh, idle, now + idle), Due::Now);
}
