use super::error::GeminiKeyError;

pub trait KeyStore: Send + Sync {
    fn exists(&self) -> Result<bool, GeminiKeyError>;
    fn read(&self) -> Result<Option<String>, GeminiKeyError>;
    fn write(&self, key: &str) -> Result<(), GeminiKeyError>;
    fn remove(&self) -> Result<(), GeminiKeyError>;
}
