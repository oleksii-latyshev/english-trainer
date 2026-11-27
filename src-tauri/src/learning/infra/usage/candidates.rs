use crate::conversation::question_scaffold;
use crate::learning::infra::ids::{to_safe_u64_id, to_sql_id, to_sql_sequence};
use crate::learning::{
    contains_normalized_words, is_eligible_target_length, is_rejected_by_sources, LearningItemType,
    UsageCandidate,
};
use crate::providers::TurnFeedback;
use rusqlite::{params, OptionalExtension};

const MAX_CANDIDATES: usize = 3;
const FIRST_ANSWERS: usize = 2;

/// The saved item Eva steered toward in the question this answer replied to. A steered rule is
/// not a saved item the usage review can assess, so it counts as no target.
pub(crate) fn steered_target_on(
    connection: &rusqlite::Connection,
    session_id: u64,
    sequence: usize,
) -> rusqlite::Result<Option<(LearningItemType, u64)>> {
    let Some(steering_sequence) = sequence.checked_sub(1).filter(|before| *before > 0) else {
        return Ok(None);
    };
    let row: Option<(String, i64)> = connection
        .query_row(
            "SELECT item_type, item_id FROM turn_steering WHERE session_id = ?1 AND sequence = ?2",
            params![to_sql_id(session_id)?, to_sql_sequence(steering_sequence)?],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .optional()?;
    row.filter(|(item_type, _)| item_type != "rule")
        .map(|(item_type, item_id)| {
            let item_type =
                LearningItemType::parse(&item_type).ok_or(rusqlite::Error::InvalidColumnType(
                    0,
                    "item_type".into(),
                    rusqlite::types::Type::Text,
                ))?;
            Ok((item_type, to_safe_u64_id(item_id)?))
        })
        .transpose()
}

pub(crate) fn is_reviewable_answer_on(
    connection: &rusqlite::Connection,
    session_id: u64,
    sequence: usize,
) -> rusqlite::Result<bool> {
    if sequence == 0 {
        return Ok(false);
    }
    Ok(sequence <= FIRST_ANSWERS || steered_target_on(connection, session_id, sequence)?.is_some())
}

/// Every answer of a finished conversation the usage review may assess: answers 1 and 2, and each
/// answer that came right after a steered question. Spoken first-pass answers of plain voice
/// conversation sessions only.
pub(crate) fn reviewable_sequences_on(
    connection: &rusqlite::Connection,
    session_id: u64,
) -> rusqlite::Result<Vec<usize>> {
    let sql_sid = to_sql_id(session_id)?;
    let plain_voice: bool = connection
        .query_row(
            "SELECT mode = 'conversation' AND COALESCE(practice_mode, 'voice') = 'voice'
                    AND COALESCE(is_mistake_practice, 0) = 0
             FROM sessions WHERE id = ?1",
            params![sql_sid],
            |row| row.get(0),
        )
        .optional()?
        .unwrap_or(false);
    if !plain_voice {
        return Ok(Vec::new());
    }
    let mut statement = connection.prepare(
        "SELECT t.sequence FROM turns t
         LEFT JOIN turn_input_sources s ON s.session_id = t.session_id AND s.sequence = t.sequence
         WHERE t.session_id = ?1 AND COALESCE(s.input_source, 'voice') = 'voice'
         ORDER BY t.sequence",
    )?;
    let sequences = statement
        .query_map(params![sql_sid], |row| row.get::<_, i64>(0))?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    let mut reviewable = Vec::new();
    for sequence in sequences {
        let sequence = usize::try_from(sequence)
            .map_err(|_| rusqlite::Error::IntegralValueOutOfRange(0, sequence))?;
        if is_reviewable_answer_on(connection, session_id, sequence)? {
            reviewable.push(sequence);
        }
    }
    Ok(reviewable)
}

pub(crate) fn eligible_usage_candidates_on(
    connection: &rusqlite::Connection,
    session_id: u64,
    sequence: usize,
) -> rusqlite::Result<Vec<UsageCandidate>> {
    if !is_reviewable_answer_on(connection, session_id, sequence)? {
        return Ok(Vec::new());
    }
    let steered = steered_target_on(connection, session_id, sequence)?;
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

    let transcript = match transcript {
        Some((t, _)) if !t.trim().is_empty() => t,
        _ => return Ok(Vec::new()),
    };

    let previous_turn: Option<(String, String)> = match sequence.checked_sub(1) {
        Some(previous) if previous > 0 => connection
            .query_row(
                "SELECT assistant_reply, assistant_question FROM turns WHERE session_id = ?1 AND sequence = ?2",
                params![sql_sid, to_sql_sequence(previous)?],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .optional()?,
        _ => None,
    };
    let answered_question = match &previous_turn {
        Some((_, question)) => question.clone(),
        None => opening_question.clone(),
    };

    let mut rejected_strings: Vec<String> = vec![opening_question];
    if let Some((reply, question)) = previous_turn {
        rejected_strings.push(reply);
        rejected_strings.push(question);
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
        candidates.push(UsageCandidate {
            item_type: LearningItemType::Mistake,
            item_id: safe_id,
            target: corr,
            cue: orig,
        });
    }

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
        candidates.push(UsageCandidate {
            item_type: LearningItemType::Phrase,
            item_id: safe_id,
            target: phrase,
            cue: meaning,
        });
    }

    if let Some((item_type, item_id)) = steered {
        candidates.sort_by_key(|candidate| {
            (candidate.item_type, candidate.item_id) != (item_type, item_id)
        });
    }
    candidates.truncate(MAX_CANDIDATES);
    Ok(candidates)
}
