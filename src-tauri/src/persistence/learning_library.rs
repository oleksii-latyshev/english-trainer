use super::*;
#[cfg(test)]
use crate::learning::has_cue_exposure_before;
use crate::learning::infra::sqlite;
use crate::learning::mistake_practice::MistakePracticeCandidate;
use crate::learning::{recurring_mistakes, save_turn_feedback, PhraseCardRecord};

impl SessionDatabase {
    pub(crate) fn connection(&self) -> &Connection {
        &self.connection
    }

    pub(crate) fn connection_mut(&mut self) -> &mut Connection {
        &mut self.connection
    }

    pub fn save_turn_feedback(
        &mut self,
        session_id: u64,
        sequence: usize,
        feedback: &TurnFeedback,
    ) -> rusqlite::Result<()> {
        save_turn_feedback(self, session_id, sequence, feedback)
    }

    pub fn recurring_mistakes(&self) -> rusqlite::Result<Vec<MistakePracticeCandidate>> {
        recurring_mistakes(&self.connection)
    }

    pub fn save_phrase_card(
        &self,
        phrase: &str,
        meaning_or_note: &str,
        session_id: Option<u64>,
        sequence: Option<usize>,
    ) -> rusqlite::Result<PhraseCardRecord> {
        sqlite::save_phrase_card(
            &self.connection,
            phrase,
            meaning_or_note,
            session_id,
            sequence,
        )
    }

    #[cfg(test)]
    pub fn get_learning_memory(&self) -> rusqlite::Result<crate::learning::LearningMemoryView> {
        sqlite::read_memory(&self.connection, now_ms())
    }

    #[cfg(test)]
    pub fn archive_learning_item(
        &mut self,
        item_type: crate::learning::LearningItemType,
        item_id: u64,
    ) -> rusqlite::Result<bool> {
        sqlite::archive_item(&self.connection, item_type, item_id)
    }

    #[cfg(test)]
    pub fn has_session_cue_exposure_before(
        &self,
        session_id: u64,
        item_type: Option<&str>,
        item_id: Option<u64>,
        turn_time: i64,
    ) -> rusqlite::Result<bool> {
        has_cue_exposure_before(&self.connection, session_id, item_type, item_id, turn_time)
    }
}
