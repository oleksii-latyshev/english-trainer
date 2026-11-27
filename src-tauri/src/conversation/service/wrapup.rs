use crate::conversation::domain::RecurringMistake;
use crate::learning::session_stats::{session_numbers, SessionNumbers, SessionStats};
use crate::persistence::SessionDatabase;

pub(crate) const MAX_WRAPUP_MISTAKES: usize = 2;
const COMPARISON_LOOKBACK: usize = 30;

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct Wrapup {
    pub(crate) duration_ms: u64,
    pub(crate) numbers: SessionNumbers,
    pub(crate) recurring_mistakes: Vec<RecurringMistake>,
}

pub(crate) fn build(database: &SessionDatabase, session_id: u64) -> rusqlite::Result<Wrapup> {
    let current = SessionStats::from_answers(&database.answer_samples(session_id)?);
    let earlier = database
        .earlier_finished_session_ids(session_id, COMPARISON_LOOKBACK)?
        .into_iter()
        .map(|id| {
            database
                .answer_samples(id)
                .map(|a| SessionStats::from_answers(&a))
        })
        .collect::<rusqlite::Result<Vec<_>>>()?;

    let recurring_mistakes = database
        .repeated_mistakes(session_id, MAX_WRAPUP_MISTAKES)?
        .into_iter()
        .map(|mistake| RecurringMistake {
            original: mistake.original,
            improved: mistake.improved,
            explanation: mistake.explanation,
            times: mistake.times,
        })
        .collect();

    Ok(Wrapup {
        duration_ms: database.session_elapsed_ms(session_id)?,
        numbers: session_numbers(&current, &earlier),
        recurring_mistakes,
    })
}
