use super::ids::to_safe_u64_id;
use crate::learning::mistake_practice::MistakePracticeCandidate;
use rusqlite::Connection;

pub(crate) fn recurring_mistakes(
    connection: &Connection,
) -> rusqlite::Result<Vec<MistakePracticeCandidate>> {
    let mut statement = connection.prepare(
        "SELECT id, original_example, corrected_example, explanation, times_seen, last_seen_at
         FROM mistakes WHERE status != 'archived' AND times_seen >= 2
         AND trim(original_example) != '' AND trim(corrected_example) != '' AND trim(explanation) != ''
         AND length(original_example) <= 300 AND length(corrected_example) <= 300 AND length(explanation) <= 500
         ORDER BY times_seen DESC, last_seen_at DESC, id ASC LIMIT 5",
    )?;
    let rows = statement.query_map([], |row| {
        let id = to_safe_u64_id(row.get(0)?)?;
        let times_seen = usize::try_from(row.get::<_, i64>(4)?)
            .map_err(|_| rusqlite::Error::IntegralValueOutOfRange(4, -1))?;
        Ok(MistakePracticeCandidate {
            id,
            original: row.get(1)?,
            corrected: row.get(2)?,
            explanation: row.get(3)?,
            times_seen,
            last_seen_at: row.get(5)?,
        })
    })?;
    rows.collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::persistence::SessionDatabase;

    #[test]
    fn candidate_selection_is_frequency_then_recency_and_ignores_due_date() {
        let mut database = SessionDatabase::open_in_memory().unwrap();
        let older = database
            .seed_recurring_mistake("first wrong form", "first right form", 3, 10)
            .unwrap();
        let newer = database
            .seed_recurring_mistake("second wrong form", "second right form", 3, 20)
            .unwrap();
        let frequent = database
            .seed_recurring_mistake("third wrong form", "third right form", 5, 1)
            .unwrap();
        let archived = database
            .seed_recurring_mistake("hidden wrong form", "hidden right form", 8, 90)
            .unwrap();
        let single = database
            .seed_recurring_mistake("single wrong form", "single right form", 1, 100)
            .unwrap();
        let connection = database.connection_mut();
        connection
            .execute("UPDATE mistakes SET next_review_at = 9999999999999", [])
            .unwrap();
        connection
            .execute(
                "UPDATE mistakes SET status = 'archived' WHERE id = ?1",
                [archived as i64],
            )
            .unwrap();
        let ids: Vec<_> = recurring_mistakes(connection)
            .unwrap()
            .into_iter()
            .map(|item| item.id)
            .collect();
        assert_eq!(ids, vec![frequent, newer, older]);
        assert!(!ids.contains(&single));
    }
}
