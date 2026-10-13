use super::*;
use crate::learning::infra::sqlite;
use crate::learning::PhraseCardRecord;

impl SessionDatabase {
    pub(crate) fn connection_mut(&mut self) -> &mut Connection {
        &mut self.connection
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
}
