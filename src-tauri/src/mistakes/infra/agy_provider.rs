use crate::mistakes::domain::lesson::{LessonBatchRequest, RawLessonBatch};
use crate::mistakes::domain::prompt::{lesson_prompt, SCHEMA};
use crate::mistakes::error::LessonProviderError;
use crate::mistakes::ports::LessonProvider;
use crate::providers::{run_background_json, ProviderErrorCode};

pub struct AgyLessonProvider;

impl LessonProvider for AgyLessonProvider {
    fn prepare(&self, request: &LessonBatchRequest) -> Result<RawLessonBatch, LessonProviderError> {
        let payload = run_background_json(&lesson_prompt(request), SCHEMA).map_err(|error| {
            if error.code == ProviderErrorCode::RateLimited {
                LessonProviderError::QuotaExhausted
            } else {
                LessonProviderError::Failed
            }
        })?;
        serde_json::from_value(payload).map_err(|_| LessonProviderError::Failed)
    }
}
