//! Gemini API key storage. The key is pasted in Settings and kept in an owner-only file in the
//! app data folder, encrypted with a key derived from this computer's hardware ID. That keeps the
//! key unreadable in backups, synced folders or a copied app folder; it does not protect against
//! software already running as the user. The key is never returned to the UI.

use super::super::{ProviderError, ProviderErrorCode};
use chacha20poly1305::{
    aead::{Aead, KeyInit, Payload},
    ChaCha20Poly1305, Key, Nonce,
};
use serde::Serialize;
use sha2::{Digest, Sha256};
use std::{
    fs,
    io::Write,
    path::{Path, PathBuf},
    sync::{Mutex, OnceLock},
};

const FILE_NAME: &str = "gemini-api-key.enc";
const ENV_OVERRIDE: &str = "ENG_TRAINER_GEMINI_API_KEY";
const FORMAT_VERSION: u8 = 1;
const NONCE_LEN: usize = 12;
const CONTEXT: &[u8] = b"english-trainer/gemini-api-key/v1";

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum KeySource {
    Settings,
    Environment,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct GeminiKeyStatus {
    pub configured: bool,
    pub source: Option<KeySource>,
}

static KEY_FILE: OnceLock<PathBuf> = OnceLock::new();
static CACHED_KEY: Mutex<Option<String>> = Mutex::new(None);

/// Sets the folder that holds the encrypted key file; called once at app start.
pub fn configure_key_store(app_data: &Path) {
    let _ = KEY_FILE.set(app_data.join(FILE_NAME));
}

fn cache() -> std::sync::MutexGuard<'static, Option<String>> {
    CACHED_KEY
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
}

/// Drops the in-memory copy, e.g. after Gemini rejected it.
pub(super) fn forget_cached_key() {
    *cache() = None;
}

fn key_file() -> Result<&'static Path, ProviderError> {
    KEY_FILE
        .get()
        .map(PathBuf::as_path)
        .ok_or_else(storage_error)
}

fn storage_error() -> ProviderError {
    ProviderError::new(
        ProviderErrorCode::Unavailable,
        "Could not access the saved Gemini API key. Paste it again in Settings.",
    )
}

fn unreadable_key_error() -> ProviderError {
    ProviderError::new(
        ProviderErrorCode::Unauthorized,
        "The saved Gemini API key cannot be read on this computer. Paste it again in Settings.",
    )
}

fn missing_key_error() -> ProviderError {
    ProviderError::new(
        ProviderErrorCode::Unauthorized,
        "No Gemini API key is set. Add one in Settings, or choose another provider.",
    )
}

fn env_key() -> Option<String> {
    std::env::var(ENV_OVERRIDE)
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
}

pub(super) fn resolve_key() -> Result<String, ProviderError> {
    if let Some(key) = env_key() {
        return Ok(key);
    }
    if let Some(key) = cache().clone() {
        return Ok(key);
    }
    let key = read_key(key_file()?, &device_secret()?)?.ok_or_else(missing_key_error)?;
    *cache() = Some(key.clone());
    Ok(key)
}

pub fn key_status() -> Result<GeminiKeyStatus, ProviderError> {
    if env_key().is_some() {
        return Ok(GeminiKeyStatus {
            configured: true,
            source: Some(KeySource::Environment),
        });
    }
    let configured = key_file()?.is_file();
    Ok(GeminiKeyStatus {
        configured,
        source: configured.then_some(KeySource::Settings),
    })
}

pub fn save_api_key(key: &str) -> Result<(), ProviderError> {
    let key = validate_key(key)?;
    write_key(key_file()?, &device_secret()?, key)?;
    *cache() = Some(key.to_string());
    Ok(())
}

pub fn delete_api_key() -> Result<(), ProviderError> {
    forget_cached_key();
    match fs::remove_file(key_file()?) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(_) => Err(storage_error()),
    }
}

/// A 32-byte secret tied to this computer, so a copied key file does not decrypt elsewhere.
fn device_secret() -> Result<[u8; 32], ProviderError> {
    let machine_id = machine_uid::get().map_err(|_| storage_error())?;
    let mut hasher = Sha256::new();
    hasher.update(CONTEXT);
    hasher.update(machine_id.trim().as_bytes());
    Ok(hasher.finalize().into())
}

fn cipher(secret: &[u8; 32]) -> ChaCha20Poly1305 {
    ChaCha20Poly1305::new(Key::from_slice(secret))
}

fn read_key(path: &Path, secret: &[u8; 32]) -> Result<Option<String>, ProviderError> {
    let bytes = match fs::read(path) {
        Ok(bytes) => bytes,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(_) => return Err(storage_error()),
    };
    let Some((&FORMAT_VERSION, rest)) = bytes.split_first() else {
        return Err(unreadable_key_error());
    };
    if rest.len() <= NONCE_LEN {
        return Err(unreadable_key_error());
    }
    let (nonce, sealed) = rest.split_at(NONCE_LEN);
    let plain = cipher(secret)
        .decrypt(
            Nonce::from_slice(nonce),
            Payload {
                msg: sealed,
                aad: CONTEXT,
            },
        )
        .map_err(|_| unreadable_key_error())?;
    String::from_utf8(plain)
        .map(Some)
        .map_err(|_| unreadable_key_error())
}

fn write_key(path: &Path, secret: &[u8; 32], key: &str) -> Result<(), ProviderError> {
    let mut nonce = [0u8; NONCE_LEN];
    getrandom::fill(&mut nonce).map_err(|_| storage_error())?;
    let sealed = cipher(secret)
        .encrypt(
            Nonce::from_slice(&nonce),
            Payload {
                msg: key.as_bytes(),
                aad: CONTEXT,
            },
        )
        .map_err(|_| storage_error())?;
    let mut contents = Vec::with_capacity(1 + NONCE_LEN + sealed.len());
    contents.push(FORMAT_VERSION);
    contents.extend_from_slice(&nonce);
    contents.extend_from_slice(&sealed);

    // Write next to the target and rename, so a crash never leaves a half-written key file.
    let temporary = path.with_extension("tmp");
    let written = owner_only_file(&temporary)
        .and_then(|mut file| file.write_all(&contents).and_then(|()| file.sync_all()))
        .and_then(|()| fs::rename(&temporary, path));
    if written.is_err() {
        let _ = fs::remove_file(&temporary);
        return Err(storage_error());
    }
    Ok(())
}

fn owner_only_file(path: &Path) -> std::io::Result<fs::File> {
    let mut options = fs::OpenOptions::new();
    options.write(true).create(true).truncate(true);
    #[cfg(unix)]
    std::os::unix::fs::OpenOptionsExt::mode(&mut options, 0o600);
    options.open(path)
}

fn validate_key(key: &str) -> Result<&str, ProviderError> {
    let key = key.trim();
    let is_plausible = (20..=256).contains(&key.len())
        && key.chars().all(|character| character.is_ascii_graphic());
    if is_plausible {
        Ok(key)
    } else {
        Err(ProviderError::new(
            ProviderErrorCode::InvalidRequest,
            "That does not look like a Gemini API key. Copy it again from Google AI Studio.",
        ))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const KEY: &str = "AIzaSyExampleExampleExample1";

    fn temp_key_file(name: &str) -> PathBuf {
        let dir =
            std::env::temp_dir().join(format!("english-trainer-key-{name}-{}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        dir.join(FILE_NAME)
    }

    #[test]
    fn keys_are_trimmed_and_sanity_checked() {
        assert_eq!(validate_key(&format!("  {KEY}  ")).unwrap(), KEY);
        for bad in [
            "",
            "short",
            "has space inside the key value 123",
            "ключ-ключ-ключ-ключ-ключ",
        ] {
            assert_eq!(
                validate_key(bad).unwrap_err().code,
                ProviderErrorCode::InvalidRequest
            );
        }
    }

    #[test]
    fn saved_key_round_trips_and_is_not_stored_in_plain_text() {
        let path = temp_key_file("round-trip");
        let secret = [7u8; 32];
        write_key(&path, &secret, KEY).unwrap();
        let bytes = fs::read(&path).unwrap();
        assert!(!bytes
            .windows(KEY.len())
            .any(|window| window == KEY.as_bytes()));
        assert_eq!(read_key(&path, &secret).unwrap().as_deref(), Some(KEY));
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            assert_eq!(
                fs::metadata(&path).unwrap().permissions().mode() & 0o777,
                0o600
            );
        }
        fs::remove_dir_all(path.parent().unwrap()).unwrap();
    }

    #[test]
    fn a_file_from_another_computer_or_a_damaged_file_is_rejected() {
        let path = temp_key_file("foreign");
        write_key(&path, &[7u8; 32], KEY).unwrap();
        assert_eq!(
            read_key(&path, &[8u8; 32]).unwrap_err().code,
            ProviderErrorCode::Unauthorized
        );
        fs::write(&path, [FORMAT_VERSION, 1, 2, 3]).unwrap();
        assert_eq!(
            read_key(&path, &[7u8; 32]).unwrap_err().code,
            ProviderErrorCode::Unauthorized
        );
        fs::remove_dir_all(path.parent().unwrap()).unwrap();
    }

    #[test]
    fn a_missing_file_means_no_key() {
        let path = temp_key_file("missing");
        assert_eq!(read_key(&path, &[7u8; 32]).unwrap(), None);
        fs::remove_dir_all(path.parent().unwrap()).unwrap();
    }

    #[test]
    fn device_secret_is_stable_on_this_computer() {
        assert_eq!(device_secret().unwrap(), device_secret().unwrap());
    }

    #[test]
    fn status_serializes_without_any_key_material() {
        let stored = GeminiKeyStatus {
            configured: true,
            source: Some(KeySource::Settings),
        };
        assert_eq!(
            serde_json::to_value(stored).unwrap(),
            serde_json::json!({"configured": true, "source": "settings"})
        );
        let missing = GeminiKeyStatus {
            configured: false,
            source: None,
        };
        assert_eq!(
            serde_json::to_value(missing).unwrap(),
            serde_json::json!({"configured": false, "source": null})
        );
    }
}
