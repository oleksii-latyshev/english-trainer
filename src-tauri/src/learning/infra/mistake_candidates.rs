use super::ids::to_safe_u64_id;
use crate::learning::mistake_practice::MistakePracticeCandidate;
use rusqlite::Connection;

pub(crate) fn recurring_mistakes(
    connection: &Connection,
) -> rusqlite::Result<Vec<MistakePracticeCandidate>> {
    let mut statement = connection.prepare(
        "SELECT m.id, m.original_example, m.corrected_example, m.explanation, m.times_seen, m.last_seen_at
         FROM mistakes m
         JOIN (SELECT rule_key, COUNT(*) AS rule_count FROM mistakes
               WHERE status != 'archived' AND rule_key IS NOT NULL AND rule_key != 'other'
               GROUP BY rule_key HAVING COUNT(*) >= 2) r ON r.rule_key = m.rule_key
         WHERE m.status != 'archived'
         AND trim(m.original_example) != '' AND trim(m.corrected_example) != '' AND trim(m.explanation) != ''
         AND length(m.original_example) <= 300 AND length(m.corrected_example) <= 300 AND length(m.explanation) <= 500
         ORDER BY r.rule_count DESC, m.last_seen_at DESC, m.id ASC LIMIT 5",
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
    fn candidates_come_from_rules_with_two_or_more_mistakes_largest_rule_then_recency() {
        let mut database = SessionDatabase::open_in_memory().unwrap();
        let older = database
            .seed_ruled_mistake("first wrong form", "first right form", 1, 10, "articles")
            .unwrap();
        let newer = database
            .seed_ruled_mistake("second wrong form", "second right form", 1, 20, "articles")
            .unwrap();
        let oldest_large = database
            .seed_ruled_mistake("third wrong form", "third right form", 1, 1, "prepositions")
            .unwrap();
        let middle_large = database
            .seed_ruled_mistake(
                "fourth wrong form",
                "fourth right form",
                1,
                2,
                "prepositions",
            )
            .unwrap();
        let newest_large = database
            .seed_ruled_mistake("fifth wrong form", "fifth right form", 1, 3, "prepositions")
            .unwrap();
        let archived = database
            .seed_ruled_mistake("hidden wrong form", "hidden right form", 8, 90, "articles")
            .unwrap();
        let alone = database
            .seed_ruled_mistake(
                "single wrong form",
                "single right form",
                5,
                100,
                "word_choice",
            )
            .unwrap();
        let other_one = database
            .seed_ruled_mistake("odd one", "odd one fixed", 5, 100, "other")
            .unwrap();
        let other_two = database
            .seed_ruled_mistake("odd two", "odd two fixed", 5, 100, "other")
            .unwrap();
        let connection = database.connection_mut();
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
        assert_eq!(
            ids,
            vec![newest_large, middle_large, oldest_large, newer, older]
        );
        for excluded in [alone, other_one, other_two, archived] {
            assert!(!ids.contains(&excluded));
        }
    }
}
