use serde::Deserialize;
use std::fmt;
use ts_rs::TS;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, TS)]
#[serde(rename_all = "snake_case")]
#[ts(export)]
pub enum FallbackReason {
    GuardTimeout,
    EngineBusy,
    OutputFailedToOpen,
    SynthesisFailed,
    EnqueueFailed,
}

impl FallbackReason {
    fn label(self) -> &'static str {
        match self {
            Self::GuardTimeout => "guard_timeout",
            Self::EngineBusy => "engine_busy",
            Self::OutputFailedToOpen => "output_failed_to_open",
            Self::SynthesisFailed => "synthesis_failed",
            Self::EnqueueFailed => "enqueue_failed",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize, TS)]
#[serde(tag = "kind", rename_all = "snake_case")]
#[ts(export)]
pub enum DiagnosticEvent {
    NaturalVoiceFallback {
        reason: FallbackReason,
        phrase_chars: u32,
        guard_ms: u32,
        elapsed_ms: Option<u32>,
        is_first_phrase: bool,
    },
}

pub const VOICE_AREA: &str = "voice";

impl DiagnosticEvent {
    pub fn area(&self) -> &'static str {
        match self {
            Self::NaturalVoiceFallback { .. } => VOICE_AREA,
        }
    }
}

impl fmt::Display for DiagnosticEvent {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::NaturalVoiceFallback {
                reason,
                phrase_chars,
                guard_ms,
                elapsed_ms,
                is_first_phrase,
            } => {
                write!(
                    formatter,
                    "natural voice fell back to the system voice: reason={} phrase_chars={phrase_chars} guard_ms={guard_ms} elapsed_ms=",
                    reason.label()
                )?;
                match elapsed_ms {
                    Some(elapsed) => write!(formatter, "{elapsed}")?,
                    None => write!(formatter, "none")?,
                }
                write!(formatter, " first_phrase={is_first_phrase}")
            }
        }
    }
}

pub fn format_line(now_ms: i64, area: &str, message: &str) -> String {
    format!(
        "{} {area} {}",
        format_timestamp(now_ms),
        single_line(message)
    )
}

fn single_line(message: &str) -> String {
    message
        .chars()
        .map(|character| {
            if character.is_control() {
                ' '
            } else {
                character
            }
        })
        .collect()
}

fn format_timestamp(now_ms: i64) -> String {
    let millis = now_ms.rem_euclid(1000);
    let seconds = now_ms.div_euclid(1000);
    let days = seconds.div_euclid(86_400);
    let second_of_day = seconds.rem_euclid(86_400);
    let (year, month, day) = civil_from_days(days);
    format!(
        "{year:04}-{month:02}-{day:02}T{:02}:{:02}:{:02}.{millis:03}Z",
        second_of_day / 3600,
        second_of_day % 3600 / 60,
        second_of_day % 60
    )
}

fn civil_from_days(days_since_epoch: i64) -> (i64, i64, i64) {
    let shifted = days_since_epoch + 719_468;
    let era = shifted.div_euclid(146_097);
    let day_of_era = shifted.rem_euclid(146_097);
    let year_of_era =
        (day_of_era - day_of_era / 1460 + day_of_era / 36_524 - day_of_era / 146_096) / 365;
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_line_is_timestamp_area_and_message() {
        assert_eq!(
            format_line(1_793_363_696_789, "voice", "hello"),
            "2026-10-30T12:34:56.789Z voice hello"
        );
    }

    #[test]
    fn the_epoch_and_a_leap_day_format_correctly() {
        assert_eq!(format_timestamp(0), "1970-01-01T00:00:00.000Z");
        assert_eq!(
            format_timestamp(1_709_164_800_000),
            "2024-02-29T00:00:00.000Z"
        );
    }

    #[test]
    fn a_message_never_spans_two_lines() {
        assert_eq!(
            format_line(0, "a", "one\ntwo\r\nthree"),
            "1970-01-01T00:00:00.000Z a one two  three"
        );
    }

    #[test]
    fn a_fallback_event_lists_reason_and_timings_only() {
        let event = DiagnosticEvent::NaturalVoiceFallback {
            reason: FallbackReason::GuardTimeout,
            phrase_chars: 34,
            guard_ms: 800,
            elapsed_ms: Some(812),
            is_first_phrase: true,
        };
        assert_eq!(
            event.to_string(),
            "natural voice fell back to the system voice: reason=guard_timeout phrase_chars=34 guard_ms=800 elapsed_ms=812 first_phrase=true"
        );
        assert_eq!(event.area(), "voice");
    }

    #[test]
    fn a_missing_elapsed_time_is_written_as_none() {
        let event = DiagnosticEvent::NaturalVoiceFallback {
            reason: FallbackReason::OutputFailedToOpen,
            phrase_chars: 0,
            guard_ms: 0,
            elapsed_ms: None,
            is_first_phrase: true,
        };
        assert!(event.to_string().contains("elapsed_ms=none"));
    }

    #[test]
    fn the_wire_format_is_snake_case_and_tagged() {
        let event: DiagnosticEvent = serde_json::from_str(
            r#"{"kind":"natural_voice_fallback","reason":"engine_busy","phrase_chars":5,"guard_ms":800,"elapsed_ms":null,"is_first_phrase":false}"#,
        )
        .expect("event");
        assert!(matches!(
            event,
            DiagnosticEvent::NaturalVoiceFallback {
                reason: FallbackReason::EngineBusy,
                elapsed_ms: None,
                ..
            }
        ));
    }
}
