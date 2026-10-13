use super::{
    domain::SetupDiagnostics,
    infra::{check_cli, check_model, check_server, read_agy_default_model},
};
use crate::speech_recognition::ServerStatus;
use std::path::{Path, PathBuf};

pub fn collect(app_data: &Path, model: &Path, server: &ServerStatus) -> SetupDiagnostics {
    let whisper_cli = check_cli(crate::speech_recognition::resolve_whisper_binary());
    let whisper_server = check_server(crate::speech_recognition::resolve_server_binary(), server);
    let whisper_model = check_model(model);
    let agy_cli = check_cli(crate::providers::resolve_agy_binary());
    SetupDiagnostics {
        whisper_cli,
        whisper_model,
        whisper_server,
        agy_cli,
        agy_default_model: std::env::var_os("HOME")
            .map(PathBuf::from)
            .and_then(|home| {
                read_agy_default_model(&home.join(".gemini/antigravity-cli/settings.json"))
            }),
        database_path: app_data
            .join("english-trainer.sqlite3")
            .to_string_lossy()
            .into_owned(),
    }
}
