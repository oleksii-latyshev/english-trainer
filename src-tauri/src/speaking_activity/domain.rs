use serde::Serialize;
use ts_rs::TS;

pub const WINDOW_DAYS: i64 = 190;
pub const DAY_MS: i64 = 86_400_000;
const MINUTE_MS: u64 = 60_000;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, TS)]
#[ts(export)]
pub struct SpeakingDay {
    pub date: String,
    pub minutes: u32,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, TS)]
#[ts(export)]
pub struct SpeakingActivity {
    pub days: Vec<SpeakingDay>,
}

pub fn window_start_ms(now_ms: i64) -> i64 {
    now_ms.saturating_sub(WINDOW_DAYS * DAY_MS)
}

pub fn speaking_day(date: String, active_ms: u64) -> Option<SpeakingDay> {
    let minutes = u32::try_from((active_ms + MINUTE_MS / 2) / MINUTE_MS).unwrap_or(u32::MAX);
    (minutes > 0).then_some(SpeakingDay { date, minutes })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn minutes_round_to_the_nearest_whole_minute() {
        assert_eq!(speaking_day("d".into(), 89_999).map(|d| d.minutes), Some(1));
        assert_eq!(speaking_day("d".into(), 90_000).map(|d| d.minutes), Some(2));
    }

    #[test]
    fn a_day_under_half_a_minute_is_left_out() {
        assert_eq!(speaking_day("d".into(), 29_999), None);
    }

    #[test]
    fn the_window_reaches_back_whole_days() {
        assert_eq!(window_start_ms(WINDOW_DAYS * DAY_MS + 5), 5);
    }
}
