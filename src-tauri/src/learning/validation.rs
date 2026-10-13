use super::error::LearningError;
use super::ports::PhraseSource;

pub const MAX_ITEM_ID: u64 = 9_007_199_254_740_991;
pub const MAX_PHRASE_CHARS: usize = 300;
pub const MAX_NOTE_CHARS: usize = 500;
pub const MAX_SOURCE_SEQUENCE: usize = 10_000;

pub fn validate_item_id(item_id: u64) -> Result<(), LearningError> {
    if item_id == 0 || item_id > MAX_ITEM_ID {
        return Err(LearningError::InvalidItemId);
    }
    Ok(())
}

pub fn validate_phrase<'a>(phrase: &'a str, note: &str) -> Result<&'a str, LearningError> {
    let trimmed = phrase.trim();
    if trimmed.is_empty() || trimmed.chars().count() > MAX_PHRASE_CHARS {
        return Err(LearningError::InvalidPhrase);
    }
    if note.chars().count() > MAX_NOTE_CHARS {
        return Err(LearningError::NoteTooLong);
    }
    Ok(trimmed)
}

pub fn validate_phrase_source(
    session_id: Option<u64>,
    sequence: Option<usize>,
) -> Result<Option<PhraseSource>, LearningError> {
    if session_id.is_some_and(|id| id > MAX_ITEM_ID) {
        return Err(LearningError::InvalidSourceSession);
    }
    if sequence.is_some_and(|value| value == 0 || value > MAX_SOURCE_SEQUENCE) {
        return Err(LearningError::InvalidSourceTurn);
    }
    match (session_id, sequence) {
        (Some(session_id), Some(sequence)) => Ok(Some(PhraseSource {
            session_id,
            sequence,
        })),
        (None, None) => Ok(None),
        _ => Err(LearningError::IncompletePhraseSource),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn item_ids_must_be_positive_and_safe_integers() {
        assert!(validate_item_id(1).is_ok());
        assert!(validate_item_id(MAX_ITEM_ID).is_ok());
        assert!(matches!(
            validate_item_id(0),
            Err(LearningError::InvalidItemId)
        ));
        assert!(matches!(
            validate_item_id(MAX_ITEM_ID + 1),
            Err(LearningError::InvalidItemId)
        ));
    }

    #[test]
    fn phrases_are_trimmed_and_bounded() {
        assert_eq!(
            validate_phrase("  for two weeks ", "").unwrap(),
            "for two weeks"
        );
        assert!(matches!(
            validate_phrase("   ", ""),
            Err(LearningError::InvalidPhrase)
        ));
        assert!(matches!(
            validate_phrase(&"x".repeat(301), ""),
            Err(LearningError::InvalidPhrase)
        ));
        assert!(matches!(
            validate_phrase("phrase", &"x".repeat(501)),
            Err(LearningError::NoteTooLong)
        ));
    }

    #[test]
    fn a_phrase_source_needs_both_session_and_turn() {
        assert_eq!(validate_phrase_source(None, None).unwrap(), None);
        assert_eq!(
            validate_phrase_source(Some(3), Some(2)).unwrap(),
            Some(PhraseSource {
                session_id: 3,
                sequence: 2
            })
        );
        assert!(matches!(
            validate_phrase_source(Some(3), None),
            Err(LearningError::IncompletePhraseSource)
        ));
        assert!(matches!(
            validate_phrase_source(None, Some(1)),
            Err(LearningError::IncompletePhraseSource)
        ));
        assert!(matches!(
            validate_phrase_source(Some(3), Some(0)),
            Err(LearningError::InvalidSourceTurn)
        ));
        assert!(matches!(
            validate_phrase_source(Some(MAX_ITEM_ID + 1), Some(1)),
            Err(LearningError::InvalidSourceSession)
        ));
    }
}
