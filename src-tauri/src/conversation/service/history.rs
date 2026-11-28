use super::{SessionStore, State};
use crate::conversation::domain::{FinishedSessionItem, FinishedSessionPage};
use crate::conversation::error::ConversationError;
use crate::learning::focus_rule::pick_focus_rule;
use crate::persistence::finished_sessions::FinishedSessionRow;

const MAX_PAGE: usize = 50;
const FREE_CONVERSATION: &str = "free_conversation";

fn title_of(row: &FinishedSessionRow) -> String {
    let question = row.opening_question.trim();
    let is_open_topic = row.topic_id == FREE_CONVERSATION && !row.is_mistake_practice;
    if is_open_topic && !question.is_empty() {
        question.to_owned()
    } else {
        row.topic_label.clone()
    }
}

fn focus_rule_title(state: &State, session_id: u64) -> Option<String> {
    state
        .database
        .session_rule_counts(session_id)
        .ok()
        .and_then(|counts| pick_focus_rule(&counts))
        .map(|rule| rule.title)
}

impl SessionStore {
    pub fn finished_sessions(
        &self,
        limit: usize,
        offset: usize,
    ) -> Result<FinishedSessionPage, ConversationError> {
        let state = self.lock();
        let limit = limit.clamp(1, MAX_PAGE);
        let mut rows = state.database.finished_sessions_page(limit + 1, offset)?;
        let has_more = rows.len() > limit;
        rows.truncate(limit);
        let sessions = rows
            .iter()
            .map(|row| FinishedSessionItem {
                session_id: row.session_id,
                ended_at: row.ended_at,
                title: title_of(row),
                answer_count: row.answer_count,
                focus_rule_title: focus_rule_title(&state, row.session_id),
            })
            .collect();
        Ok(FinishedSessionPage { sessions, has_more })
    }
}

#[cfg(test)]
#[path = "history_tests.rs"]
mod tests;
