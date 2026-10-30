pub trait LogStore: Send + Sync {
    fn append(&self, line: &str) -> std::io::Result<()>;
}
