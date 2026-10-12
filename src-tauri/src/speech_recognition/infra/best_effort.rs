use std::io;

fn ignore_failure<T>(_: io::Result<T>) {}

pub(super) fn ignore_process_already_gone<T>(result: io::Result<T>) {
    ignore_failure(result);
}

pub(super) fn ignore_unwritable_note<T>(result: io::Result<T>) {
    ignore_failure(result);
}

pub(super) fn ignore_already_removed<T>(result: io::Result<T>) {
    ignore_failure(result);
}

pub(super) fn ignore_start_outcome_reported_by_status<T>(_: Result<T, String>) {}
