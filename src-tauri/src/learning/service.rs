use super::error::LearningError;
use super::models::{LearningItemType, LearningMemoryView, PhraseCardRecord};
use super::ports::LearningStore;
use super::usage::MemoryUsageEvidence;
use super::validation::{validate_item_id, validate_phrase, validate_phrase_source};
use std::sync::Arc;

#[derive(Clone)]
pub struct LearningService {
    store: Arc<dyn LearningStore>,
}

impl LearningService {
    pub fn new(store: impl LearningStore + 'static) -> Self {
        Self {
            store: Arc::new(store),
        }
    }

    pub fn memory(&self) -> Result<LearningMemoryView, LearningError> {
        self.store.memory()
    }

    pub fn open_memory(&self) -> Result<LearningMemoryView, LearningError> {
        self.store.mark_memory_shown()?;
        self.store.memory()
    }

    pub fn save_phrase(
        &self,
        phrase: &str,
        meaning_or_note: &str,
        session_id: Option<u64>,
        sequence: Option<usize>,
    ) -> Result<PhraseCardRecord, LearningError> {
        let phrase = validate_phrase(phrase, meaning_or_note)?;
        let source = validate_phrase_source(session_id, sequence)?;
        if let Some(source) = source {
            if !self.store.phrase_source_exists(source)? {
                return Err(LearningError::PhraseSourceNotFound);
            }
        }
        self.store.save_phrase(phrase, meaning_or_note, source)
    }

    pub fn delete_phrase(&self, phrase_id: u64) -> Result<bool, LearningError> {
        validate_item_id(phrase_id)?;
        self.store.delete_phrase(phrase_id)
    }

    pub fn delete_mistake(&self, mistake_id: u64) -> Result<bool, LearningError> {
        validate_item_id(mistake_id)?;
        self.store.delete_mistake(mistake_id)
    }

    pub fn archive(
        &self,
        item_type: LearningItemType,
        item_id: u64,
    ) -> Result<bool, LearningError> {
        validate_item_id(item_id)?;
        self.store.archive(item_type, item_id)
    }

    pub fn usage_evidence(
        &self,
        item_type: LearningItemType,
        item_id: u64,
    ) -> Result<MemoryUsageEvidence, LearningError> {
        validate_item_id(item_id)?;
        self.store.mark_memory_shown()?;
        self.store.usage_evidence(item_type, item_id)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::learning::ports::PhraseSource;
    use std::sync::Mutex;

    #[derive(Clone, Default)]
    struct FakeStore {
        known_sources: Vec<PhraseSource>,
        calls: Arc<Mutex<Vec<&'static str>>>,
    }

    impl FakeStore {
        fn record(&self, call: &'static str) {
            self.calls.lock().unwrap().push(call);
        }
    }

    impl LearningStore for FakeStore {
        fn memory(&self) -> Result<LearningMemoryView, LearningError> {
            self.record("memory");
            Ok(LearningMemoryView {
                mistakes: Vec::new(),
                phrase_cards: Vec::new(),
                due_count: 0,
            })
        }

        fn mark_memory_shown(&self) -> Result<(), LearningError> {
            self.record("mark_memory_shown");
            Ok(())
        }

        fn phrase_source_exists(&self, source: PhraseSource) -> Result<bool, LearningError> {
            Ok(self.known_sources.contains(&source))
        }

        fn save_phrase(
            &self,
            phrase: &str,
            meaning_or_note: &str,
            source: Option<PhraseSource>,
        ) -> Result<PhraseCardRecord, LearningError> {
            self.record("save_phrase");
            Ok(PhraseCardRecord {
                id: 1,
                phrase: phrase.into(),
                normalized_phrase: phrase.into(),
                meaning_or_note: meaning_or_note.into(),
                session_id: source.map(|source| source.session_id),
                sequence: source.map(|source| source.sequence),
                session_topic: None,
                created_at: 0,
                last_reviewed_at: None,
                next_review_at: 0,
                interval_days: 1,
                ease_factor: 2.5,
                status: crate::learning::LearningStatus::Learning,
                is_due: false,
                times_used_on_own: 0,
            })
        }

        fn archive(&self, _: LearningItemType, _: u64) -> Result<bool, LearningError> {
            self.record("archive");
            Ok(true)
        }

        fn delete_mistake(&self, _: u64) -> Result<bool, LearningError> {
            self.record("delete_mistake");
            Ok(true)
        }

        fn delete_phrase(&self, _: u64) -> Result<bool, LearningError> {
            self.record("delete_phrase");
            Ok(true)
        }

        fn usage_evidence(
            &self,
            item_type: LearningItemType,
            item_id: u64,
        ) -> Result<MemoryUsageEvidence, LearningError> {
            self.record("usage_evidence");
            Ok(MemoryUsageEvidence {
                item_type,
                item_id,
                distinct_session_count: 0,
                streak: 0,
                events: Vec::new(),
            })
        }
    }

    #[test]
    fn opening_memory_marks_the_cues_as_shown_before_reading() {
        let store = FakeStore::default();
        let calls = store.calls.clone();
        LearningService::new(store).open_memory().unwrap();
        assert_eq!(*calls.lock().unwrap(), ["mark_memory_shown", "memory"]);
    }

    #[test]
    fn reading_memory_without_opening_it_does_not_mark_cues() {
        let store = FakeStore::default();
        let calls = store.calls.clone();
        LearningService::new(store).memory().unwrap();
        assert_eq!(*calls.lock().unwrap(), ["memory"]);
    }

    #[test]
    fn invalid_item_ids_never_reach_the_store() {
        let store = FakeStore::default();
        let calls = store.calls.clone();
        let service = LearningService::new(store);
        assert!(matches!(
            service.delete_mistake(0),
            Err(LearningError::InvalidItemId)
        ));
        assert!(matches!(
            service.delete_phrase(0),
            Err(LearningError::InvalidItemId)
        ));
        assert!(matches!(
            service.archive(LearningItemType::Mistake, 0),
            Err(LearningError::InvalidItemId)
        ));
        assert!(matches!(
            service.usage_evidence(LearningItemType::Phrase, 0),
            Err(LearningError::InvalidItemId)
        ));
        assert!(calls.lock().unwrap().is_empty());
    }

    #[test]
    fn a_phrase_from_an_unknown_turn_is_rejected() {
        let service = LearningService::new(FakeStore::default());
        assert!(matches!(
            service.save_phrase("for two weeks", "", Some(1), Some(1)),
            Err(LearningError::PhraseSourceNotFound)
        ));
    }

    #[test]
    fn a_phrase_from_a_known_turn_is_saved_trimmed_with_its_source() {
        let store = FakeStore {
            known_sources: vec![PhraseSource {
                session_id: 4,
                sequence: 2,
            }],
            ..FakeStore::default()
        };
        let card = LearningService::new(store)
            .save_phrase("  for two weeks ", "note", Some(4), Some(2))
            .unwrap();
        assert_eq!(card.phrase, "for two weeks");
        assert_eq!(card.session_id, Some(4));
        assert_eq!(card.sequence, Some(2));
    }

    #[test]
    fn a_phrase_without_a_source_is_saved_directly() {
        let card = LearningService::new(FakeStore::default())
            .save_phrase("for two weeks", "", None, None)
            .unwrap();
        assert_eq!(card.session_id, None);
    }
}
