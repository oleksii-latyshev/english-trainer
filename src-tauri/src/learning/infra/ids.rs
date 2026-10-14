use crate::learning::error::LearningError;

pub(crate) fn now_ms() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64
}

pub(crate) fn to_sql_id(value: u64) -> rusqlite::Result<i64> {
    i64::try_from(value).map_err(|_| rusqlite::Error::IntegralValueOutOfRange(0, i64::MAX))
}

pub(crate) fn to_sql_sequence(value: usize) -> rusqlite::Result<i64> {
    i64::try_from(value).map_err(|_| rusqlite::Error::IntegralValueOutOfRange(0, i64::MAX))
}

pub(crate) fn to_safe_u64_id(value: i64) -> rusqlite::Result<u64> {
    let id = u64::try_from(value).map_err(|_| rusqlite::Error::IntegralValueOutOfRange(0, -1))?;
    if id == 0 || id > super::super::validation::MAX_ITEM_ID {
        return Err(rusqlite::Error::IntegralValueOutOfRange(0, value));
    }
    Ok(id)
}

pub(crate) fn storage(operation: &'static str) -> impl FnOnce(rusqlite::Error) -> LearningError {
    move |source| LearningError::Storage {
        operation,
        source: Box::new(source),
    }
}
