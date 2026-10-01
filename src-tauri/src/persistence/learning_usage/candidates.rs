use super::super::{to_safe_u64_id, to_sql_id, to_sql_sequence, SessionDatabase, TurnFeedback};
use crate::conversation::question_scaffold;
use crate::learning::{
    contains_normalized_words, is_eligible_target_length, is_rejected_by_sources, LearningItemType,
    UsageCandidate,
};
use rusqlite::{params, OptionalExtension};

impl SessionDatabase {
    #[cfg(test)]
    pub fn eligible_usage_candidates(
        &self,
        session_id: u64,
        sequence: usize,
    ) -> rusqlite::Result<Vec<UsageCandidate>> {
        eligible_usage_candidates_on(&self.connection, session_id, sequence)
    }
}

pub(super) fn eligible_usage_candidates_on(
    connection: &rusqlite::Connection,
    session_id: u64,
    sequence: usize,
) -> rusqlite::Result<Vec<UsageCandidate>> {
    if sequence == 0 || sequence > 2 {
        return Ok(Vec::new());
    }
    let sql_sid = to_sql_id(session_id)?;
    let sql_seq = to_sql_sequence(sequence)?;

    let session_info: Option<(i64, String, String)> = connection
        .query_row(
            "SELECT started_at, opening_question, mode FROM sessions WHERE id = ?1",
            params![sql_sid],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )
        .optional()?;

    let (started_at, opening_question, _mode) = match session_info {
        Some(info) if info.2 == "conversation" => (info.0, info.1, info.2),
        _ => return Ok(Vec::new()),
    };

    let transcript: Option<(String, i64)> = connection
        .query_row(
            "SELECT user_transcript, created_at FROM turns WHERE session_id = ?1 AND sequence = ?2",
            params![sql_sid, sql_seq],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .optional()?;

    let (transcript, turn_time) = match transcript {
        Some((t, time)) if !t.trim().is_empty() => (t, time),
        _ => return Ok(Vec::new()),
    };

    let answered_question = if sequence == 1 {
        opening_question.clone()
    } else {
        let prev_q: Option<String> = connection
            .query_row(
                "SELECT assistant_question FROM turns WHERE session_id = ?1 AND sequence = 1",
                params![sql_sid],
                |row| row.get(0),
            )
            .optional()?;
        prev_q.unwrap_or_else(|| opening_question.clone())
    };

    let mut rejected_strings: Vec<String> = vec![opening_question];
    if sequence == 2 {
        let prev_turn: Option<(String, String)> = connection
            .query_row(
                "SELECT assistant_reply, assistant_question FROM turns WHERE session_id = ?1 AND sequence = 1",
                params![sql_sid],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .optional()?;
        if let Some((reply, question)) = prev_turn {
            rejected_strings.push(reply);
            rejected_strings.push(question);
        }
    }

    let mut fb_stmt = connection.prepare(
        "SELECT feedback_json FROM turn_feedback WHERE session_id = ?1 AND sequence < ?2",
    )?;
    let fb_rows = fb_stmt.query_map(params![sql_sid, sql_seq], |row| row.get::<_, String>(0))?;
    for json_res in fb_rows {
        let json_str = json_res?;
        let fb: TurnFeedback = serde_json::from_str(&json_str).map_err(|error| {
            rusqlite::Error::FromSqlConversionFailure(
                0,
                rusqlite::types::Type::Text,
                Box::new(error),
            )
        })?;
        rejected_strings.push(fb.b2_rewrite);
        for item in fb.focus_feedback {
            rejected_strings.push(item.original);
            rejected_strings.push(item.improved);
        }
    }

    let scaffold = question_scaffold(&answered_question);
    for starter in scaffold.sentence_starters {
        rejected_strings.push(starter.to_string());
    }
    for expr in scaffold.useful_expressions {
        rejected_strings.push(expr.to_string());
    }

    let rejected_refs: Vec<&str> = rejected_strings.iter().map(String::as_str).collect();
    let mut candidates = Vec::new();

    // 1. Mistakes
    let mut mistake_stmt = connection.prepare(
        "SELECT m.id, m.original_example, m.corrected_example
         FROM mistakes m
         WHERE m.status != 'archived'
           AND EXISTS (
               SELECT 1 FROM mistake_occurrences o
               WHERE o.mistake_id = m.id
                 AND o.session_id != ?1
                 AND o.created_at < ?2
           )
         ORDER BY m.id ASC",
    )?;
    let mistake_rows = mistake_stmt.query_map(params![sql_sid, started_at], |row| {
        Ok((
            row.get::<_, i64>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, String>(2)?,
        ))
    })?;

    for row in mistake_rows {
        let (id, orig, corr) = row?;
        let safe_id = to_safe_u64_id(id)?;
        if !is_eligible_target_length(&corr) {
            continue;
        }
        let corr_matches = contains_normalized_words(&transcript, &corr);
        let orig_matches = contains_normalized_words(&transcript, &orig);
        if !corr_matches && !orig_matches {
            continue;
        }
        if is_rejected_by_sources(&corr, &rejected_refs) {
            continue;
        }
        if was_exposed_before_turn(connection, sql_sid, ("mistake", id), turn_time)? {
            continue;
        }
        candidates.push(UsageCandidate {
            item_type: LearningItemType::Mistake,
            item_id: safe_id,
            target: corr,
            cue: orig,
        });
        if candidates.len() == 3 {
            return Ok(candidates);
        }
    }

    // 2. Phrase Cards
    let mut phrase_stmt = connection.prepare(
        "SELECT id, phrase, meaning_or_note
         FROM phrase_cards
         WHERE status != 'archived'
           AND created_at < ?1
           AND (session_id IS NULL OR session_id != ?2)
         ORDER BY id ASC",
    )?;
    let phrase_rows = phrase_stmt.query_map(params![started_at, sql_sid], |row| {
        Ok((
            row.get::<_, i64>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, String>(2)?,
        ))
    })?;

    for row in phrase_rows {
        let (id, phrase, meaning) = row?;
        let safe_id = to_safe_u64_id(id)?;
        if !is_eligible_target_length(&phrase) {
            continue;
        }
        if !contains_normalized_words(&transcript, &phrase) {
            continue;
        }
        if is_rejected_by_sources(&phrase, &rejected_refs) {
            continue;
        }
        if was_exposed_before_turn(connection, sql_sid, ("phrase", id), turn_time)? {
            continue;
        }
        candidates.push(UsageCandidate {
            item_type: LearningItemType::Phrase,
            item_id: safe_id,
            target: phrase,
            cue: meaning,
        });
        if candidates.len() == 3 {
            return Ok(candidates);
        }
    }

    Ok(candidates)
}

fn was_exposed_before_turn(
    connection: &rusqlite::Connection,
    session_id: i64,
    identity: (&str, i64),
    turn_time: i64,
) -> rusqlite::Result<bool> {
    connection.query_row(
        "SELECT EXISTS(SELECT 1 FROM session_cue_exposures WHERE session_id = ?1
         AND exposed_at <= ?2 AND ((item_type IS NULL AND item_id IS NULL)
           OR (item_type = ?3 AND item_id = ?4)))",
        params![session_id, turn_time, identity.0, identity.1],
        |row| row.get(0),
    )
}
