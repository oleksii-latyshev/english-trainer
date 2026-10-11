use crate::gemini_key::{error::GeminiKeyError, ports::KeyStore};
use chacha20poly1305::{
    aead::{Aead, KeyInit, Payload},
    ChaCha20Poly1305, Key, Nonce,
};
use sha2::{Digest, Sha256};
use std::{
    fs,
    io::Write,
    path::{Path, PathBuf},
};

const FILE_NAME: &str = "gemini-api-key.enc";
const FORMAT_VERSION: u8 = 1;
const NONCE_LEN: usize = 12;
const CONTEXT: &[u8] = b"english-trainer/gemini-api-key/v1";

pub struct EncryptedFileStore {
    path: PathBuf,
}

impl EncryptedFileStore {
    pub fn in_folder(app_data: &Path) -> Self {
        Self {
            path: app_data.join(FILE_NAME),
        }
    }
}

impl KeyStore for EncryptedFileStore {
    fn exists(&self) -> Result<bool, GeminiKeyError> {
        Ok(self.path.is_file())
    }

    fn read(&self) -> Result<Option<String>, GeminiKeyError> {
        read_key(&self.path, &device_secret()?)
    }

    fn write(&self, key: &str) -> Result<(), GeminiKeyError> {
        write_key(&self.path, &device_secret()?, key)
    }

    fn remove(&self) -> Result<(), GeminiKeyError> {
        match fs::remove_file(&self.path) {
            Ok(()) => Ok(()),
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
            Err(source) => Err(GeminiKeyError::Storage {
                operation: "remove",
                source,
            }),
        }
    }
}

fn device_secret() -> Result<[u8; 32], GeminiKeyError> {
    let machine_id = machine_uid::get().map_err(|_| GeminiKeyError::DeviceSecret)?;
    let mut hasher = Sha256::new();
    hasher.update(CONTEXT);
    hasher.update(machine_id.trim().as_bytes());
    Ok(hasher.finalize().into())
}

fn cipher(secret: &[u8; 32]) -> ChaCha20Poly1305 {
    ChaCha20Poly1305::new(Key::from_slice(secret))
}

fn read_key(path: &Path, secret: &[u8; 32]) -> Result<Option<String>, GeminiKeyError> {
    let bytes = match fs::read(path) {
        Ok(bytes) => bytes,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(source) => {
            return Err(GeminiKeyError::Storage {
                operation: "read",
                source,
            })
        }
    };
    let Some((&FORMAT_VERSION, rest)) = bytes.split_first() else {
        return Err(GeminiKeyError::Unreadable);
    };
    if rest.len() <= NONCE_LEN {
        return Err(GeminiKeyError::Unreadable);
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
        .map_err(|_| GeminiKeyError::Unreadable)?;
    String::from_utf8(plain)
        .map(Some)
        .map_err(|_| GeminiKeyError::Unreadable)
}

fn write_key(path: &Path, secret: &[u8; 32], key: &str) -> Result<(), GeminiKeyError> {
    let mut nonce = [0u8; NONCE_LEN];
    getrandom::fill(&mut nonce).map_err(|_| GeminiKeyError::Encryption)?;
    let sealed = cipher(secret)
        .encrypt(
            Nonce::from_slice(&nonce),
            Payload {
                msg: key.as_bytes(),
                aad: CONTEXT,
            },
        )
        .map_err(|_| GeminiKeyError::Encryption)?;
    let mut contents = Vec::with_capacity(1 + NONCE_LEN + sealed.len());
    contents.push(FORMAT_VERSION);
    contents.extend_from_slice(&nonce);
    contents.extend_from_slice(&sealed);

    replace_atomically(path, &contents).map_err(|source| GeminiKeyError::Storage {
        operation: "write",
        source,
    })
}

fn replace_atomically(path: &Path, contents: &[u8]) -> std::io::Result<()> {
    let temporary = path.with_extension("tmp");
    let written = owner_only_file(&temporary)
        .and_then(|mut file| file.write_all(contents).and_then(|()| file.sync_all()))
        .and_then(|()| fs::rename(&temporary, path));
    if written.is_err() {
        discard_leftover_temporary_file(&temporary);
    }
    written
}

fn discard_leftover_temporary_file(temporary: &Path) {
    let _ = fs::remove_file(temporary);
}

fn owner_only_file(path: &Path) -> std::io::Result<fs::File> {
    let mut options = fs::OpenOptions::new();
    options.write(true).create(true).truncate(true);
    #[cfg(unix)]
    std::os::unix::fs::OpenOptionsExt::mode(&mut options, 0o600);
    options.open(path)
}

#[cfg(test)]
mod tests {
    use super::*;

    const KEY: &str = "AIzaSyExampleExampleExample1";

    fn a_device_secret() -> [u8; 32] {
        let mut secret = [0u8; 32];
        getrandom::fill(&mut secret).unwrap();
        secret
    }

    fn temp_key_file(name: &str) -> PathBuf {
        let dir =
            std::env::temp_dir().join(format!("english-trainer-key-{name}-{}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        dir.join(FILE_NAME)
    }

    #[test]
    fn saved_key_round_trips_and_is_not_stored_in_plain_text() {
        let path = temp_key_file("round-trip");
        let secret = a_device_secret();
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
        let this_computer = a_device_secret();
        let another_computer = a_device_secret();
        write_key(&path, &this_computer, KEY).unwrap();
        assert!(matches!(
            read_key(&path, &another_computer),
            Err(GeminiKeyError::Unreadable)
        ));
        fs::write(&path, [FORMAT_VERSION, 1, 2, 3]).unwrap();
        assert!(matches!(
            read_key(&path, &this_computer),
            Err(GeminiKeyError::Unreadable)
        ));
        fs::remove_dir_all(path.parent().unwrap()).unwrap();
    }

    #[test]
    fn a_missing_file_means_no_key() {
        let path = temp_key_file("missing");
        assert_eq!(read_key(&path, &a_device_secret()).unwrap(), None);
        fs::remove_dir_all(path.parent().unwrap()).unwrap();
    }

    #[test]
    fn device_secret_is_stable_on_this_computer() {
        assert_eq!(device_secret().unwrap(), device_secret().unwrap());
    }

    #[test]
    fn removing_a_missing_file_succeeds() {
        let path = temp_key_file("remove-missing");
        let store = EncryptedFileStore { path: path.clone() };
        assert!(store.remove().is_ok());
        assert!(!store.exists().unwrap());
        fs::remove_dir_all(path.parent().unwrap()).unwrap();
    }
}
