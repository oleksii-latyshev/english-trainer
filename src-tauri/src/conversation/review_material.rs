use super::{database_error, SessionStore};
use crate::persistence::review_material::StoredReviewMaterial;
use crate::providers::{
    parse_review_material_result, ProviderError, ProviderErrorCode, ReviewMaterialRequest,
    ReviewMaterialResult,
};
use serde::Serialize;
use std::sync::atomic::{AtomicBool, Ordering};

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "state", rename_all = "snake_case")]
pub enum ReviewPreparation {
    Legacy,
    Pending,
    Ready,
    Failed { error: ProviderError },
}
#[derive(Debug, Clone, Serialize)]
pub struct ReviewMaterialView {
    pub position: usize,
    pub situation: Option<String>,
    pub model_answer: Option<String>,
    pub hint: Option<String>,
    pub is_cued: bool,
}
#[derive(Debug, Clone, Serialize)]
pub struct ReviewMaterials {
    pub run_id: u64,
    pub preparation: ReviewPreparation,
    pub items: Vec<ReviewMaterialView>,
}

struct PreparationGuard<'a>(&'a AtomicBool);
impl Drop for PreparationGuard<'_> {
    fn drop(&mut self) {
        self.0.store(false, Ordering::Release);
    }
}

#[cfg(test)]
#[path = "review_material_tests.rs"]
mod tests;

impl SessionStore {
    pub fn get_review_material(&self, run_id: u64) -> Result<ReviewMaterials, ProviderError> {
        let state = self.lock();
        let rows = state
            .database
            .review_material_rows(run_id)
            .map_err(database_error)?;
        let stored = state
            .database
            .review_material(run_id)
            .map_err(database_error)?;
        let (preparation, generated) = match stored {
            None => (ReviewPreparation::Legacy, Vec::new()),
            Some(StoredReviewMaterial::Pending) => (ReviewPreparation::Pending, Vec::new()),
            Some(StoredReviewMaterial::Failed(error)) => {
                (ReviewPreparation::Failed { error }, Vec::new())
            }
            Some(StoredReviewMaterial::Ready(result)) => (ReviewPreparation::Ready, result.items),
        };
        let items = rows
            .into_iter()
            .map(|row| {
                let material = generated.iter().find(|item| item.position == row.position);
                ReviewMaterialView {
                    position: row.position,
                    situation: material.map(|item| item.situation.clone()),
                    // A model sentence would reveal the wording before the first scored answer.
                    model_answer: if row.is_scored {
                        material.map(|item| item.model_answer.clone())
                    } else {
                        None
                    },
                    hint: if row.is_cued { Some(row.target) } else { None },
                    is_cued: row.is_cued,
                }
            })
            .collect();
        Ok(ReviewMaterials {
            run_id,
            preparation,
            items,
        })
    }

    pub fn prepare_review_material(
        &self,
        run_id: u64,
        retry: bool,
        generate: impl FnOnce(&ReviewMaterialRequest) -> Result<ReviewMaterialResult, ProviderError>,
    ) -> Result<ReviewMaterials, ProviderError> {
        let existing = self.get_review_material(run_id)?;
        match existing.preparation {
            ReviewPreparation::Ready => return Ok(existing),
            ReviewPreparation::Failed { .. } if !retry => return Ok(existing),
            _ => {}
        }
        if self
            .review_material_in_flight
            .compare_exchange(false, true, Ordering::AcqRel, Ordering::Acquire)
            .is_err()
        {
            return Err(ProviderError::new(
                ProviderErrorCode::Busy,
                "Review situations are still preparing. You can answer now or retry shortly.",
            ));
        }
        let _guard = PreparationGuard(&self.review_material_in_flight);
        let request = {
            let mut state = self.lock();
            // Another request may have finished between the initial read and this reservation.
            match state
                .database
                .review_material(run_id)
                .map_err(database_error)?
            {
                Some(StoredReviewMaterial::Ready(_)) => {
                    drop(state);
                    return self.get_review_material(run_id);
                }
                Some(StoredReviewMaterial::Failed(_)) if !retry => {
                    drop(state);
                    return self.get_review_material(run_id);
                }
                _ => {}
            }
            let request = state
                .database
                .review_material_request(run_id)
                .map_err(database_error)?;
            request.validate()?;
            state
                .database
                .begin_review_material(run_id)
                .map_err(database_error)?;
            request
        };
        let result = generate(&request).and_then(|value| {
            let raw = serde_json::to_string(&value).map_err(|_| {
                ProviderError::new(
                    ProviderErrorCode::InvalidOutput,
                    "Could not check review situations. Please retry.",
                )
            })?;
            parse_review_material_result(&raw, &request)
        });
        self.lock()
            .database
            .complete_review_material(run_id, &result)
            .map_err(database_error)?;
        self.get_review_material(run_id)
    }

    pub fn reveal_review_phrase(
        &self,
        run_id: u64,
        position: usize,
    ) -> Result<ReviewMaterials, ProviderError> {
        if position == 0 || position > 6 {
            return Err(ProviderError::new(
                ProviderErrorCode::InvalidRequest,
                "Choose the current review item before showing its phrase.",
            ));
        }
        self.lock()
            .database
            .reveal_review_phrase(run_id, position)
            .map_err(database_error)?;
        self.get_review_material(run_id)
    }
}
