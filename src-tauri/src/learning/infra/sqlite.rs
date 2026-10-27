use super::ids::{now_ms, to_sql_id, to_sql_sequence};
use crate::learning::{
    is_independent_success, normalize_phrase, phrase_kind, LearningItemType, LearningMemoryView,
    LearningStatus, MistakeRecord, PhraseCardRecord, UsageOutcome, MS_PER_DAY,
};
use crate::providers::FocusCategory;
use rusqlite::{params, Connection, OptionalExtension, Row};
use std::collections::{HashMap, HashSet};

const PHRASE_COLUMNS: &str =
    "p.id, p.phrase, p.normalized_phrase, p.meaning_or_note, p.session_id, p.sequence,
     p.created_at, p.last_reviewed_at, p.next_review_at, p.interval_days, p.ease_factor, p.status,
     s.topic_label";

fn mistake_from_row(row: &Row<'_>, now: i64) -> rusqlite::Result<MistakeRecord> {
    let category = match row.get::<_, String>(2)?.as_str() {
        "vocabulary" => FocusCategory::Vocabulary,
        "coherence" => FocusCategory::Coherence,
        "interaction" => FocusCategory::Interaction,
        _ => FocusCategory::Grammar,
    };
    let status_text: String = row.get(13)?;
    let next_review: i64 = row.get(10)?;
    Ok(MistakeRecord {
        id: row.get::<_, i64>(0)? as u64,
        normalized_key: row.get(1)?,
        category,
        original_example: row.get(3)?,
        corrected_example: row.get(4)?,
        explanation: row.get(5)?,
        times_seen: row.get::<_, i64>(6)? as usize,
        times_correct_afterwards: row.get::<_, i64>(7)? as usize,
        last_seen_at: row.get(8)?,
        last_reviewed_at: row.get(9)?,
        next_review_at: next_review,
        interval_days: row.get(11)?,
        ease_factor: row.get(12)?,
        status: LearningStatus::parse(&status_text).unwrap_or(LearningStatus::New),
        is_due: status_text != "archived" && next_review <= now,
    })
}

fn phrase_from_row(row: &Row<'_>, now: i64) -> rusqlite::Result<PhraseCardRecord> {
    let next_review: i64 = row.get(8)?;
    let status_text: String = row.get(11)?;
    let phrase: String = row.get(1)?;
    Ok(PhraseCardRecord {
        id: row.get::<_, i64>(0)? as u64,
        kind: phrase_kind(&phrase),
        phrase,
        normalized_phrase: row.get(2)?,
        meaning_or_note: row.get(3)?,
        session_id: row.get::<_, Option<i64>>(4)?.map(|id| id as u64),
        sequence: row.get::<_, Option<i64>>(5)?.map(|s| s as usize),
        session_topic: row.get(12)?,
        created_at: row.get(6)?,
        last_reviewed_at: row.get(7)?,
        next_review_at: next_review,
        interval_days: row.get(9)?,
        ease_factor: row.get(10)?,
        status: LearningStatus::parse(&status_text).unwrap_or(LearningStatus::Learning),
        is_due: status_text != "archived" && next_review <= now,
        times_used_on_own: 0,
    })
}

pub(crate) fn independent_sessions_by_phrase(
    connection: &Connection,
) -> rusqlite::Result<HashMap<u64, HashSet<u64>>> {
    let mut statement = connection.prepare(
        "SELECT item_id, session_id, outcome, confidence FROM learning_usage_events
         WHERE item_type = 'phrase'",
    )?;
    let rows = statement.query_map([], |row| {
        Ok((
            row.get::<_, i64>(0)? as u64,
            row.get::<_, i64>(1)? as u64,
            row.get::<_, String>(2)?,
            row.get::<_, f64>(3)?,
        ))
    })?;
    let mut sessions: HashMap<u64, HashSet<u64>> = HashMap::new();
    for row in rows {
        let (item_id, session_id, outcome, confidence) = row?;
        let outcome = UsageOutcome::parse(&outcome).unwrap_or(UsageOutcome::Uncertain);
        if is_independent_success(outcome, confidence) {
            sessions.entry(item_id).or_default().insert(session_id);
        }
    }
    Ok(sessions)
}

fn with_own_use_count(
    mut card: PhraseCardRecord,
    sessions: &HashMap<u64, HashSet<u64>>,
) -> PhraseCardRecord {
    card.times_used_on_own = sessions.get(&card.id).map_or(0, HashSet::len);
    card
}

pub(crate) fn read_memory(
    connection: &Connection,
    now: i64,
) -> rusqlite::Result<LearningMemoryView> {
    let mut mistakes_statement = connection.prepare(
        "SELECT id, normalized_key, category, original_example, corrected_example,
                explanation, times_seen, times_correct_afterwards, last_seen_at,
                last_reviewed_at, next_review_at, interval_days, ease_factor, status
         FROM mistakes WHERE times_seen >= 2
         ORDER BY next_review_at ASC, id DESC",
    )?;
    let mistakes: Vec<MistakeRecord> = mistakes_statement
        .query_map([], |row| mistake_from_row(row, now))?
        .collect::<Result<_, _>>()?;

    let mut phrases_statement = connection.prepare(&format!(
        "SELECT {PHRASE_COLUMNS}
         FROM phrase_cards p
         LEFT JOIN sessions s ON s.id = p.session_id
         ORDER BY p.next_review_at ASC, p.id DESC"
    ))?;
    let own_sessions = independent_sessions_by_phrase(connection)?;
    let phrase_cards: Vec<PhraseCardRecord> = phrases_statement
        .query_map([], |row| phrase_from_row(row, now))?
        .map(|card| card.map(|card| with_own_use_count(card, &own_sessions)))
        .collect::<Result<_, _>>()?;

    let due_count = mistakes.iter().filter(|m| m.is_due).count()
        + phrase_cards.iter().filter(|p| p.is_due).count();

    Ok(LearningMemoryView {
        mistakes,
        phrase_cards,
        due_count,
    })
}

pub(crate) fn save_phrase_card(
    connection: &Connection,
    phrase: &str,
    meaning_or_note: &str,
    session_id: Option<u64>,
    sequence: Option<usize>,
) -> rusqlite::Result<PhraseCardRecord> {
    let normalized = normalize_phrase(phrase);
    if normalized.is_empty() {
        return Err(rusqlite::Error::InvalidParameterName(
            "phrase must contain at least one letter or number".into(),
        ));
    }
    if session_id.is_some() != sequence.is_some() {
        return Err(rusqlite::Error::InvalidParameterName(
            "phrase provenance requires both session_id and sequence".into(),
        ));
    }
    let now = now_ms();

    let existing: Option<PhraseCardRecord> = connection
        .query_row(
            &format!(
                "SELECT {PHRASE_COLUMNS}
                 FROM phrase_cards p
                 LEFT JOIN sessions s ON s.id = p.session_id
                 WHERE p.normalized_phrase = ?1"
            ),
            params![normalized],
            |row| phrase_from_row(row, now),
        )
        .optional()?
        .map(|card| -> rusqlite::Result<PhraseCardRecord> {
            Ok(with_own_use_count(
                card,
                &independent_sessions_by_phrase(connection)?,
            ))
        })
        .transpose()?;

    if let Some(mut card) = existing {
        if card.status == LearningStatus::Archived {
            let next_review = now + MS_PER_DAY;
            connection.execute(
                "UPDATE phrase_cards SET status = 'learning', next_review_at = ?1,
                        interval_days = 1 WHERE id = ?2",
                params![next_review, card.id as i64],
            )?;
            card.status = LearningStatus::Learning;
            card.next_review_at = next_review;
            card.interval_days = 1;
            card.is_due = false;
        }
        return Ok(card);
    }

    let session_topic: Option<String> = if let Some(sid) = session_id {
        connection
            .query_row(
                "SELECT topic_label FROM sessions WHERE id = ?1",
                [to_sql_id(sid)?],
                |row| row.get(0),
            )
            .optional()?
    } else {
        None
    };

    let sql_session_id = session_id.map(to_sql_id).transpose()?;
    let sql_sequence = sequence.map(to_sql_sequence).transpose()?;
    let next_review = now + MS_PER_DAY;

    connection.execute(
        "INSERT INTO phrase_cards (
            phrase, normalized_phrase, meaning_or_note, session_id, sequence,
            created_at, next_review_at, interval_days, ease_factor, status
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 1, 2.5, 'learning')",
        params![
            phrase,
            normalized,
            meaning_or_note,
            sql_session_id,
            sql_sequence,
            now,
            next_review
        ],
    )?;

    let id = connection.last_insert_rowid() as u64;
    Ok(PhraseCardRecord {
        id,
        phrase: phrase.to_string(),
        kind: phrase_kind(phrase),
        normalized_phrase: normalized,
        meaning_or_note: meaning_or_note.to_string(),
        session_id,
        sequence,
        session_topic,
        created_at: now,
        last_reviewed_at: None,
        next_review_at: next_review,
        interval_days: 1,
        ease_factor: 2.5,
        status: LearningStatus::Learning,
        is_due: false,
        times_used_on_own: 0,
    })
}

pub(crate) fn archive_item(
    connection: &Connection,
    item_type: LearningItemType,
    item_id: u64,
) -> rusqlite::Result<bool> {
    let table = match item_type {
        LearningItemType::Mistake => "mistakes",
        LearningItemType::Phrase => "phrase_cards",
    };
    let changed = connection.execute(
        &format!("UPDATE {table} SET status = 'archived' WHERE id = ?1 AND status != 'archived'"),
        [to_sql_id(item_id)?],
    )?;
    Ok(changed == 1)
}

pub(crate) fn delete_mistake(
    connection: &mut Connection,
    mistake_id: u64,
) -> rusqlite::Result<bool> {
    delete_item(connection, LearningItemType::Mistake, mistake_id)
}

pub(crate) fn delete_phrase_card(
    connection: &mut Connection,
    phrase_id: u64,
) -> rusqlite::Result<bool> {
    delete_item(connection, LearningItemType::Phrase, phrase_id)
}

fn delete_item(
    connection: &mut Connection,
    item_type: LearningItemType,
    item_id: u64,
) -> rusqlite::Result<bool> {
    let (type_name, table) = match item_type {
        LearningItemType::Mistake => ("mistake", "mistakes"),
        LearningItemType::Phrase => ("phrase", "phrase_cards"),
    };
    let id = to_sql_id(item_id)?;
    let transaction = connection.transaction()?;
    transaction.execute(
        "DELETE FROM learning_usage_events WHERE item_type = ?1 AND item_id = ?2",
        params![type_name, id],
    )?;
    transaction.execute(
        "DELETE FROM session_cue_exposures WHERE item_type = ?1 AND item_id = ?2",
        params![type_name, id],
    )?;
    let removed = transaction.execute(&format!("DELETE FROM {table} WHERE id = ?1"), [id])?;
    transaction.commit()?;
    Ok(removed == 1)
}

pub(crate) fn turn_exists(
    connection: &Connection,
    session_id: u64,
    sequence: usize,
) -> rusqlite::Result<bool> {
    connection
        .query_row(
            "SELECT 1 FROM turns WHERE session_id = ?1 AND sequence = ?2",
            params![to_sql_id(session_id)?, to_sql_sequence(sequence)?],
            |_| Ok(()),
        )
        .optional()
        .map(|found| found.is_some())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::persistence::SessionDatabase;

    fn insert_mistake(connection: &Connection, key: &str) -> u64 {
        connection
            .execute(
                "INSERT INTO mistakes (normalized_key, category, original_example, corrected_example,
                    explanation, times_seen, last_seen_at, next_review_at, status)
                 VALUES (?1, 'grammar', 'every bank send', 'every bank sends', '', 2, 1, 0, 'learning')",
                [key],
            )
            .unwrap();
        connection.last_insert_rowid() as u64
    }

    #[test]
    fn archiving_hides_an_item_from_the_due_count_once() {
        let mut db = SessionDatabase::open_in_memory().unwrap();
        let connection = db.connection_mut();
        let mistake = insert_mistake(connection, "grammar:every bank sends");
        let phrase = save_phrase_card(connection, "for two weeks", "", None, None).unwrap();
        connection
            .execute("UPDATE phrase_cards SET next_review_at = 0", [])
            .unwrap();
        assert_eq!(read_memory(connection, now_ms()).unwrap().due_count, 2);

        assert!(archive_item(connection, LearningItemType::Mistake, mistake).unwrap());
        assert!(archive_item(connection, LearningItemType::Phrase, phrase.id).unwrap());
        let memory = read_memory(connection, now_ms()).unwrap();
        assert_eq!(memory.due_count, 0);
        assert_eq!(memory.mistakes[0].status, LearningStatus::Archived);
        assert_eq!(memory.phrase_cards[0].status, LearningStatus::Archived);
        assert!(!archive_item(connection, LearningItemType::Mistake, mistake).unwrap());
        assert!(!archive_item(connection, LearningItemType::Phrase, phrase.id + 100).unwrap());
    }

    #[test]
    fn deleting_a_mistake_removes_its_evidence_and_leaves_other_mistakes() {
        let mut db = SessionDatabase::open_in_memory().unwrap();
        let connection = db.connection_mut();
        let removed = insert_mistake(connection, "grammar:every bank sends");
        let kept = insert_mistake(connection, "grammar:for two weeks");
        for id in [removed, kept] {
            connection
                .execute(
                    "INSERT INTO review_events (item_type, item_id, response, created_at, mistake_id)
                     VALUES ('mistake', ?1, 'remembered', 1, ?1)",
                    [id as i64],
                )
                .unwrap();
        }

        assert!(delete_mistake(connection, removed).unwrap());
        let memory = read_memory(connection, now_ms()).unwrap();
        assert_eq!(memory.mistakes.len(), 1);
        assert_eq!(memory.mistakes[0].id, kept);
        let events: i64 = connection
            .query_row("SELECT COUNT(*) FROM review_events", [], |row| row.get(0))
            .unwrap();
        assert_eq!(events, 1);
        assert!(!delete_mistake(connection, removed).unwrap());
    }

    #[test]
    fn deleting_a_phrase_card_removes_it_and_reports_a_repeat() {
        let mut db = SessionDatabase::open_in_memory().unwrap();
        let connection = db.connection_mut();
        let card = save_phrase_card(connection, "for two weeks", "", None, None).unwrap();

        assert!(delete_phrase_card(connection, card.id).unwrap());
        assert!(read_memory(connection, now_ms())
            .unwrap()
            .phrase_cards
            .is_empty());
        assert!(!delete_phrase_card(connection, card.id).unwrap());
    }

    fn insert_usage(
        connection: &Connection,
        phrase: u64,
        session: u64,
        outcome: &str,
        confidence: f64,
    ) {
        connection
            .execute(
                "INSERT INTO learning_usage_events (item_type, item_id, session_id, sequence, origin,
                    original_turn_time, outcome, exact_excerpt, confidence, created_at)
                 VALUES ('phrase', ?1, ?2, ?3, 'assessment', 1, ?4, 'x', ?5, 1)",
                params![phrase as i64, session as i64, session as i64, outcome, confidence],
            )
            .unwrap();
    }

    #[test]
    fn a_phrase_counts_the_sessions_where_the_learner_used_it_on_their_own() {
        let mut db = SessionDatabase::open_in_memory().unwrap();
        let connection = db.connection_mut();
        connection
            .pragma_update(None, "foreign_keys", "OFF")
            .unwrap();
        let used = save_phrase_card(connection, "for two weeks", "", None, None).unwrap();
        let untouched = save_phrase_card(connection, "figure out", "", None, None).unwrap();
        insert_usage(connection, used.id, 1, "correct", 0.95);
        insert_usage(connection, used.id, 2, "correct", 0.95);
        insert_usage(connection, used.id, 3, "correct", 0.5);
        insert_usage(connection, used.id, 4, "incorrect", 0.99);
        insert_usage(connection, used.id, 5, "with_help", 0.99);

        let memory = read_memory(connection, now_ms()).unwrap();
        let count_of = |id| {
            memory
                .phrase_cards
                .iter()
                .find(|card| card.id == id)
                .map(|card| card.times_used_on_own)
        };
        assert_eq!(count_of(used.id), Some(2));
        assert_eq!(count_of(untouched.id), Some(0));
        let saved_again = save_phrase_card(connection, "for two weeks", "", None, None).unwrap();
        assert_eq!(saved_again.times_used_on_own, 2);
    }
}
