use super::models::{LearningStatus, ReviewResponse};

pub const MS_PER_DAY: i64 = 86_400_000;

#[derive(Debug, Clone, PartialEq)]
pub struct ScheduledReview {
    pub status: LearningStatus,
    pub interval_days: u32,
    pub ease_factor: f64,
    pub next_review_at: i64,
}

/// Pure scheduling rule that computes next due date and status updates.
///
/// Self-reported recall is deliberate recall practice, NOT proof of spoken mastery.
/// A single 'Remembered' review will never jump directly to 'stable'.
pub fn calculate_next_review(
    current_status: LearningStatus,
    current_interval_days: u32,
    current_ease_factor: f64,
    response: ReviewResponse,
    now_ms: i64,
) -> ScheduledReview {
    let ease = if current_ease_factor < 1.3 {
        1.3
    } else {
        current_ease_factor
    };

    match response {
        ReviewResponse::NeedPractice => {
            // Need practice resets interval back to 1 day.
            let interval_days = 1;
            let ease_factor = (ease - 0.2).max(1.3);
            let status = match current_status {
                LearningStatus::Archived => LearningStatus::Archived,
                _ => LearningStatus::Learning,
            };
            ScheduledReview {
                status,
                interval_days,
                ease_factor,
                next_review_at: now_ms + (interval_days as i64 * MS_PER_DAY),
            }
        }
        ReviewResponse::Remembered => {
            let interval_days = match current_interval_days {
                0 | 1 => 2,
                2 => 4,
                other => ((other as f64 * ease).round() as u32).clamp(4, 365),
            };
            let ease_factor = (ease + 0.1).min(3.0);

            // Self-reported recall rule:
            // - New transitions to Learning.
            // - Learning transitions to Improving only once interval >= 4 (at least 2 successful reviews).
            // - Improving stays below Stable; grounded later-session usage owns that transition.
            // Existing Stable evidence is preserved by a remembered review.
            let status = match current_status {
                LearningStatus::New => LearningStatus::Learning,
                LearningStatus::Learning => {
                    if interval_days >= 4 {
                        LearningStatus::Improving
                    } else {
                        LearningStatus::Learning
                    }
                }
                // Review buttons are self-reports, not observed spoken usage.
                // Keep this state below stable until later-session usage evidence exists.
                LearningStatus::Improving => LearningStatus::Improving,
                LearningStatus::Stable => LearningStatus::Stable,
                LearningStatus::Archived => LearningStatus::Archived,
            };

            ScheduledReview {
                status,
                interval_days,
                ease_factor,
                next_review_at: now_ms + (interval_days as i64 * MS_PER_DAY),
            }
        }
    }
}
