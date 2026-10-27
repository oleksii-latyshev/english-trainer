use crate::core::IpcError;
use crate::providers::ReviewMaterialResult;
use serde::Serialize;
use ts_rs::TS;

#[derive(Debug, Clone, Serialize, TS)]
#[serde(tag = "state", rename_all = "snake_case")]
#[ts(export)]
pub enum ReviewPreparation {
    Legacy,
    Pending,
    Ready,
    Failed { error: IpcError },
}

#[derive(Debug, Clone, Serialize, TS)]
#[ts(export)]
pub struct ReviewMaterialView {
    pub position: usize,
    pub situation: Option<String>,
    pub model_answer: Option<String>,
    pub hint: Option<String>,
    pub is_cued: bool,
}

#[derive(Debug, Clone, Serialize, TS)]
#[ts(export)]
pub struct ReviewMaterials {
    pub run_id: u64,
    pub preparation: ReviewPreparation,
    pub items: Vec<ReviewMaterialView>,
}

impl ReviewMaterials {
    pub(crate) fn is_settled(&self, retry: bool) -> bool {
        match self.preparation {
            ReviewPreparation::Ready => true,
            ReviewPreparation::Failed { .. } => !retry,
            ReviewPreparation::Legacy | ReviewPreparation::Pending => false,
        }
    }
}

pub(crate) enum StoredReviewMaterial {
    Pending,
    Ready(ReviewMaterialResult),
    Failed(IpcError),
}

pub(crate) struct ReviewMaterialRow {
    pub position: usize,
    pub target: String,
    pub is_cued: bool,
    pub is_scored: bool,
}

pub(crate) fn materials_view(
    run_id: u64,
    rows: Vec<ReviewMaterialRow>,
    stored: Option<StoredReviewMaterial>,
) -> ReviewMaterials {
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
    ReviewMaterials {
        run_id,
        preparation,
        items,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::providers::GeneratedReviewMaterial;

    fn row(position: usize, is_cued: bool, is_scored: bool) -> ReviewMaterialRow {
        ReviewMaterialRow {
            position,
            target: format!("target {position}"),
            is_cued,
            is_scored,
        }
    }

    fn ready() -> Option<StoredReviewMaterial> {
        Some(StoredReviewMaterial::Ready(ReviewMaterialResult {
            items: vec![GeneratedReviewMaterial {
                position: 1,
                situation: "A situation.".into(),
                model_answer: "A model answer.".into(),
            }],
        }))
    }

    #[test]
    fn the_model_answer_stays_hidden_until_the_item_is_scored() {
        let unscored = materials_view(1, vec![row(1, false, false)], ready());
        assert_eq!(unscored.items[0].situation.as_deref(), Some("A situation."));
        assert_eq!(unscored.items[0].model_answer, None);
        let scored = materials_view(1, vec![row(1, false, true)], ready());
        assert_eq!(
            scored.items[0].model_answer.as_deref(),
            Some("A model answer.")
        );
    }

    #[test]
    fn only_a_cued_item_exposes_its_target_as_a_hint() {
        let view = materials_view(1, vec![row(1, true, false), row(2, false, false)], ready());
        assert_eq!(view.items[0].hint.as_deref(), Some("target 1"));
        assert_eq!(view.items[1].hint, None);
    }

    #[test]
    fn a_run_without_stored_material_is_legacy() {
        let view = materials_view(1, vec![row(1, false, false)], None);
        assert!(matches!(view.preparation, ReviewPreparation::Legacy));
        assert_eq!(view.items[0].situation, None);
    }
}
