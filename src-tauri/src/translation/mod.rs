#![cfg_attr(
    not(test),
    deny(clippy::unwrap_used, clippy::expect_used, clippy::panic)
)]

pub(crate) mod commands;
mod domain;
mod error;
mod helper_process;
mod service;
mod warm_worker;

pub use domain::{
    validate_native_language, validate_request, NativeLanguageSettings, TextExplanation,
    TextTranslation, TranslationError, TranslationErrorCode, TranslationRequest, TranslationStatus,
};
pub use service::TranslationService;
