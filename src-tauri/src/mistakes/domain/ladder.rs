pub const DAY_MS: i64 = 86_400_000;
pub const TOP_STEP: u8 = 4;
pub const STEP4_PASS_DAYS_TO_FIX: u8 = 2;
const PASS_DUE_DAYS: [i64; 4] = [1, 3, 7, 14];

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Progress {
    pub ladder_step: u8,
    pub step4_pass_days: u8,
    pub fixed_at: Option<i64>,
    pub last_step4_pass_ms: Option<i64>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ScheduleUpdate {
    pub ladder_step: u8,
    pub next_review_at: i64,
    pub step4_pass_days: u8,
    pub fixed_at: Option<i64>,
}

pub fn local_day(at_ms: i64, offset_ms: i64) -> i64 {
    (at_ms + offset_ms).div_euclid(DAY_MS)
}

pub fn next_local_day_start(now_ms: i64, offset_ms: i64) -> i64 {
    (local_day(now_ms, offset_ms) + 1) * DAY_MS - offset_ms
}

pub fn schedule(
    progress: Progress,
    exercise_step: u8,
    passed: bool,
    now_ms: i64,
    offset_ms: i64,
) -> ScheduleUpdate {
    let step = exercise_step.clamp(1, TOP_STEP);
    if !passed {
        return ScheduleUpdate {
            ladder_step: progress.ladder_step,
            next_review_at: next_local_day_start(now_ms, offset_ms),
            step4_pass_days: progress.step4_pass_days,
            fixed_at: progress.fixed_at,
        };
    }
    let days = PASS_DUE_DAYS[usize::from(step) - 1];
    let counts_as_new_day = step == TOP_STEP
        && progress
            .last_step4_pass_ms
            .is_none_or(|last| local_day(last, offset_ms) != local_day(now_ms, offset_ms));
    let step4_pass_days = if counts_as_new_day {
        progress.step4_pass_days.saturating_add(1)
    } else {
        progress.step4_pass_days
    };
    let fixed_at = progress
        .fixed_at
        .or_else(|| (step4_pass_days >= STEP4_PASS_DAYS_TO_FIX).then_some(now_ms));
    ScheduleUpdate {
        ladder_step: if step < progress.ladder_step {
            progress.ladder_step
        } else {
            (progress.ladder_step + 1).min(TOP_STEP)
        },
        next_review_at: now_ms + days * DAY_MS,
        step4_pass_days,
        fixed_at,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const NOON: i64 = 12 * 3_600_000;
    const HOUR: i64 = 3_600_000;

    fn fresh(step: u8) -> Progress {
        Progress {
            ladder_step: step,
            step4_pass_days: 0,
            fixed_at: None,
            last_step4_pass_ms: None,
        }
    }

    #[test]
    fn a_pass_moves_up_one_step_and_waits_one_three_seven_then_fourteen_days() {
        for (step, next, days) in [(1, 2, 1), (2, 3, 3), (3, 4, 7), (4, 4, 14)] {
            let update = schedule(fresh(step), step, true, NOON, 0);
            assert_eq!(update.ladder_step, next, "step {step}");
            assert_eq!(update.next_review_at, NOON + days * DAY_MS, "step {step}");
        }
    }

    #[test]
    fn a_miss_keeps_the_step_and_returns_on_the_next_local_day() {
        let update = schedule(fresh(2), 2, false, NOON, 0);
        assert_eq!(update.ladder_step, 2);
        assert_eq!(update.next_review_at, DAY_MS);
        assert_eq!(update.step4_pass_days, 0);
    }

    #[test]
    fn the_next_local_day_follows_the_offset_of_the_learner() {
        let ahead = 3 * HOUR;
        let late_evening_utc = 22 * HOUR;
        let update = schedule(fresh(1), 1, false, late_evening_utc, ahead);
        assert_eq!(update.next_review_at, 2 * DAY_MS - ahead);
        let behind = -5 * HOUR;
        let update = schedule(fresh(1), 1, false, 2 * HOUR, behind);
        assert_eq!(update.next_review_at, -behind);
    }

    #[test]
    fn a_step_four_pass_on_a_new_day_counts_and_two_days_fix_the_mistake() {
        let first = schedule(fresh(4), 4, true, NOON, 0);
        assert_eq!(first.step4_pass_days, 1);
        assert_eq!(first.fixed_at, None);
        let progress = Progress {
            ladder_step: 4,
            step4_pass_days: 1,
            fixed_at: None,
            last_step4_pass_ms: Some(NOON),
        };
        let second = schedule(progress, 4, true, NOON + 14 * DAY_MS, 0);
        assert_eq!(second.step4_pass_days, 2);
        assert_eq!(second.fixed_at, Some(NOON + 14 * DAY_MS));
    }

    #[test]
    fn a_second_step_four_pass_on_the_same_local_day_does_not_count() {
        let progress = Progress {
            ladder_step: 4,
            step4_pass_days: 1,
            fixed_at: None,
            last_step4_pass_ms: Some(NOON),
        };
        let update = schedule(progress, 4, true, NOON + HOUR, 0);
        assert_eq!(update.step4_pass_days, 1);
        assert_eq!(update.fixed_at, None);
    }

    #[test]
    fn the_local_day_decides_what_a_new_day_is_not_utc() {
        let progress = Progress {
            ladder_step: 4,
            step4_pass_days: 1,
            fixed_at: None,
            last_step4_pass_ms: Some(23 * HOUR),
        };
        let now = 25 * HOUR;
        let same_local_day = schedule(progress, 4, true, now, 2 * HOUR);
        assert_eq!(same_local_day.step4_pass_days, 1);
        let new_local_day = schedule(progress, 4, true, now, 0);
        assert_eq!(new_local_day.step4_pass_days, 2);
    }

    #[test]
    fn a_fallback_exercise_moves_the_ladder_by_one_step_only() {
        let update = schedule(fresh(1), 3, true, NOON, 0);
        assert_eq!(update.ladder_step, 2);
        assert_eq!(update.next_review_at, NOON + 7 * DAY_MS);
    }

    #[test]
    fn a_fixed_mistake_stays_fixed_and_a_fallback_exercise_never_lowers_the_ladder() {
        let progress = Progress {
            ladder_step: 4,
            step4_pass_days: 2,
            fixed_at: Some(5),
            last_step4_pass_ms: Some(5),
        };
        assert_eq!(schedule(progress, 3, true, NOON, 0).fixed_at, Some(5));
        assert_eq!(schedule(progress, 3, true, NOON, 0).ladder_step, 4);
        assert_eq!(schedule(progress, 3, false, NOON, 0).fixed_at, Some(5));
    }

    #[test]
    fn a_fallback_step_three_pass_does_not_count_as_a_step_four_pass() {
        let update = schedule(fresh(4), 3, true, NOON, 0);
        assert_eq!(update.step4_pass_days, 0);
        assert_eq!(update.next_review_at, NOON + 7 * DAY_MS);
    }
}
