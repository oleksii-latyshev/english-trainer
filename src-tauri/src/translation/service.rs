use super::domain::{
    TranslationError, TranslationErrorCode, TranslationRequest, TranslationResult,
    TranslationStatus, TranslationStatusKind,
};
use super::helper_process::{run_helper, HelperOperation};
use serde::Deserialize;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;

#[cfg(test)]
#[path = "service_tests.rs"]
mod tests;

#[derive(Clone)]
pub struct TranslationService {
    binary: Option<PathBuf>,
    in_flight: Arc<AtomicBool>,
}

impl TranslationService {
    pub fn new(binary: Option<PathBuf>) -> Self {
        Self {
            binary,
            in_flight: Arc::new(AtomicBool::new(false)),
        }
    }

    pub fn status(&self, native_language: &str) -> Result<TranslationStatus, TranslationError> {
        let response = self.invoke("status", native_language, None, Duration::from_secs(15))?;
        parse_status(response, native_language)
    }

    pub fn prepare(&self, native_language: &str) -> Result<TranslationStatus, TranslationError> {
        let response = self.invoke("prepare", native_language, None, Duration::from_secs(300))?;
        parse_status(response, native_language)
    }

    pub fn translate(
        &self,
        request: &TranslationRequest,
        native_language: &str,
    ) -> Result<TranslationResult, TranslationError> {
        let response = self.invoke(
            "translate",
            native_language,
            Some(request),
            Duration::from_secs(45),
        )?;
        #[derive(Deserialize)]
        #[serde(deny_unknown_fields)]
        struct Envelope {
            error: Option<HelperError>,
            word: Option<String>,
            native_language: Option<String>,
            translation: Option<String>,
            english_explanation: Option<String>,
            explanation_error: Option<String>,
        }
        let envelope: Envelope = serde_json::from_value(response).map_err(|_| invalid_output())?;
        if let Some(error) = envelope.error {
            return Err(error.into_translation_error());
        }
        super::domain::validate_result(
            TranslationResult {
                word: envelope.word.ok_or_else(invalid_output)?,
                native_language: envelope.native_language.ok_or_else(invalid_output)?,
                translation: envelope.translation.ok_or_else(invalid_output)?,
                english_explanation: envelope.english_explanation,
                explanation_error: envelope.explanation_error,
            },
            request,
            native_language,
        )
    }

    fn invoke(
        &self,
        operation: &str,
        native_language: &str,
        request: Option<&TranslationRequest>,
        timeout: Duration,
    ) -> Result<serde_json::Value, TranslationError> {
        let _guard = self.try_enter()?;
        #[cfg(not(any(target_os = "macos", test)))]
        {
            let _ = (operation, native_language, request, timeout);
            return Err(TranslationError::new(
                TranslationErrorCode::Unavailable,
                "Word translation is available in the macOS app. Open this feature on a supported Mac.",
            ));
        }
        #[cfg(any(target_os = "macos", test))]
        {
            let binary = self.binary.as_ref().ok_or_else(|| {
                TranslationError::new(
                    TranslationErrorCode::Unavailable,
                    "The bundled translation helper is unavailable. Reinstall the app and try again.",
                )
            })?;
            if !binary.is_file() {
                return Err(TranslationError::new(
                    TranslationErrorCode::Unavailable,
                    "The bundled translation helper is missing. Reinstall the app and try again.",
                ));
            }
            run_helper(
                binary,
                HelperOperation {
                    operation,
                    native_language,
                    request,
                    timeout,
                },
            )
        }
    }

    fn try_enter(&self) -> Result<OperationGuard, TranslationError> {
        self.in_flight
            .compare_exchange(false, true, Ordering::Acquire, Ordering::Relaxed)
            .map_err(|_| {
                TranslationError::new(
                    TranslationErrorCode::Busy,
                    "Another translation request is still running. Wait briefly and try again.",
                )
            })?;
        Ok(OperationGuard(self.in_flight.clone()))
    }
}

struct OperationGuard(Arc<AtomicBool>);

impl Drop for OperationGuard {
    fn drop(&mut self) {
        self.0.store(false, Ordering::Release);
    }
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct StatusEnvelope {
    error: Option<HelperError>,
    status: Option<TranslationStatusKind>,
    message: Option<String>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct HelperError {
    code: TranslationErrorCode,
    message: String,
}

impl HelperError {
    fn into_translation_error(self) -> TranslationError {
        TranslationError::new(self.code, bounded_message(self.message))
    }
}

fn parse_status(
    value: serde_json::Value,
    native_language: &str,
) -> Result<TranslationStatus, TranslationError> {
    let envelope: StatusEnvelope = serde_json::from_value(value).map_err(|_| invalid_output())?;
    if let Some(error) = envelope.error {
        return Err(error.into_translation_error());
    }
    let status = envelope.status.ok_or_else(invalid_output)?;
    let message = envelope.message.ok_or_else(invalid_output)?;
    if message.trim().is_empty()
        || message.chars().count() > 500
        || has_unsafe_control(&message)
        || !is_english_text(&message)
    {
        return Err(invalid_output());
    }
    Ok(TranslationStatus {
        native_language: native_language.to_string(),
        status,
        message,
    })
}

fn bounded_message(message: String) -> String {
    let message = message.trim();
    if message.is_empty()
        || message.chars().count() > 500
        || has_unsafe_control(message)
        || !is_english_text(message)
    {
        "The translation helper could not complete this request. Please retry.".to_string()
    } else {
        message.to_string()
    }
}

fn has_unsafe_control(text: &str) -> bool {
    text.chars()
        .any(|character| character.is_control() && !matches!(character, '\n' | '\r' | '\t'))
}

fn is_english_text(text: &str) -> bool {
    text.chars()
        .any(|character| character.is_ascii_alphabetic())
        && !text
            .chars()
            .any(|character| character.is_alphabetic() && !character.is_ascii())
}

fn invalid_output() -> TranslationError {
    TranslationError::new(
        TranslationErrorCode::InvalidOutput,
        "The translation helper returned invalid data. Please retry.",
    )
}
