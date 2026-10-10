use super::{to_sql_id, SessionDatabase};
use crate::providers::{ProviderError, ReviewMaterialRequest, ReviewMaterialResult, ReviewTarget};
use rusqlite::{params, OptionalExtension};

pub(crate) enum StoredReviewMaterial {
    Pending,
    Ready(ReviewMaterialResult),
    Failed(ProviderError),
}

pub(crate) struct ReviewMaterialRow {
    pub position: usize,
    pub target: String,
    pub is_cued: bool,
    pub is_scored: bool,
}

impl SessionDatabase {
    pub(crate) fn review_material_request(
        &self,
        run_id: u64,
    ) -> rusqlite::Result<ReviewMaterialRequest> {
        self.check_active_review(run_id)?;
        let mut statement = self.connection.prepare(
            "SELECT position, target, cue FROM memory_review_items WHERE run_id = ?1 ORDER BY position",
        )?;
        let items = statement
            .query_map([to_sql_id(run_id)?], |row| {
                Ok(ReviewTarget {
                    position: usize::try_from(row.get::<_, i64>(0)?)
                        .map_err(|_| rusqlite::Error::InvalidQuery)?,
                    target: row.get(1)?,
                    note: row.get(2)?,
                })
            })?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        Ok(ReviewMaterialRequest { items })
    }

    pub(crate) fn review_material_rows(
        &self,
        run_id: u64,
    ) -> rusqlite::Result<Vec<ReviewMaterialRow>> {
        self.check_active_review(run_id)?;
        let mut statement = self.connection.prepare(
            "SELECT position, target, is_cued, saved_response IS NOT NULL
             FROM memory_review_items WHERE run_id = ?1 ORDER BY position",
        )?;
        let rows = statement
            .query_map([to_sql_id(run_id)?], |row| {
                Ok(ReviewMaterialRow {
                    position: usize::try_from(row.get::<_, i64>(0)?)
                        .map_err(|_| rusqlite::Error::InvalidQuery)?,
                    target: row.get(1)?,
                    is_cued: row.get(2)?,
                    is_scored: row.get(3)?,
                })
            })?
            .collect();
        rows
    }

    pub(crate) fn review_material(
        &self,
        run_id: u64,
    ) -> rusqlite::Result<Option<StoredReviewMaterial>> {
        self.check_active_review(run_id)?;
        self.connection.query_row(
            "SELECT state, result_json, error_json FROM review_material_preparations WHERE run_id = ?1",
            [to_sql_id(run_id)?], |row| {
                let state: String = row.get(0)?;
                match state.as_str() {
                    "pending" => Ok(StoredReviewMaterial::Pending),
                    "ready" => decode(row.get::<_, String>(1)?).map(StoredReviewMaterial::Ready),
                    "failed" => decode(row.get::<_, String>(2)?).map(StoredReviewMaterial::Failed),
                    _ => Err(rusqlite::Error::InvalidQuery),
                }
            },
        ).optional()
    }

    pub(crate) fn begin_review_material(&mut self, run_id: u64) -> rusqlite::Result<()> {
        self.check_active_review(run_id)?;
        self.connection.execute(
            "INSERT INTO review_material_preparations (run_id, state) VALUES (?1, 'pending')
             ON CONFLICT(run_id) DO UPDATE SET state = 'pending', result_json = NULL, error_json = NULL",
            [to_sql_id(run_id)?],
        )?;
        Ok(())
    }

    pub(crate) fn complete_review_material(
        &mut self,
        run_id: u64,
        result: &Result<ReviewMaterialResult, ProviderError>,
    ) -> rusqlite::Result<()> {
        self.check_active_review(run_id)?;
        let (state, result_json, error_json) = match result {
            Ok(value) => ("ready", Some(encode(value)?), None),
            Err(error) => ("failed", None, Some(encode(error)?)),
        };
        let changed = self.connection.execute(
            "UPDATE review_material_preparations SET state = ?2, result_json = ?3, error_json = ?4
             WHERE run_id = ?1 AND state = 'pending'",
            params![to_sql_id(run_id)?, state, result_json, error_json],
        )?;
        if changed != 1 {
            return Err(rusqlite::Error::QueryReturnedNoRows);
        }
        Ok(())
    }

    /// Showing the target is persisted before IPC can reveal it, and never changes its score.
    pub(crate) fn reveal_review_phrase(
        &mut self,
        run_id: u64,
        position: usize,
    ) -> rusqlite::Result<()> {
        self.check_active_review(run_id)?;
        let changed = self.connection.execute(
            "UPDATE memory_review_items SET is_cued = 1
             WHERE run_id = ?1 AND position = ?2 AND saved_at IS NULL
               AND position = (SELECT MIN(position) FROM memory_review_items WHERE run_id = ?1 AND saved_at IS NULL)",
            params![to_sql_id(run_id)?, super::to_sql_sequence(position)?],
        )?;
        if changed != 1 {
            return Err(rusqlite::Error::QueryReturnedNoRows);
        }
        Ok(())
    }

    fn check_active_review(&self, run_id: u64) -> rusqlite::Result<()> {
        self.connection.query_row(
            "SELECT id FROM memory_review_runs WHERE id = ?1 AND completed_at IS NULL",
            [to_sql_id(run_id)?],
            |_| Ok(()),
        )
    }
}

fn decode<T: serde::de::DeserializeOwned>(value: String) -> rusqlite::Result<T> {
    serde_json::from_str(&value).map_err(|error| {
        rusqlite::Error::FromSqlConversionFailure(0, rusqlite::types::Type::Text, Box::new(error))
    })
}
fn encode<T: serde::Serialize>(value: &T) -> rusqlite::Result<String> {
    serde_json::to_string(value)
        .map_err(|error| rusqlite::Error::ToSqlConversionFailure(Box::new(error)))
}

#[cfg(test)]
#[path = "review_material_tests.rs"]
mod tests;
