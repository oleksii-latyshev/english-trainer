use crate::learning::infra::ids::to_sql_id;
use rusqlite::{params, Connection};

pub(crate) fn record_cue_exposure(
    connection: &Connection,
    session_id: u64,
    item_type: Option<&str>,
    item_id: Option<u64>,
    exposed_at: i64,
) -> rusqlite::Result<()> {
    connection.execute(
        "INSERT INTO session_cue_exposures (session_id, item_type, item_id, exposed_at)
         VALUES (?1, ?2, ?3, ?4)",
        params![
            to_sql_id(session_id)?,
            item_type,
            item_id.map(to_sql_id).transpose()?,
            exposed_at
        ],
    )?;
    Ok(())
}

pub(crate) fn has_cue_exposure_before(
    connection: &Connection,
    session_id: u64,
    item_type: Option<&str>,
    item_id: Option<u64>,
    turn_time: i64,
) -> rusqlite::Result<bool> {
    let count: i64 = connection.query_row(
        "SELECT COUNT(*) FROM session_cue_exposures WHERE session_id = ?1 AND exposed_at <= ?2
         AND ((item_type IS NULL AND item_id IS NULL)
           OR (?3 IS NOT NULL AND item_type = ?3 AND item_id = ?4))",
        params![
            to_sql_id(session_id)?,
            turn_time,
            item_type,
            item_id.map(to_sql_id).transpose()?
        ],
        |row| row.get(0),
    )?;
    Ok(count > 0)
}
