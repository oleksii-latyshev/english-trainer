use super::{
    agy::{
        conversation::{make_prompt, parse_structured_turn, validate_context},
        runner::{run_process, ScratchDirectory, TIMEOUT},
    },
    ConversationContext, ConversationTurn, ProviderError, ProviderErrorCode,
};
use std::{
    fs,
    path::Path,
    process::{Command, Stdio},
};

pub(super) fn generate_turn(
    context: &ConversationContext,
    binary: &Path,
) -> Result<ConversationTurn, ProviderError> {
    validate_context(context)?;
    if !binary.is_file() {
        return Err(ProviderError::new(ProviderErrorCode::Unavailable, "The bundled Apple conversation helper was not found. Reinstall the app or choose Antigravity."));
    }
    let workspace = ScratchDirectory::new().map_err(|_| {
        ProviderError::new(
            ProviderErrorCode::ProcessFailed,
            "Could not prepare local Apple generation.",
        )
    })?;
    let input_path = workspace.path().join("prompt.txt");
    for attempt in 0..2 {
        fs::write(&input_path, make_prompt(context, attempt == 1)).map_err(|_| {
            ProviderError::new(
                ProviderErrorCode::ProcessFailed,
                "Could not prepare the Apple conversation prompt.",
            )
        })?;
        let input = fs::File::open(&input_path).map_err(|_| {
            ProviderError::new(
                ProviderErrorCode::ProcessFailed,
                "Could not read the Apple conversation prompt.",
            )
        })?;
        let mut command = Command::new(binary);
        command
            .current_dir(workspace.path())
            .stdin(Stdio::from(input));
        let output = run_process(&mut command, workspace.path(), TIMEOUT)?;
        if let Ok(error) = serde_json::from_str::<ProviderError>(&output) {
            return Err(error);
        }
        match parse_structured_turn(&output) {
            Ok(turn) => return Ok(turn),
            Err(_) if attempt == 0 => continue,
            Err(error) => return Err(error),
        }
    }
    unreachable!("generation returns after two attempts")
}

#[cfg(all(test, unix))]
mod tests {
    use super::*;
    use std::os::unix::fs::PermissionsExt;

    #[test]
    fn local_reply_and_unavailability_use_same_typed_boundary() {
        let dir = ScratchDirectory::new().unwrap();
        let binary = dir.path().join("fake-apple");
        let context = ConversationContext {
            opening_question: String::new(),
            recent_turns: Vec::new(),
            latest_transcript: "Hello".into(),
            learning_targets: Vec::new(),
        };
        fs::write(&binary, "#!/bin/sh\nprintf '%s' '{\"spoken_reply\":\"Hello.\",\"question\":\"How are you?\",\"session_phase\":\"active\",\"is_complete\":false}'\n").unwrap();
        fs::set_permissions(&binary, fs::Permissions::from_mode(0o700)).unwrap();
        assert_eq!(
            crate::providers::generate_configured_turn(
                &context,
                &crate::providers::AiSettings {
                    provider: crate::providers::ConversationProvider::Apple,
                    agy_model: crate::providers::AgyModel::FlashHigh
                },
                &binary
            )
            .unwrap()
            .spoken_reply,
            "Hello."
        );
        fs::write(
            &binary,
            "#!/bin/sh\nprintf '%s' '{\"code\":\"unavailable\",\"message\":\"Model not ready\"}'\n",
        )
        .unwrap();
        assert_eq!(
            generate_turn(&context, &binary).unwrap_err().code,
            ProviderErrorCode::Unavailable
        );
    }
}
