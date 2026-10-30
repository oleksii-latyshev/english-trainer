use crate::diagnostics::ports::LogStore;
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

pub const LOG_FILE: &str = "diagnostics.log";
pub const ROTATED_FILE: &str = "diagnostics.1.log";
pub const MAX_BYTES: u64 = 1_000_000;

pub struct FileLogStore {
    folder: PathBuf,
    max_bytes: u64,
    writing: Mutex<()>,
}

impl FileLogStore {
    pub fn in_folder(folder: &Path) -> Self {
        Self::with_limit(folder, MAX_BYTES)
    }

    fn with_limit(folder: &Path, max_bytes: u64) -> Self {
        Self {
            folder: folder.to_path_buf(),
            max_bytes,
            writing: Mutex::new(()),
        }
    }

    fn rotate_when_full(&self) -> std::io::Result<()> {
        let current = self.folder.join(LOG_FILE);
        match fs::metadata(&current) {
            Ok(metadata) if metadata.len() >= self.max_bytes => {
                fs::rename(&current, self.folder.join(ROTATED_FILE))
            }
            _ => Ok(()),
        }
    }
}

impl LogStore for FileLogStore {
    fn append(&self, line: &str) -> std::io::Result<()> {
        let _guard = self
            .writing
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner);
        fs::create_dir_all(&self.folder)?;
        self.rotate_when_full()?;
        let mut file = OpenOptions::new()
            .create(true)
            .append(true)
            .open(self.folder.join(LOG_FILE))?;
        writeln!(file, "{line}")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn scratch(name: &str) -> PathBuf {
        let folder =
            std::env::temp_dir().join(format!("english-trainer-log-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&folder);
        folder
    }

    #[test]
    fn lines_are_appended_one_per_row_and_the_folder_is_created() {
        let folder = scratch("append").join("nested");
        let store = FileLogStore::in_folder(&folder);
        store.append("first").expect("first");
        store.append("second").expect("second");
        assert_eq!(
            fs::read_to_string(folder.join(LOG_FILE)).expect("log"),
            "first\nsecond\n"
        );
    }

    #[test]
    fn a_full_log_moves_to_the_rotated_file_and_starts_fresh() {
        let folder = scratch("rotate");
        let store = FileLogStore::with_limit(&folder, 10);
        store.append("0123456789").expect("fills the log");
        store.append("after").expect("rotates");
        assert_eq!(
            fs::read_to_string(folder.join(ROTATED_FILE)).expect("rotated"),
            "0123456789\n"
        );
        assert_eq!(
            fs::read_to_string(folder.join(LOG_FILE)).expect("log"),
            "after\n"
        );
    }

    #[test]
    fn rotation_replaces_an_older_rotated_file() {
        let folder = scratch("replace");
        let store = FileLogStore::with_limit(&folder, 5);
        store.append("aaaaa").expect("a");
        store.append("bbbbb").expect("b");
        store.append("ccccc").expect("c");
        assert_eq!(
            fs::read_to_string(folder.join(ROTATED_FILE)).expect("rotated"),
            "bbbbb\n"
        );
    }

    #[test]
    fn an_unusable_folder_is_an_error_not_a_panic() {
        let blocker = scratch("blocked");
        fs::create_dir_all(&blocker).expect("folder");
        let file = blocker.join("file");
        fs::write(&file, "x").expect("file");
        let store = FileLogStore::in_folder(&file.join("inside"));
        assert!(store.append("lost").is_err());
    }
}
