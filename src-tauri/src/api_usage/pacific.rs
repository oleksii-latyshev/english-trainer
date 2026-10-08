//! Pacific time, which is when Google's daily request limits reset. Implemented by hand for the
//! US daylight-saving rule (second Sunday of March to first Sunday of November, both at 2:00 local)
//! so no time-zone database is needed.

const SECONDS_PER_DAY: i64 = 86_400;
const HOUR: i64 = 3_600;

/// Days since 1970-01-01 of a civil date (proleptic Gregorian).
fn days_from_civil(year: i64, month: i64, day: i64) -> i64 {
    let year = if month <= 2 { year - 1 } else { year };
    let era = year.div_euclid(400);
    let year_of_era = year - era * 400;
    let month_index = (month + 9) % 12;
    let day_of_year = (153 * month_index + 2) / 5 + day - 1;
    let day_of_era = year_of_era * 365 + year_of_era / 4 - year_of_era / 100 + day_of_year;
    era * 146_097 + day_of_era - 719_468
}

/// The civil date of a day count since 1970-01-01.
fn civil_from_days(days: i64) -> (i64, i64, i64) {
    let shifted = days + 719_468;
    let era = shifted.div_euclid(146_097);
    let day_of_era = shifted - era * 146_097;
    let year_of_era =
        (day_of_era - day_of_era / 1_460 + day_of_era / 36_524 - day_of_era / 146_096) / 365;
    let day_of_year = day_of_era - (365 * year_of_era + year_of_era / 4 - year_of_era / 100);
    let month_index = (5 * day_of_year + 2) / 153;
    let day = day_of_year - (153 * month_index + 2) / 5 + 1;
    let month = if month_index < 10 {
        month_index + 3
    } else {
        month_index - 9
    };
    let year = year_of_era + era * 400 + i64::from(month <= 2);
    (year, month, day)
}

/// 0 = Sunday.
fn weekday(days: i64) -> i64 {
    (days + 4).rem_euclid(7)
}

fn nth_sunday(year: i64, month: i64, n: i64) -> i64 {
    let first = days_from_civil(year, month, 1);
    first + (7 - weekday(first)) % 7 + (n - 1) * 7
}

/// True when daylight saving time is in effect at this UTC instant.
fn is_daylight_time(utc_seconds: i64) -> bool {
    let (year, _, _) = civil_from_days(utc_seconds.div_euclid(SECONDS_PER_DAY));
    // 2:00 PST is 10:00 UTC; 2:00 PDT is 09:00 UTC.
    let starts = nth_sunday(year, 3, 2) * SECONDS_PER_DAY + 10 * HOUR;
    let ends = nth_sunday(year, 11, 1) * SECONDS_PER_DAY + 9 * HOUR;
    (starts..ends).contains(&utc_seconds)
}

fn local_seconds(utc_seconds: i64) -> i64 {
    let offset = if is_daylight_time(utc_seconds) { 7 } else { 8 };
    utc_seconds - offset * HOUR
}

/// The Pacific calendar date of an instant, as `YYYY-MM-DD`.
pub fn pacific_day(epoch_ms: i64) -> String {
    let days = local_seconds(epoch_ms.div_euclid(1_000)).div_euclid(SECONDS_PER_DAY);
    let (year, month, day) = civil_from_days(days);
    format!("{year:04}-{month:02}-{day:02}")
}

/// The next Pacific midnight after an instant, in epoch milliseconds.
pub fn next_pacific_midnight_ms(epoch_ms: i64) -> i64 {
    let days = local_seconds(epoch_ms.div_euclid(1_000)).div_euclid(SECONDS_PER_DAY);
    let local_midnight = (days + 1) * SECONDS_PER_DAY;
    // Midnight never falls in the 2:00 changeover, so the offset in force there is unambiguous.
    let as_daylight = local_midnight + 7 * HOUR;
    let utc_seconds = if is_daylight_time(as_daylight) {
        as_daylight
    } else {
        local_midnight + 8 * HOUR
    };
    utc_seconds * 1_000
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Epoch milliseconds of a UTC date and time.
    fn utc(year: i64, month: i64, day: i64, hour: i64, minute: i64) -> i64 {
        (days_from_civil(year, month, day) * SECONDS_PER_DAY + hour * HOUR + minute * 60) * 1_000
    }

    #[test]
    fn civil_dates_round_trip() {
        for days in [-1, 0, 59, 60, 11_016, 19_000, 20_000, 47_482] {
            let (year, month, day) = civil_from_days(days);
            assert_eq!(days_from_civil(year, month, day), days);
        }
        assert_eq!(days_from_civil(1970, 1, 1), 0);
        assert_eq!(weekday(0), 4, "1970-01-01 was a Thursday");
    }

    #[test]
    fn the_day_turns_over_at_midnight_pacific_not_utc() {
        // Winter (PST, UTC-8): midnight Pacific is 08:00 UTC.
        assert_eq!(pacific_day(utc(2027, 1, 15, 7, 59)), "2027-01-14");
        assert_eq!(pacific_day(utc(2027, 1, 15, 8, 0)), "2027-01-15");
        // Summer (PDT, UTC-7): midnight Pacific is 07:00 UTC.
        assert_eq!(pacific_day(utc(2027, 7, 15, 6, 59)), "2027-07-14");
        assert_eq!(pacific_day(utc(2027, 7, 15, 7, 0)), "2027-07-15");
    }

    #[test]
    fn daylight_saving_starts_and_ends_on_the_us_dates() {
        // 2027: DST starts Sunday 14 March at 10:00 UTC and ends Sunday 7 November at 09:00 UTC.
        assert!(!is_daylight_time(utc(2027, 3, 14, 9, 59) / 1_000));
        assert!(is_daylight_time(utc(2027, 3, 14, 10, 0) / 1_000));
        assert!(is_daylight_time(utc(2027, 11, 7, 8, 59) / 1_000));
        assert!(!is_daylight_time(utc(2027, 11, 7, 9, 0) / 1_000));
        // 2026: second Sunday of March is the 8th, first Sunday of November the 1st.
        assert!(is_daylight_time(utc(2026, 3, 8, 10, 0) / 1_000));
        assert!(!is_daylight_time(utc(2026, 11, 1, 9, 0) / 1_000));
    }

    #[test]
    fn the_next_reset_is_the_coming_pacific_midnight() {
        // 2027-01-15 12:00 UTC is 04:00 PST; the next midnight is 2027-01-16 08:00 UTC.
        assert_eq!(
            next_pacific_midnight_ms(utc(2027, 1, 15, 12, 0)),
            utc(2027, 1, 16, 8, 0)
        );
        // Summer: 2027-07-15 12:00 UTC is 05:00 PDT; the next midnight is 2027-07-16 07:00 UTC.
        assert_eq!(
            next_pacific_midnight_ms(utc(2027, 7, 15, 12, 0)),
            utc(2027, 7, 16, 7, 0)
        );
        // Just after a Pacific midnight the next reset is a full day away.
        assert_eq!(
            next_pacific_midnight_ms(utc(2027, 1, 15, 8, 0)),
            utc(2027, 1, 16, 8, 0)
        );
    }

    #[test]
    fn the_reset_stays_a_pacific_midnight_across_the_changeovers() {
        // The evening before spring forward: the day after is only 23 hours long.
        let reset = next_pacific_midnight_ms(utc(2027, 3, 14, 5, 0));
        assert_eq!(reset, utc(2027, 3, 14, 8, 0));
        assert_eq!(pacific_day(reset), "2027-03-14");
        let next = next_pacific_midnight_ms(reset);
        assert_eq!(next, utc(2027, 3, 15, 7, 0));
        // Fall back: Sunday 7 November has 25 hours.
        let reset = next_pacific_midnight_ms(utc(2027, 11, 6, 20, 0));
        assert_eq!(reset, utc(2027, 11, 7, 7, 0));
        assert_eq!(next_pacific_midnight_ms(reset), utc(2027, 11, 8, 8, 0));
        assert_eq!(pacific_day(utc(2027, 11, 8, 7, 59)), "2027-11-07");
        assert_eq!(pacific_day(utc(2027, 11, 8, 8, 0)), "2027-11-08");
    }
}
