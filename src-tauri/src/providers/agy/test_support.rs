//! A fake `agy` executable for tests: a shell script that records its arguments and prints a
//! canned reply, so the real command line and parsing run without calling Antigravity.

use std::{
    fs,
    path::{Path, PathBuf},
    sync::atomic::{AtomicU64, Ordering},
};

static SEQUENCE: AtomicU64 = AtomicU64::new(0);

pub(super) struct TestDirectory(PathBuf);

impl TestDirectory {
    pub(super) fn new() -> Self {
        let id = SEQUENCE.fetch_add(1, Ordering::Relaxed);
        let path =
            std::env::temp_dir().join(format!("eng-trainer-agy-fake-{}-{id}", std::process::id()));
        fs::create_dir(&path).expect("create test directory");
        Self(path)
    }

    pub(super) fn path(&self) -> &Path {
        &self.0
    }
}

impl Drop for TestDirectory {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.0);
    }
}

/// A fake CLI that appends each call to `calls.log` in the test directory, then runs `body`.
/// Arguments end with the ASCII unit separator and a call with the record separator, because a
/// prompt argument contains newlines.
#[cfg(unix)]
pub(super) fn recording_cli(dir: &TestDirectory, body: &str) -> PathBuf {
    use std::os::unix::fs::PermissionsExt;
    let log = dir.path().join("calls.log");
    let script = format!(
        "#!/bin/sh\nfor argument in \"$@\"; do printf '%s\\037' \"$argument\" >> '{}'; done\nprintf '\\036' >> '{}'\n{body}\n",
        log.display(),
        log.display()
    );
    let path = dir.path().join("fake-agy");
    fs::write(&path, script).expect("write fake CLI");
    fs::set_permissions(&path, fs::Permissions::from_mode(0o700))
        .expect("make fake CLI executable");
    path
}

/// The recorded calls, each as its list of arguments.
pub(super) fn recorded_calls(dir: &TestDirectory) -> Vec<Vec<String>> {
    fs::read_to_string(dir.path().join("calls.log"))
        .unwrap_or_default()
        .split('\u{1e}')
        .filter(|call| !call.is_empty())
        .map(|call| {
            call.trim_end_matches('\u{1f}')
                .split('\u{1f}')
                .map(str::to_string)
                .collect()
        })
        .collect()
}
