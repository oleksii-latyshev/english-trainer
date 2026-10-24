use super::domain::{
    validate_explanation, validate_translation, TextExplanation, TextTranslation, TranslationError,
    TranslationErrorCode, TranslationRequest, TranslationStatus, TranslationStatusKind,
};
use super::helper_process::{run_helper, HelperOperation, HelperRequest};
use super::warm_worker::WarmWorker;
use serde::Deserialize;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;

#[cfg(test)]
#[path = "service_tests.rs"]
mod tests;

const TRANSLATE_TIMEOUT: Duration = Duration::from_secs(15);
const EXPLAIN_TIMEOUT: Duration = Duration::from_secs(30);
const WARM_UP_TEXT: &str = "Hello";

#[derive(Clone)]
pub struct TranslationService {
    binary: Option<PathBuf>,
    in_flight: Arc<AtomicBool>,
    translator: WarmWorker,
    explainer: WarmWorker,
}

impl TranslationService {
    pub fn new(binary: Option<PathBuf>) -> Self {
        Self {
            translator: WarmWorker::new(binary.clone(), "translate"),
            explainer: WarmWorker::new(binary.clone(), "explain"),
            binary,
            in_flight: Arc::new(AtomicBool::new(false)),
        }
    }

    pub fn warm_up(&self, native_language: &str) {
        let request = HelperRequest {
            operation: "translate",
            native_language,
            text: WARM_UP_TEXT,
            context: "",
        };
        ignore_warm_up_failure(self.translator.call(&request, TRANSLATE_TIMEOUT));
        ignore_warm_up_failure(self.explainer.start());
    }

    pub fn status(&self, native_language: &str) -> Result<TranslationStatus, TranslationError> {
        let response = self.invoke("status", native_language, Duration::from_secs(15))?;
        parse_status(response, native_language)
    }

    pub fn prepare(&self, native_language: &str) -> Result<TranslationStatus, TranslationError> {
        let response = self.invoke("prepare", native_language, Duration::from_secs(300))?;
        parse_status(response, native_language)
    }

    pub fn translate(
        &self,
        request: &TranslationRequest,
        native_language: &str,
    ) -> Result<TextTranslation, TranslationError> {
        self.ensure_available()?;
        let response = self.translator.call(
            &HelperRequest {
                operation: "translate",
                native_language,
                text: &request.text,
                context: &request.context,
            },
            TRANSLATE_TIMEOUT,
        )?;
        let translation: TextTranslation = parse_answer(response)?;
        validate_translation(translation, request, native_language)
    }

    pub fn explain(
        &self,
        request: &TranslationRequest,
        native_language: &str,
    ) -> Result<TextExplanation, TranslationError> {
        self.ensure_available()?;
        let response = self.explainer.call(
            &HelperRequest {
                operation: "explain",
                native_language,
                text: &request.text,
                context: &request.context,
            },
            EXPLAIN_TIMEOUT,
        )?;
        let explanation: TextExplanation = parse_answer(response)?;
        validate_explanation(explanation, request)
    }

    fn ensure_available(&self) -> Result<(), TranslationError> {
        #[cfg(not(any(target_os = "macos", test)))]
        {
            return Err(TranslationError::new(
                TranslationErrorCode::Unavailable,
                "Phrase translation is available in the macOS app. Open this feature on a supported Mac.",
            ));
        }
        #[cfg(any(target_os = "macos", test))]
        Ok(())
    }

    fn invoke(
        &self,
        operation: &str,
        native_language: &str,
        timeout: Duration,
    ) -> Result<serde_json::Value, TranslationError> {
        let _guard = self.try_enter()?;
        self.ensure_available()?;
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
                timeout,
            },
        )
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
#[serde(untagged)]
enum Answer<T> {
    Failure { error: HelperError },
    Success(T),
}

fn parse_answer<T: serde::de::DeserializeOwned>(
    value: serde_json::Value,
) -> Result<T, TranslationError> {
    match serde_json::from_value(value).map_err(|_| invalid_output())? {
        Answer::Failure { error } => Err(error.into_translation_error()),
        Answer::Success(answer) => Ok(answer),
    }
}

fn ignore_warm_up_failure<T>(result: Result<T, TranslationError>) {
    drop(result);
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
