use serde::Serialize;
use ts_rs::TS;

#[derive(Debug, Clone, Serialize, TS)]
#[ts(export)]
pub struct SetupDiagnostics {
    pub whisper_cli: ComponentCheck,
    pub whisper_model: ComponentCheck,
    pub whisper_server: ComponentCheck,
    pub agy_cli: ComponentCheck,
    pub database_path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub agy_default_model: Option<String>,
}

#[derive(Debug, Clone, Serialize, TS)]
#[ts(export)]
pub struct ComponentCheck {
    pub status: ComponentStatus,
    pub path: Option<String>,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, TS)]
#[serde(rename_all = "snake_case")]
#[ts(export)]
pub enum ComponentStatus {
    Available,
    Missing,
    Unreadable,
}
