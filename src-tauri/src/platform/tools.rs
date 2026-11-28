use std::{
    ffi::OsString,
    path::{Path, PathBuf},
};

#[cfg(target_os = "macos")]
pub const WHISPER_SERVER_INSTALL_HINT: &str =
    "Install whisper.cpp with Homebrew to keep it loaded.";
#[cfg(not(target_os = "macos"))]
pub const WHISPER_SERVER_INSTALL_HINT: &str =
    "Install a whisper.cpp build that includes whisper-server and add it to PATH to keep it loaded.";

pub fn home_dir() -> Option<PathBuf> {
    std::env::var_os("HOME")
        .or_else(|| std::env::var_os("USERPROFILE"))
        .map(PathBuf::from)
}

#[cfg(not(windows))]
fn executable_names(stem: &str) -> Vec<String> {
    vec![stem.to_owned()]
}

#[cfg(windows)]
fn executable_names(stem: &str) -> Vec<String> {
    vec![format!("{stem}.exe"), format!("{stem}.cmd")]
}

#[cfg(not(windows))]
pub fn user_install_dirs(home: &Path) -> Vec<PathBuf> {
    vec![home.join(".local").join("bin")]
}

#[cfg(windows)]
pub fn user_install_dirs(home: &Path) -> Vec<PathBuf> {
    let mut directories = vec![home.join(".local").join("bin")];
    if let Some(app_data) = std::env::var_os("APPDATA") {
        directories.push(PathBuf::from(app_data).join("npm"));
    }
    directories
}

#[cfg(unix)]
pub fn system_install_dirs() -> Vec<PathBuf> {
    vec![
        PathBuf::from("/opt/homebrew/bin"),
        PathBuf::from("/usr/local/bin"),
    ]
}

#[cfg(not(unix))]
pub fn system_install_dirs() -> Vec<PathBuf> {
    Vec::new()
}

pub fn find_tool(
    stem: &str,
    path: Option<OsString>,
    fallback_dirs: impl IntoIterator<Item = PathBuf>,
) -> Option<PathBuf> {
    let names = executable_names(stem);
    let in_directory = |directory: &Path| {
        names
            .iter()
            .map(|name| directory.join(name))
            .find(|candidate| candidate.is_file())
    };
    path.and_then(|paths| {
        std::env::split_paths(&paths).find_map(|directory| in_directory(&directory))
    })
    .or_else(|| {
        fallback_dirs
            .into_iter()
            .find_map(|directory| in_directory(&directory))
    })
}
