//! What background coaching reads and writes: which answers still wait for feedback, and how
//! often checking an answer has failed.

use super::{to_sql_id, to_sql_sequence, SessionDatabase};
use rusqlite::params;

/// An answer without feedback has this many tries; one retry after the first failure.
pub(crate) const MAX_COACHING_ATTEMPTS: u32 = 2;

/// An answer that has no feedback yet.
#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct UncoachedAnswer {
    pub(crate) sequence: usize,
    pub(crate) transcript: String,
    /// What Eva asked, which the learner answered.
    pub(crate) question: String,
    pub(crate) failed_attempts: u32,
}

/// Where one answer stands with background coaching.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum CoachingProgress {
    Done,
    Waiting,
    GaveUp,
}

impl SessionDatabase {
    /// Answers of the session without feedback, in order, including those that gave up.
    fn uncoached_answers(&self, session_id: u64) -> rusqlite::Result<Vec<UncoachedAnswer>> {
        let turns = self.turns(session_id)?;
        let opening: String = self.connection.query_row(
            "SELECT opening_question FROM sessions WHERE id = ?1",
            [to_sql_id(session_id)?],
            |row| row.get(0),
        )?;
        let (practice_mode, written_turn_count): (String, i64) = self.connection.query_row(
            "SELECT COALESCE(practice_mode, 'voice'), COALESCE(written_turn_count, 0) FROM sessions WHERE id = ?1",
            [to_sql_id(session_id)?],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )?;
        let written_turn_count = usize::try_from(written_turn_count).unwrap_or(0);
        let mut statement = self.connection.prepare(
            "SELECT t.sequence, COALESCE(c.failed_attempts, 0)
             FROM turns t
             LEFT JOIN turn_feedback f ON f.session_id = t.session_id AND f.sequence = t.sequence
             LEFT JOIN coaching_failures c ON c.session_id = t.session_id AND c.sequence = t.sequence
             WHERE t.session_id = ?1 AND f.sequence IS NULL ORDER BY t.sequence",
        )?;
        let rows = statement.query_map([to_sql_id(session_id)?], |row| {
            Ok((row.get::<_, i64>(0)?, row.get::<_, i64>(1)?))
        })?;
        let mut answers = Vec::new();
        for row in rows {
            let (sequence, failed) = row?;
            let sequence = usize::try_from(sequence)
                .map_err(|_| rusqlite::Error::IntegralValueOutOfRange(0, sequence))?;
            let Some(turn) = sequence.checked_sub(1).and_then(|index| turns.get(index)) else {
                continue;
            };
            let question = if practice_mode == "write_then_speak" && sequence > written_turn_count {
                let spoken_index = sequence - written_turn_count - 1;
                match spoken_index
                    .checked_sub(1)
                    .and_then(|index| turns.get(index))
                {
                    Some(original) => original.prompt().to_string(),
                    None => opening.clone(),
                }
            } else {
                match sequence.checked_sub(2).and_then(|index| turns.get(index)) {
                    Some(previous) => previous.prompt().to_string(),
                    None => opening.clone(),
                }
            };
            answers.push(UncoachedAnswer {
                sequence,
                transcript: turn.learner.clone(),
                question,
                failed_attempts: u32::try_from(failed).unwrap_or(MAX_COACHING_ATTEMPTS),
            });
        }
        Ok(answers)
    }

    /// Answers still waiting for coaching, oldest first: no feedback and attempts left.
    pub(crate) fn coaching_queue(&self, session_id: u64) -> rusqlite::Result<Vec<UncoachedAnswer>> {
        Ok(self
            .uncoached_answers(session_id)?
            .into_iter()
            .filter(|answer| answer.failed_attempts < MAX_COACHING_ATTEMPTS)
            .collect())
    }

    /// Coaching progress of every answer of the session, in turn order.
    pub(crate) fn coaching_progress(
        &self,
        session_id: u64,
        turn_count: usize,
    ) -> rusqlite::Result<Vec<CoachingProgress>> {
        let mut progress = vec![CoachingProgress::Done; turn_count];
        for answer in self.uncoached_answers(session_id)? {
            if let Some(slot) = answer
                .sequence
                .checked_sub(1)
                .and_then(|index| progress.get_mut(index))
            {
                *slot = if answer.failed_attempts >= MAX_COACHING_ATTEMPTS {
                    CoachingProgress::GaveUp
                } else {
                    CoachingProgress::Waiting
                };
            }
        }
        Ok(progress)
    }

    pub(crate) fn record_coaching_failure(
        &mut self,
        session_id: u64,
        sequence: usize,
    ) -> rusqlite::Result<()> {
        self.connection.execute(
            "INSERT INTO coaching_failures (session_id, sequence, failed_attempts) VALUES (?1, ?2, 1)
             ON CONFLICT(session_id, sequence) DO UPDATE SET failed_attempts = failed_attempts + 1",
            params![to_sql_id(session_id)?, to_sql_sequence(sequence)?],
        )?;
        Ok(())
    }

    /// Gives an answer its tries back for a manual retry. False when the answer is not waiting
    /// for feedback (it has some, or does not exist).
    pub(crate) fn reset_coaching_failures(
        &mut self,
        session_id: u64,
        sequence: usize,
    ) -> rusqlite::Result<bool> {
        let needs_feedback = self
            .uncoached_answers(session_id)?
            .iter()
            .any(|answer| answer.sequence == sequence);
        if needs_feedback {
            self.connection.execute(
                "DELETE FROM coaching_failures WHERE session_id = ?1 AND sequence = ?2",
                params![to_sql_id(session_id)?, to_sql_sequence(sequence)?],
            )?;
        }
        Ok(needs_feedback)
    }
}
