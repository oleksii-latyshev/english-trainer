//! Races a primary reply stream against a backup. The Gemini free tier sometimes accepts a
//! request and then sends nothing for 10–15 s, so a missing first word, not only an error,
//! starts the backup. The first stream that produces text is shown; the other is abandoned.

use super::{AnsweredBy, ProviderError, ProviderErrorCode};
use std::{
    sync::mpsc::{self, RecvTimeoutError, Sender},
    thread,
    time::{Duration, Instant},
};

pub(super) enum Event {
    Delta(String),
    Done,
    Failed {
        error: ProviderError,
        is_retryable: bool,
    },
}

/// One reply stream. It reports events through `emit`; `emit` returns false once the race
/// no longer wants them, and the leg should then stop as soon as it can.
pub(super) type Leg = Box<dyn FnOnce(&dyn Fn(Event) -> bool) + Send>;

pub(super) struct Backup {
    pub leg: Leg,
    /// Start the backup if the primary has produced no text by then.
    pub after: Duration,
    /// Reported as the reply's origin when this leg wins.
    pub label: AnsweredBy,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Source {
    Primary,
    Backup,
}

/// Streams the first reply that produces text and returns its full text with the label of the
/// leg that wrote it.
pub(super) fn race(
    primary: (Leg, AnsweredBy),
    mut backup: Option<Backup>,
    timeout: Duration,
    on_delta: &mut dyn FnMut(&str),
) -> Result<(String, AnsweredBy), ProviderError> {
    let (primary, primary_label) = primary;
    let backup_label = backup.as_ref().map(|pending| pending.label.clone());
    let winner = |source: Source| match (source, &backup_label) {
        (Source::Backup, Some(label)) => label.clone(),
        _ => primary_label.clone(),
    };
    let (sender, events) = mpsc::channel();
    spawn(primary, Source::Primary, sender.clone());
    let started_at = Instant::now();
    let deadline = started_at + timeout;
    let mut alive = 1;
    let mut committed: Option<Source> = None;
    let mut primary_error = None;
    let mut backup_error = None;
    let mut reply = String::new();
    loop {
        let wait_until = match (&backup, committed) {
            (Some(pending), None) => (started_at + pending.after).min(deadline),
            _ => deadline,
        };
        let (source, event) =
            match events.recv_timeout(wait_until.saturating_duration_since(Instant::now())) {
                Ok(received) => received,
                Err(RecvTimeoutError::Timeout) if Instant::now() < deadline => {
                    if let Some(pending) = backup.take() {
                        alive += 1;
                        spawn(pending.leg, Source::Backup, sender.clone());
                    }
                    continue;
                }
                Err(_) => return Err(timeout_error()),
            };
        if committed.is_some_and(|chosen| chosen != source) {
            continue;
        }
        match event {
            Event::Delta(text) => {
                committed = Some(source);
                on_delta(&text);
                reply.push_str(&text);
            }
            Event::Done if committed.is_some() => return Ok((reply, winner(source))),
            Event::Failed { error, .. } if committed.is_some() => return Err(error),
            Event::Done | Event::Failed { .. } => {
                alive -= 1;
                let (error, is_retryable) = match event {
                    Event::Failed {
                        error,
                        is_retryable,
                    } => (error, is_retryable),
                    _ => (empty_reply(), true),
                };
                if source == Source::Primary {
                    if !is_retryable && backup.is_some() {
                        return Err(error);
                    }
                    primary_error = Some(error);
                    if let Some(pending) = backup.take() {
                        alive += 1;
                        spawn(pending.leg, Source::Backup, sender.clone());
                    }
                } else {
                    backup_error = Some(error);
                }
            }
        }
        if committed.is_none() && alive == 0 {
            // The primary is the provider the user chose, so its error explains the failure best.
            return Err(primary_error.or(backup_error).unwrap_or_else(empty_reply));
        }
    }
}

fn spawn(leg: Leg, source: Source, sender: Sender<(Source, Event)>) {
    thread::spawn(move || {
        // A send error means the race is over; this leg's result is no longer wanted.
        leg(&|event| sender.send((source, event)).is_ok());
    });
}

fn timeout_error() -> ProviderError {
    ProviderError::new(
        ProviderErrorCode::Timeout,
        "The AI took too long to answer. Retry, or switch provider in Settings.",
    )
}

fn empty_reply() -> ProviderError {
    ProviderError::new(
        ProviderErrorCode::InvalidOutput,
        "The AI returned an empty reply. Please retry.",
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    fn leg(delay: Duration, events: Vec<Event>) -> Leg {
        Box::new(move |emit| {
            thread::sleep(delay);
            for event in events {
                if !emit(event) {
                    return;
                }
            }
        })
    }

    fn text(value: &str) -> Event {
        Event::Delta(value.into())
    }

    fn failed(code: ProviderErrorCode, is_retryable: bool) -> Event {
        Event::Failed {
            error: ProviderError::new(code, "failed"),
            is_retryable,
        }
    }

    fn backup(after_ms: u64, delay_ms: u64, events: Vec<Event>) -> Option<Backup> {
        Some(Backup {
            leg: leg(Duration::from_millis(delay_ms), events),
            after: Duration::from_millis(after_ms),
            label: AnsweredBy::apple(true),
        })
    }

    fn run(primary: Leg, backup: Option<Backup>) -> (Result<String, ProviderError>, Vec<String>) {
        let mut deltas = Vec::new();
        let result = race_labelled(primary, backup, &mut |text| deltas.push(text.to_string()));
        (result.map(|(reply, _)| reply), deltas)
    }

    fn race_labelled(
        primary: Leg,
        backup: Option<Backup>,
        on_delta: &mut dyn FnMut(&str),
    ) -> Result<(String, AnsweredBy), ProviderError> {
        race(
            (primary, AnsweredBy::gemini()),
            backup,
            Duration::from_secs(5),
            on_delta,
        )
    }

    #[test]
    fn the_race_reports_the_label_of_the_leg_that_won() {
        let (reply, label) = race_labelled(
            leg(Duration::from_secs(3), vec![text("slow"), Event::Done]),
            backup(100, 0, vec![text("fast"), Event::Done]),
            &mut |_| {},
        )
        .unwrap();
        assert_eq!(reply, "fast");
        assert_eq!(label, AnsweredBy::apple(true));

        let (reply, label) = race_labelled(
            leg(Duration::ZERO, vec![text("first"), Event::Done]),
            backup(1_000, 0, vec![text("backup"), Event::Done]),
            &mut |_| {},
        )
        .unwrap();
        assert_eq!(reply, "first");
        assert_eq!(label, AnsweredBy::gemini());
    }

    #[test]
    fn a_stalled_primary_is_overtaken_by_the_backup() {
        let started = Instant::now();
        let (result, deltas) = run(
            leg(Duration::from_secs(3), vec![text("slow"), Event::Done]),
            backup(100, 0, vec![text("fast "), text("reply"), Event::Done]),
        );
        assert_eq!(result.unwrap(), "fast reply");
        assert_eq!(deltas, ["fast ", "reply"]);
        assert!(started.elapsed() < Duration::from_secs(2));
    }

    #[test]
    fn a_primary_that_starts_in_time_keeps_the_turn() {
        let (result, deltas) = run(
            leg(Duration::ZERO, vec![text("primary"), Event::Done]),
            backup(1_000, 0, vec![text("backup"), Event::Done]),
        );
        assert_eq!(result.unwrap(), "primary");
        assert_eq!(deltas, ["primary"]);
    }

    #[test]
    fn once_text_is_shown_the_other_stream_is_ignored() {
        let (result, deltas) = run(
            leg(
                Duration::from_millis(300),
                vec![text("late primary"), Event::Done],
            ),
            backup(
                50,
                0,
                vec![
                    text("backup "),
                    Event::Delta(String::new()),
                    text("wins"),
                    Event::Done,
                ],
            ),
        );
        assert_eq!(result.unwrap(), "backup wins");
        assert!(!deltas.iter().any(|delta| delta.contains("primary")));
    }

    #[test]
    fn a_retryable_failure_starts_the_backup_at_once() {
        let started = Instant::now();
        let (result, _) = run(
            leg(
                Duration::ZERO,
                vec![failed(ProviderErrorCode::RateLimited, true)],
            ),
            backup(10_000, 0, vec![text("backup"), Event::Done]),
        );
        assert_eq!(result.unwrap(), "backup");
        assert!(started.elapsed() < Duration::from_secs(1));
    }

    #[test]
    fn a_configuration_failure_is_reported_without_a_backup_reply() {
        let (result, _) = run(
            leg(
                Duration::ZERO,
                vec![failed(ProviderErrorCode::Unauthorized, false)],
            ),
            backup(10_000, 0, vec![text("backup"), Event::Done]),
        );
        assert_eq!(result.unwrap_err().code, ProviderErrorCode::Unauthorized);
    }

    #[test]
    fn when_both_fail_the_primary_error_is_reported() {
        let (result, _) = run(
            leg(
                Duration::ZERO,
                vec![failed(ProviderErrorCode::RateLimited, true)],
            ),
            backup(
                10_000,
                0,
                vec![failed(ProviderErrorCode::Unavailable, false)],
            ),
        );
        assert_eq!(result.unwrap_err().code, ProviderErrorCode::RateLimited);
    }

    #[test]
    fn without_a_backup_failures_and_empty_replies_surface() {
        let (result, _) = run(
            leg(
                Duration::ZERO,
                vec![failed(ProviderErrorCode::RateLimited, true)],
            ),
            None,
        );
        assert_eq!(result.unwrap_err().code, ProviderErrorCode::RateLimited);
        let (result, _) = run(leg(Duration::ZERO, vec![Event::Done]), None);
        assert_eq!(result.unwrap_err().code, ProviderErrorCode::InvalidOutput);
    }

    #[test]
    fn a_silent_race_times_out() {
        let mut on_delta = |_: &str| {};
        let result = race(
            (leg(Duration::from_secs(2), vec![]), AnsweredBy::gemini()),
            None,
            Duration::from_millis(100),
            &mut on_delta,
        );
        assert_eq!(result.unwrap_err().code, ProviderErrorCode::Timeout);
    }
}
