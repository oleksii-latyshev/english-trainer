use serde::Serialize;
use ts_rs::TS;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, TS)]
#[ts(export)]
pub struct KeptRecordings {
    pub count: u64,
    pub size_bytes: u64,
}
