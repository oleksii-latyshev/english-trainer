use super::{to_sql_id, AttemptComparison, SessionDatabase, TurnFeedback};
use crate::providers::TargetEvidence;

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct SessionSummaryEvidence {
    pub(crate) improvement: Option<SessionImprovement>,
    pub(crate) focus: Option<SessionFocus>,
    pub(crate) saved_phrases: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct SessionImprovement {
    pub(crate) turn_sequence: usize,
    pub(crate) target: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct SessionFocus {
    pub(crate) turn_sequence: usize,
    pub(crate) original: String,
    pub(crate) improved: String,
    pub(crate) explanation: String,
}

impl SessionDatabase {
    pub(crate) fn session_summary_evidence(
        &self,
        session_id: u64,
    ) -> rusqlite::Result<SessionSummaryEvidence> {
        let session_id_sql = to_sql_id(session_id)?;
        let improvement = self
            .comparisons(session_id)?
            .into_iter()
            .filter(|comparison| comparison.target_evidence == TargetEvidence::NewlyObservedInRetry)
            .max_by_key(|comparison| comparison.turn_sequence)
            .map(|comparison: AttemptComparison| SessionImprovement {
                turn_sequence: comparison.turn_sequence,
                target: comparison.target,
            });

        let focus = {
            let mut statement = self.connection.prepare(
                "SELECT sequence, feedback_json FROM turn_feedback
                 WHERE session_id = ?1 ORDER BY sequence DESC",
            )?;
            let rows = statement.query_map([session_id_sql], |row| {
                Ok((row.get::<_, i64>(0)?, row.get::<_, String>(1)?))
            })?;
            let mut latest_focus = None;
            for row in rows {
                let (sequence, encoded) = row?;
                let feedback: TurnFeedback = serde_json::from_str(&encoded).map_err(|error| {
                    rusqlite::Error::FromSqlConversionFailure(
                        1,
                        rusqlite::types::Type::Text,
                        Box::new(error),
                    )
                })?;
                if let Some(focus) = feedback.focus_feedback.into_iter().next() {
                    latest_focus = Some(SessionFocus {
                        turn_sequence: usize::try_from(sequence)
                            .map_err(|_| rusqlite::Error::IntegralValueOutOfRange(0, sequence))?,
                        original: focus.original,
                        improved: focus.improved,
                        explanation: focus.explanation,
                    });
                    break;
                }
            }
            latest_focus
        };

        let mut statement = self.connection.prepare(
            "SELECT phrase FROM phrase_cards
             WHERE session_id = ?1 ORDER BY sequence ASC, id ASC LIMIT 3",
        )?;
        let saved_phrases = statement
            .query_map([session_id_sql], |row| row.get(0))?
            .collect::<rusqlite::Result<Vec<String>>>()?;

        Ok(SessionSummaryEvidence {
            improvement,
            focus,
            saved_phrases,
        })
    }
}
