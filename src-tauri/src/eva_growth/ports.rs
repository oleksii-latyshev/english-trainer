use super::{domain::GrowthActivity, error::EvaGrowthError};

pub trait GrowthStore: Send + Sync {
    fn activity(&self, now_ms: i64) -> Result<GrowthActivity, EvaGrowthError>;
}
