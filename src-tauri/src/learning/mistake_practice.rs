#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct MistakePracticeCandidate {
    pub id: u64,
    pub original: String,
    pub corrected: String,
    pub explanation: String,
    pub times_seen: usize,
    pub last_seen_at: i64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct MistakePracticeQuestion {
    pub mistake_id: u64,
    pub original: String,
    pub corrected: String,
    pub question: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct GeneratedMistakeQuestion {
    pub mistake_id: u64,
    pub question: String,
}
