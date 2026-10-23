use crate::providers::ProviderError;
use serde::Serialize;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, ts_rs::TS)]
#[ts(export)]
pub struct WrapupPhrase {
    pub sequence: usize,
    pub phrase: String,
    pub note: String,
    pub you_said: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, ts_rs::TS)]
#[ts(export)]
pub struct RecurringMistake {
    pub original: String,
    pub improved: String,
    pub explanation: String,
    pub times: usize,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, ts_rs::TS)]
#[serde(tag = "state", rename_all = "snake_case")]
#[ts(export)]
pub enum WrapupPreparation {
    Legacy,
    Pending,
    Ready,
    Failed { error: ProviderError },
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct SavedWrapupPhrases {
    pub cards: Vec<crate::learning::PhraseCardRecord>,
    pub created_ids: Vec<u64>,
}
