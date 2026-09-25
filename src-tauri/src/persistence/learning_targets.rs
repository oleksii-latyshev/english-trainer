use super::*;
use crate::providers::LearningPromptTarget;

const MAX_TARGET_CHARS: usize = 160;

fn bounded(value: String) -> String {
    value.chars().take(MAX_TARGET_CHARS).collect()
}

impl SessionDatabase {
    /// Choose at most one correction and one phrase from earlier sessions.
    /// These are conversation cues, not evidence that the learner has mastered them.
    pub fn due_learning_targets(
        &self,
        current_session_id: u64,
    ) -> rusqlite::Result<Vec<LearningPromptTarget>> {
        let session_id = to_sql_id(current_session_id)?;
        let now = now_ms();
        let mistake = self
            .connection
            .query_row(
                "SELECT original_example, corrected_example FROM mistakes m
                 WHERE m.status != 'archived' AND m.next_review_at <= ?1
                   AND EXISTS (SELECT 1 FROM mistake_occurrences o
                               WHERE o.mistake_id = m.id AND o.session_id != ?2)
                 ORDER BY m.next_review_at, m.id LIMIT 1",
                params![now, session_id],
                |row| {
                    Ok(LearningPromptTarget {
                        kind: "mistake".into(),
                        cue: bounded(row.get(0)?),
                        target: bounded(row.get(1)?),
                    })
                },
            )
            .optional()?;
        let phrase = self
            .connection
            .query_row(
                "SELECT meaning_or_note, phrase FROM phrase_cards
                 WHERE status != 'archived' AND next_review_at <= ?1
                   AND (session_id IS NULL OR session_id != ?2)
                 ORDER BY next_review_at, id LIMIT 1",
                params![now, session_id],
                |row| {
                    Ok(LearningPromptTarget {
                        kind: "phrase".into(),
                        cue: bounded(row.get(0)?),
                        target: bounded(row.get(1)?),
                    })
                },
            )
            .optional()?;
        Ok(mistake.into_iter().chain(phrase).collect())
    }
}
