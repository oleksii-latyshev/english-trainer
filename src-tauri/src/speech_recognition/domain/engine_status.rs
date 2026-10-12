use serde::Serialize;
use ts_rs::TS;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, TS)]
#[serde(rename_all = "snake_case")]
#[ts(export)]
pub enum ServerState {
    Ready,
    Loading,
    NotRunning,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ServerStatus {
    pub state: ServerState,
    pub failure: Option<String>,
}

#[derive(Debug, Serialize, TS)]
#[ts(export)]
pub struct SpeechEngineStatus {
    pub server: ServerState,
    pub failure: Option<String>,
    pub is_live_transcript_available: bool,
}
