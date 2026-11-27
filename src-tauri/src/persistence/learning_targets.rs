use super::*;
use crate::learning::LearningItemType;
use crate::providers::LearningPromptTarget;

const MAX_TARGET_CHARS: usize = 160;

/// A saved item Eva may steer toward, identified so a session never picks it twice.
pub type TargetKey = (LearningItemType, u64);

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DueLearningTarget {
    pub key: TargetKey,
    pub prompt: LearningPromptTarget,
}

fn bounded(value: String) -> String {
    value.chars().take(MAX_TARGET_CHARS).collect()
}

impl SessionDatabase {
    /// Choose the one item Eva steers toward on this turn: the oldest due taken phrase from an
    /// earlier session, else the oldest due recurring mistake, skipping what was already used.
    /// These are conversation cues, not evidence that the learner has mastered them.
    pub fn next_learning_target(
        &self,
        current_session_id: u64,
        used: &[TargetKey],
    ) -> rusqlite::Result<Option<DueLearningTarget>> {
        let session_id = to_sql_id(current_session_id)?;
        let now = now_ms();
        let limit = to_sql_id(used.len() as u64 + 1)?;
        let mut phrases = self.connection.prepare(
            "SELECT id, meaning_or_note, phrase FROM phrase_cards
             WHERE status != 'archived' AND next_review_at <= ?1
               AND (session_id IS NULL OR session_id != ?2)
             ORDER BY next_review_at, id LIMIT ?3",
        )?;
        let rows = phrases
            .query_map(params![now, session_id, limit], read_row)?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        let phrase = first_unused(LearningItemType::Phrase, "phrase", used, rows);
        if phrase.is_some() {
            return Ok(phrase);
        }
        let mut mistakes = self.connection.prepare(
            "SELECT id, original_example, corrected_example FROM mistakes m
             WHERE m.status != 'archived' AND m.times_seen >= 2 AND m.next_review_at <= ?1
               AND EXISTS (SELECT 1 FROM mistake_occurrences o
                           WHERE o.mistake_id = m.id AND o.session_id != ?2)
             ORDER BY m.next_review_at, m.id LIMIT ?3",
        )?;
        let rows = mistakes
            .query_map(params![now, session_id, limit], read_row)?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        Ok(first_unused(
            LearningItemType::Mistake,
            "mistake",
            used,
            rows,
        ))
    }
}

fn read_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<(i64, String, String)> {
    Ok((row.get(0)?, row.get(1)?, row.get(2)?))
}

fn first_unused(
    item_type: LearningItemType,
    kind: &str,
    used: &[TargetKey],
    rows: Vec<(i64, String, String)>,
) -> Option<DueLearningTarget> {
    rows.into_iter().find_map(|(id, cue, target)| {
        let key = (item_type, id as u64);
        (!used.contains(&key)).then(|| DueLearningTarget {
            key,
            prompt: LearningPromptTarget {
                kind: kind.into(),
                cue: bounded(cue),
                target: bounded(target),
            },
        })
    })
}
