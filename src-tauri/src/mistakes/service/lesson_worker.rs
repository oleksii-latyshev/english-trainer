use crate::mistakes::domain::lesson::{validate_batch, LessonBatchRequest, BATCH_SIZE};
use crate::mistakes::error::{LessonProviderError, MistakesError};
use crate::mistakes::ports::{Clock, LessonOutcome, LessonProvider, LessonStore, MistakesNotifier};
use std::sync::Arc;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BatchOutcome {
    Idle,
    Processed,
    QuotaPaused,
}

#[derive(Clone)]
pub struct LessonWorker {
    store: Arc<dyn LessonStore>,
    provider: Arc<dyn LessonProvider>,
    notifier: Arc<dyn MistakesNotifier>,
    clock: Arc<dyn Clock>,
}

impl LessonWorker {
    pub fn new(
        store: Arc<dyn LessonStore>,
        provider: Arc<dyn LessonProvider>,
        notifier: Arc<dyn MistakesNotifier>,
        clock: Arc<dyn Clock>,
    ) -> Self {
        Self {
            store,
            provider,
            notifier,
            clock,
        }
    }

    pub fn run_batch(&self) -> Result<BatchOutcome, MistakesError> {
        let mistakes = self.store.pending(BATCH_SIZE)?;
        if mistakes.is_empty() {
            return Ok(BatchOutcome::Idle);
        }
        let request = LessonBatchRequest {
            missing_card_keys: self.store.missing_card_keys()?,
            mistakes,
        };
        let outcome = match self.provider.prepare(&request) {
            Ok(raw) => {
                let validated = validate_batch(&request, raw);
                LessonOutcome {
                    lessons: validated.lessons,
                    cards: validated.cards,
                    failed: validated.rejected,
                }
            }
            Err(LessonProviderError::QuotaExhausted) => return Ok(BatchOutcome::QuotaPaused),
            Err(LessonProviderError::Failed) => LessonOutcome {
                failed: request
                    .mistakes
                    .iter()
                    .map(|mistake| mistake.mistake_id)
                    .collect(),
                ..LessonOutcome::default()
            },
        };
        let saved = self.store.save(&outcome, self.clock.now_ms())?;
        self.notifier.updated(saved.lessons_ready);
        Ok(BatchOutcome::Processed)
    }
}
