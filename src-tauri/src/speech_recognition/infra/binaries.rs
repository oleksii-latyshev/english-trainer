use std::{
    fs,
    path::{Path, PathBuf},
};

pub fn resolve_whisper_binary() -> Option<PathBuf> {
    resolve_binary_from(
        "whisper-cli",
        std::env::var_os("ENG_TRAINER_WHISPER_BIN"),
        std::env::var_os("PATH"),
    )
}

pub fn resolve_server_binary() -> Option<PathBuf> {
    resolve_binary_from(
        "whisper-server",
        std::env::var_os("ENG_TRAINER_WHISPER_SERVER_BIN"),
        std::env::var_os("PATH"),
    )
}

fn resolve_binary_from(
    name: &str,
    configured: Option<std::ffi::OsString>,
    path: Option<std::ffi::OsString>,
) -> Option<PathBuf> {
    if let Some(configured) = configured {
        return Some(PathBuf::from(configured));
    }
    let path_match = path.and_then(|directories| {
        std::env::split_paths(&directories)
            .map(|directory| directory.join(name))
            .find(|candidate| is_executable(candidate))
    });
    path_match.or_else(|| {
        [
            PathBuf::from("/opt/homebrew/bin").join(name),
            PathBuf::from("/usr/local/bin").join(name),
        ]
        .into_iter()
        .find(|candidate| is_executable(candidate))
    })
}

fn is_executable(path: &Path) -> bool {
    let Ok(metadata) = fs::metadata(path) else {
        return false;
    };
    if !metadata.is_file() || fs::File::open(path).is_err() {
        return false;
    }
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        metadata.permissions().mode() & 0o111 != 0
    }
    #[cfg(not(unix))]
    {
        true
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn whisper_resolver_honors_explicit_path_without_fallback() {
        let configured = std::ffi::OsString::from("/configured/whisper-cli");
        let path = std::ffi::OsString::from("/unused");
        assert_eq!(
            resolve_binary_from("whisper-cli", Some(configured), Some(path)),
            Some(PathBuf::from("/configured/whisper-cli"))
        );
    }

    #[test]
    fn whisper_resolver_finds_executable_from_injected_path() {
        use std::{
            fs,
            sync::atomic::{AtomicU64, Ordering},
            time::{SystemTime, UNIX_EPOCH},
        };
        static NEXT: AtomicU64 = AtomicU64::new(0);

        let stamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos();
        let directory = std::env::temp_dir().join(format!(
            "whisper-resolver-{}-{stamp}-{}",
            std::process::id(),
            NEXT.fetch_add(1, Ordering::Relaxed)
        ));
        fs::create_dir(&directory).unwrap();
        let binary = directory.join("whisper-cli");
        fs::write(&binary, b"#!/bin/sh\n").unwrap();
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            fs::set_permissions(&binary, fs::Permissions::from_mode(0o700)).unwrap();
        }
        let search_path = std::env::join_paths([&directory]).unwrap();
        assert_eq!(
            resolve_binary_from("whisper-cli", None, Some(search_path)),
            Some(binary)
        );
        let _ = fs::remove_dir_all(directory);
    }
}
