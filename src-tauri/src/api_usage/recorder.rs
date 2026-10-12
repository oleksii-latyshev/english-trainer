use super::{
    domain::{limit_event, UsageEvent, UsageSource},
    error::ApiUsageError,
    service::{now_ms, ApiUsageService},
};
use std::sync::{
    mpsc::{channel, Sender},
    OnceLock,
};

static SINK: OnceLock<Sender<UsageEvent>> = OnceLock::new();

pub fn start_recording(service: ApiUsageService) {
    let (sender, receiver) = channel();
    install(sender);
    std::thread::spawn(move || {
        for event in receiver {
            ignore_unsaved_count(service.record(&event));
        }
    });
}

fn install(sender: Sender<UsageEvent>) {
    ignore_repeated_install(SINK.set(sender));
}

fn ignore_repeated_install(result: Result<(), Sender<UsageEvent>>) {
    let _ = result;
}

fn ignore_unsaved_count(result: Result<(), ApiUsageError>) {
    let _ = result;
}

fn ignore_closed_receiver(result: Result<(), std::sync::mpsc::SendError<UsageEvent>>) {
    let _ = result;
}

pub fn record(event: UsageEvent) {
    if let Some(sink) = SINK.get() {
        ignore_closed_receiver(sink.send(event));
    }
}

pub fn record_request(source: UsageSource, model: &str) {
    record(UsageEvent::Request {
        source,
        model: model.to_string(),
        at_ms: now_ms(),
    });
}

pub fn record_limit(source: UsageSource, model: &str, message: String, resets_in: Option<u64>) {
    record(limit_event(source, model, message, resets_in, now_ms()));
}
