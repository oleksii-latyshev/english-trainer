use crate::mistakes::domain::rules::RuleKey;
use crate::mistakes::domain::view::{MistakeDetail, MistakeGroups, RuleCardView};
use crate::mistakes::error::MistakesError;
use crate::mistakes::ports::{Clock, LessonKick, MistakeStore};
use std::sync::Arc;

#[derive(Clone)]
pub struct MistakesService {
    store: Arc<dyn MistakeStore>,
    lessons: Arc<dyn LessonKick>,
    clock: Arc<dyn Clock>,
}

impl MistakesService {
    pub fn new(
        store: Arc<dyn MistakeStore>,
        lessons: Arc<dyn LessonKick>,
        clock: Arc<dyn Clock>,
    ) -> Self {
        Self {
            store,
            lessons,
            clock,
        }
    }

    pub fn groups(&self) -> Result<MistakeGroups, MistakesError> {
        self.store.groups(self.clock.now_ms())
    }

    pub fn mistake(&self, id: u64) -> Result<MistakeDetail, MistakesError> {
        self.store
            .mistake(id, self.clock.now_ms())?
            .ok_or(MistakesError::NotFound(id))
    }

    pub fn rule_card(&self, rule: RuleKey) -> Result<RuleCardView, MistakesError> {
        self.store.rule_card(rule)
    }

    pub fn archive(&self, id: u64) -> Result<(), MistakesError> {
        if self.store.archive(id)? {
            Ok(())
        } else {
            Err(MistakesError::NotFound(id))
        }
    }

    pub fn retry_lesson(&self, id: u64) -> Result<(), MistakesError> {
        if !self.store.reset_failed_lesson(id)? {
            return Err(MistakesError::NotFound(id));
        }
        self.lessons.kick();
        Ok(())
    }
}
