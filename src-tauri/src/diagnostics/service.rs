use super::{
    domain::{format_line, DiagnosticEvent},
    ports::LogStore,
};
use std::fmt;
use std::sync::{Arc, OnceLock};
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Clone)]
pub struct Diagnostics {
    store: Arc<dyn LogStore>,
    now_ms: fn() -> i64,
}

static INSTALLED: OnceLock<Diagnostics> = OnceLock::new();

impl Diagnostics {
    pub fn new(store: impl LogStore + 'static) -> Self {
        Self::with_clock(store, now_ms)
    }

    fn with_clock(store: impl LogStore + 'static, now_ms: fn() -> i64) -> Self {
        Self {
            store: Arc::new(store),
            now_ms,
        }
    }

    pub fn record(&self, area: &str, message: &str) {
        let line = format_line((self.now_ms)(), area, message);
        eprintln!("{line}");
        let _ = self.store.append(&line);
    }

    pub fn record_event(&self, event: &DiagnosticEvent) {
        self.record(event.area(), &event.to_string());
    }
}

pub fn install(diagnostics: Diagnostics) {
    let _ = INSTALLED.set(diagnostics);
}

pub fn log(area: &str, message: fmt::Arguments<'_>) {
    let message = message.to_string();
    match INSTALLED.get() {
        Some(diagnostics) => diagnostics.record(area, &message),
        None => eprintln!("{area} {message}"),
    }
}

fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |elapsed| {
            i64::try_from(elapsed.as_millis()).unwrap_or(i64::MAX)
        })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Mutex;

    #[derive(Default)]
    struct MemoryStore {
        lines: Mutex<Vec<String>>,
        fails: bool,
    }

    impl LogStore for Arc<MemoryStore> {
        fn append(&self, line: &str) -> std::io::Result<()> {
            if self.fails {
                return Err(std::io::Error::other("disk full"));
            }
            self.lines.lock().expect("lines").push(line.to_string());
            Ok(())
        }
    }

    #[test]
    fn a_record_is_stored_with_the_clock_time() {
        let store = Arc::new(MemoryStore::default());
        let diagnostics = Diagnostics::with_clock(store.clone(), || 0);
        diagnostics.record("voice", "hello");
        assert_eq!(
            store.lines.lock().expect("lines").as_slice(),
            ["1970-01-01T00:00:00.000Z voice hello"]
        );
    }

    #[test]
    fn a_failing_store_never_fails_the_caller() {
        let store = Arc::new(MemoryStore {
            fails: true,
            ..MemoryStore::default()
        });
        Diagnostics::with_clock(store, || 0).record("voice", "hello");
    }
}
