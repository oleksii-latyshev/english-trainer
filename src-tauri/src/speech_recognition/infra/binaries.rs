use crate::speech_recognition::domain::WhisperBackend;
use std::{
    ffi::OsString,
    fs,
    path::{Path, PathBuf},
};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ServerBuild {
    pub path: PathBuf,
    pub backend: Option<WhisperBackend>,
}

pub fn resolve_whisper_binary() -> Option<PathBuf> {
    resolve_builds_from(
        "whisper-cli",
        std::env::var_os("ENG_TRAINER_WHISPER_BIN"),
        &bundled_directories(),
        std::env::var_os("PATH"),
    )
    .into_iter()
    .next()
    .map(|build| build.path)
}

pub fn resolve_server_binary() -> Option<PathBuf> {
    resolve_server_builds()
        .into_iter()
        .next()
        .map(|build| build.path)
}

pub fn resolve_server_builds() -> Vec<ServerBuild> {
    resolve_builds_from(
        "whisper-server",
        std::env::var_os("ENG_TRAINER_WHISPER_SERVER_BIN"),
        &bundled_directories(),
        std::env::var_os("PATH"),
    )
}

fn bundled_directories() -> Vec<(PathBuf, WhisperBackend)> {
    if !cfg!(windows) {
        return Vec::new();
    }
    std::env::current_exe()
        .ok()
        .and_then(|exe| exe.parent().map(bundled_directories_in))
        .unwrap_or_default()
}

fn bundled_directories_in(app_directory: &Path) -> Vec<(PathBuf, WhisperBackend)> {
    let root = app_directory.join("whisper");
    vec![
        (root.join("cuda"), WhisperBackend::Cuda),
        (root.join("cpu"), WhisperBackend::Cpu),
    ]
}

fn resolve_builds_from(
    stem: &str,
    configured: Option<OsString>,
    bundled: &[(PathBuf, WhisperBackend)],
    path: Option<OsString>,
) -> Vec<ServerBuild> {
    if let Some(configured) = configured {
        return vec![ServerBuild {
            path: PathBuf::from(configured),
            backend: None,
        }];
    }
    let mut builds: Vec<ServerBuild> = bundled
        .iter()
        .filter_map(|(directory, backend)| {
            let search = std::env::join_paths([directory]).ok()?;
            let path = crate::platform::find_tool(stem, Some(search), [])?;
            is_executable(&path).then_some(ServerBuild {
                path,
                backend: Some(*backend),
            })
        })
        .collect();
    let on_path = crate::platform::find_tool(stem, path, crate::platform::system_install_dirs())
        .filter(|candidate| is_executable(candidate));
    builds.extend(on_path.map(|path| ServerBuild {
        path,
        backend: None,
    }));
    builds
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
    use std::sync::atomic::{AtomicU64, Ordering};

    fn directory() -> PathBuf {
        static NEXT: AtomicU64 = AtomicU64::new(0);
        let directory = std::env::temp_dir().join(format!(
            "whisper-resolver-{}-{}",
            std::process::id(),
            NEXT.fetch_add(1, Ordering::Relaxed)
        ));
        fs::create_dir_all(&directory).unwrap();
        directory
    }

    fn executable(directory: &Path, stem: &str) -> PathBuf {
        fs::create_dir_all(directory).unwrap();
        let binary = directory.join(if cfg!(windows) {
            format!("{stem}.exe")
        } else {
            stem.to_owned()
        });
        fs::write(&binary, b"binary").unwrap();
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            fs::set_permissions(&binary, fs::Permissions::from_mode(0o700)).unwrap();
        }
        binary
    }

    fn build(path: PathBuf, backend: Option<WhisperBackend>) -> ServerBuild {
        ServerBuild { path, backend }
    }

    #[test]
    fn explicit_path_is_used_without_fallback() {
        let builds = resolve_builds_from(
            "whisper-cli",
            Some(OsString::from("/configured/whisper-cli")),
            &[],
            Some(OsString::from("/unused")),
        );
        assert_eq!(
            builds,
            vec![build(PathBuf::from("/configured/whisper-cli"), None)]
        );
    }

    #[test]
    fn executable_on_path_is_found() {
        let directory = directory();
        let binary = executable(&directory, "whisper-cli");
        let search_path = std::env::join_paths([&directory]).unwrap();
        let builds = resolve_builds_from("whisper-cli", None, &[], Some(search_path));
        assert_eq!(builds, vec![build(binary, None)]);
        let _ = fs::remove_dir_all(directory);
    }

    #[test]
    fn bundled_builds_come_before_path_and_cuda_before_cpu() {
        let app = directory();
        let on_path = directory();
        let path_binary = executable(&on_path, "whisper-server");
        let bundled = bundled_directories_in(&app);
        let cpu = executable(&bundled[1].0, "whisper-server");
        let cuda = executable(&bundled[0].0, "whisper-server");
        let builds = resolve_builds_from(
            "whisper-server",
            None,
            &bundled,
            Some(std::env::join_paths([&on_path]).unwrap()),
        );
        assert_eq!(
            builds,
            vec![
                build(cuda, Some(WhisperBackend::Cuda)),
                build(cpu, Some(WhisperBackend::Cpu)),
                build(path_binary, None),
            ]
        );
        let _ = fs::remove_dir_all(app);
        let _ = fs::remove_dir_all(on_path);
    }

    #[test]
    fn missing_bundled_builds_are_skipped() {
        let app = directory();
        let bundled = bundled_directories_in(&app);
        let cpu = executable(&bundled[1].0, "whisper-server");
        let builds = resolve_builds_from("whisper-server", None, &bundled, None);
        assert_eq!(builds[0], build(cpu, Some(WhisperBackend::Cpu)));
        let _ = fs::remove_dir_all(app);
    }
}
