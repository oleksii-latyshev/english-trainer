//! Raw answers the learner chose to keep ("Keep raw audio" in Settings > Privacy). Off by default;
//! when on, each answer's WAV lives in `<app data>/recordings/<session>/<sequence>.wav`.
use super::private_files;
use serde::Serialize;
use std::{
    fs, io,
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
pub struct KeptRecordings {
    pub count: u64,
    pub size_bytes: u64,
}

pub fn recordings_dir(app_data: &Path) -> PathBuf {
    app_data.join("recordings")
}

/// Where an answer goes: the session and the sequence its turn will get. Outside a practice
/// session (a memory review) the file is named by time in a folder of its own.
fn path_for(app_data: &Path, slot: Option<(u64, usize)>) -> PathBuf {
    let root = recordings_dir(app_data);
    match slot {
        Some((session, sequence)) => root
            .join(session.to_string())
            .join(format!("{sequence}.wav")),
        None => {
            let stamp = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_millis();
            root.join("review").join(format!("{stamp}.wav"))
        }
    }
}

/// A second recording of the same answer replaces the first.
pub fn keep(app_data: &Path, slot: Option<(u64, usize)>, wav: &[u8]) -> io::Result<PathBuf> {
    let path = path_for(app_data, slot);
    if let Some(parent) = path.parent() {
        private_files::create_dir_all(parent)?;
    }
    private_files::write(&path, wav)?;
    Ok(path)
}

pub fn summary(app_data: &Path) -> io::Result<KeptRecordings> {
    let mut kept = KeptRecordings {
        count: 0,
        size_bytes: 0,
    };
    let folders = match fs::read_dir(recordings_dir(app_data)) {
        Ok(folders) => folders,
        Err(error) if error.kind() == io::ErrorKind::NotFound => return Ok(kept),
        Err(error) => return Err(error),
    };
    for folder in folders {
        let folder = folder?.path();
        if !folder.is_dir() {
            continue;
        }
        for file in fs::read_dir(folder)? {
            let metadata = file?.metadata()?;
            if metadata.is_file() {
                kept.count += 1;
                kept.size_bytes += metadata.len();
            }
        }
    }
    Ok(kept)
}

/// Removes every kept answer; the "Delete kept recordings" action.
pub fn delete_all(app_data: &Path) -> io::Result<()> {
    match fs::remove_dir_all(recordings_dir(app_data)) {
        Err(error) if error.kind() != io::ErrorKind::NotFound => Err(error),
        _ => Ok(()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn keeps_an_answer_under_its_session_and_sequence_and_replaces_a_redo() {
        let directory = crate::providers::agy::runner::ScratchDirectory::new().unwrap();
        let path = keep(directory.path(), Some((7, 3)), b"first").unwrap();
        assert_eq!(path, directory.path().join("recordings/7/3.wav"));
        keep(directory.path(), Some((7, 3)), b"second take").unwrap();
        keep(directory.path(), Some((7, 4)), b"x").unwrap();
        assert_eq!(fs::read(&path).unwrap(), b"second take");
        assert_eq!(
            summary(directory.path()).unwrap(),
            KeptRecordings {
                count: 2,
                size_bytes: 12
            }
        );
    }

    #[test]
    fn answers_outside_a_session_are_kept_in_the_review_folder() {
        let directory = crate::providers::agy::runner::ScratchDirectory::new().unwrap();
        let path = keep(directory.path(), None, b"abc").unwrap();
        assert_eq!(
            path.parent(),
            Some(directory.path().join("recordings/review").as_path())
        );
        assert_eq!(summary(directory.path()).unwrap().count, 1);
    }

    #[test]
    fn deleting_removes_everything_and_is_harmless_when_nothing_was_kept() {
        let directory = crate::providers::agy::runner::ScratchDirectory::new().unwrap();
        delete_all(directory.path()).unwrap();
        keep(directory.path(), Some((1, 1)), b"a").unwrap();
        keep(directory.path(), None, b"b").unwrap();
        delete_all(directory.path()).unwrap();
        assert_eq!(summary(directory.path()).unwrap().count, 0);
        assert!(!recordings_dir(directory.path()).exists());
    }

    #[cfg(unix)]
    #[test]
    fn kept_files_are_owner_only() {
        use std::os::unix::fs::PermissionsExt;
        let directory = crate::providers::agy::runner::ScratchDirectory::new().unwrap();
        let path = keep(directory.path(), Some((2, 1)), b"a").unwrap();
        assert_eq!(
            fs::metadata(&path).unwrap().permissions().mode() & 0o777,
            0o600
        );
        assert_eq!(
            fs::metadata(path.parent().unwrap())
                .unwrap()
                .permissions()
                .mode()
                & 0o777,
            0o700
        );
    }
}
