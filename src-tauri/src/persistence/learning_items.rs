use super::*;
use crate::learning::LearningItemType;

impl SessionDatabase {
    /// Hides a phrase or mistake from Memory and from every review queue; its history stays.
    /// False when the item does not exist or is already archived.
    pub fn archive_learning_item(
        &mut self,
        item_type: LearningItemType,
        item_id: u64,
    ) -> rusqlite::Result<bool> {
        let table = match item_type {
            LearningItemType::Mistake => "mistakes",
            LearningItemType::Phrase => "phrase_cards",
        };
        let changed = self.connection.execute(
            &format!(
                "UPDATE {table} SET status = 'archived' WHERE id = ?1 AND status != 'archived'"
            ),
            [to_sql_id(item_id)?],
        )?;
        Ok(changed == 1)
    }

    /// Removes a mistake and the evidence kept about it. Returns false when no mistake has this
    /// id, so a repeated removal is harmless.
    pub fn delete_mistake(&mut self, mistake_id: u64) -> rusqlite::Result<bool> {
        let id = to_sql_id(mistake_id)?;
        let transaction = self.connection.transaction()?;
        // Occurrences, review events and the counter baseline go with the mistake through their
        // cascading keys; these two tables point at it by id only. Past review-run rows stay as
        // history and already tolerate a removed item.
        transaction.execute(
            "DELETE FROM learning_usage_events WHERE item_type = 'mistake' AND item_id = ?1",
            [id],
        )?;
        transaction.execute(
            "DELETE FROM session_cue_exposures WHERE item_type = 'mistake' AND item_id = ?1",
            [id],
        )?;
        let removed = transaction.execute("DELETE FROM mistakes WHERE id = ?1", [id])?;
        transaction.commit()?;
        Ok(removed == 1)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn insert_mistake(db: &SessionDatabase, key: &str) -> u64 {
        db.connection
            .execute(
                "INSERT INTO mistakes (normalized_key, category, original_example, corrected_example,
                    explanation, last_seen_at, next_review_at, status)
                 VALUES (?1, 'grammar', 'every bank send', 'every bank sends', '', 1, 0, 'learning')",
                [key],
            )
            .unwrap();
        db.connection.last_insert_rowid() as u64
    }

    #[test]
    fn archiving_hides_an_item_from_the_due_count_once() {
        let mut db = SessionDatabase::open_in_memory().unwrap();
        let mistake = insert_mistake(&db, "grammar:every bank sends");
        let phrase = db
            .save_phrase_card("for two weeks", "", None, None)
            .unwrap();
        db.connection
            .execute("UPDATE phrase_cards SET next_review_at = 0", [])
            .unwrap();
        assert_eq!(db.get_learning_memory().unwrap().due_count, 2);

        assert!(db
            .archive_learning_item(LearningItemType::Mistake, mistake)
            .unwrap());
        assert!(db
            .archive_learning_item(LearningItemType::Phrase, phrase.id)
            .unwrap());
        let memory = db.get_learning_memory().unwrap();
        assert_eq!(memory.due_count, 0);
        assert_eq!(memory.mistakes[0].status, LearningStatus::Archived);
        assert_eq!(memory.phrase_cards[0].status, LearningStatus::Archived);
        // A second archive and an unknown id report that nothing changed.
        assert!(!db
            .archive_learning_item(LearningItemType::Mistake, mistake)
            .unwrap());
        assert!(!db
            .archive_learning_item(LearningItemType::Phrase, phrase.id + 100)
            .unwrap());
    }

    #[test]
    fn deleting_a_mistake_removes_its_evidence_and_leaves_other_mistakes() {
        let mut db = SessionDatabase::open_in_memory().unwrap();
        let removed = insert_mistake(&db, "grammar:every bank sends");
        let kept = insert_mistake(&db, "grammar:for two weeks");
        for id in [removed, kept] {
            db.connection
                .execute(
                    "INSERT INTO review_events (item_type, item_id, response, created_at, mistake_id)
                     VALUES ('mistake', ?1, 'remembered', 1, ?1)",
                    [id as i64],
                )
                .unwrap();
        }

        assert!(db.delete_mistake(removed).unwrap());
        let memory = db.get_learning_memory().unwrap();
        assert_eq!(memory.mistakes.len(), 1);
        assert_eq!(memory.mistakes[0].id, kept);
        let events: i64 = db
            .connection
            .query_row("SELECT COUNT(*) FROM review_events", [], |row| row.get(0))
            .unwrap();
        assert_eq!(events, 1);
        assert!(!db.delete_mistake(removed).unwrap());
    }
}
