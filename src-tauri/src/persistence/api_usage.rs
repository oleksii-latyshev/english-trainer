use super::SessionDatabase;
use crate::api_usage::{
    next_pacific_midnight_ms, pacific_day, AntigravityUsage, ApiUsageOverview, GeminiUsage,
    LimitNote, ModelRequests, UsageEvent, UsageSource,
};
use rusqlite::{params, OptionalExtension};

/// Counts older than this many days are dropped; only today's are ever shown.
const KEEP_DAYS: i64 = 14;
const DAY_MS: i64 = 86_400_000;

impl SessionDatabase {
    pub fn record_api_usage(&self, event: &UsageEvent) -> rusqlite::Result<()> {
        match event {
            UsageEvent::Request {
                source,
                model,
                at_ms,
            } => {
                self.connection.execute(
                    "INSERT INTO api_usage_days(day, source, model, requests) VALUES(?1, ?2, ?3, 1)
                     ON CONFLICT(day, source, model) DO UPDATE SET requests = requests + 1",
                    params![pacific_day(*at_ms), source.as_str(), model],
                )?;
                self.connection.execute(
                    "DELETE FROM api_usage_days WHERE day < ?1",
                    [pacific_day(at_ms.saturating_sub(KEEP_DAYS * DAY_MS))],
                )?;
            }
            UsageEvent::Limited {
                source,
                model,
                message,
                resets_at_ms,
                at_ms,
            } => {
                self.connection.execute(
                    "INSERT INTO api_usage_last_limit(source, occurred_at_ms, model, message, resets_at_ms)
                     VALUES(?1, ?2, ?3, ?4, ?5)
                     ON CONFLICT(source) DO UPDATE SET occurred_at_ms = excluded.occurred_at_ms,
                       model = excluded.model, message = excluded.message, resets_at_ms = excluded.resets_at_ms",
                    params![source.as_str(), at_ms, model, message, resets_at_ms],
                )?;
            }
        }
        Ok(())
    }

    /// Today's counts (Pacific date of `now_ms`) and the last limit errors.
    pub fn api_usage_overview(&self, now_ms: i64) -> rusqlite::Result<ApiUsageOverview> {
        let day = pacific_day(now_ms);
        let mut statement = self.connection.prepare(
            "SELECT source, model, requests FROM api_usage_days WHERE day = ?1 ORDER BY requests DESC, model",
        )?;
        let rows = statement
            .query_map([&day], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, i64>(2)?,
                ))
            })?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        let count = |value: i64| u64::try_from(value).unwrap_or(0);
        let models = rows
            .iter()
            .filter(|(source, _, _)| source == UsageSource::Gemini.as_str())
            .map(|(_, model, requests)| ModelRequests {
                model: model.clone(),
                requests: count(*requests),
            })
            .collect();
        let requests_today = rows
            .iter()
            .filter(|(source, _, _)| source == UsageSource::Antigravity.as_str())
            .map(|(_, _, requests)| count(*requests))
            .sum();
        let gemini_limit = self
            .last_limit(UsageSource::Gemini)?
            .filter(|note| pacific_day(note.occurred_at_ms) == day);
        Ok(ApiUsageOverview {
            day,
            gemini: GeminiUsage {
                models,
                last_limit: gemini_limit,
                resets_at_ms: next_pacific_midnight_ms(now_ms),
            },
            antigravity: AntigravityUsage {
                requests_today,
                last_quota_error: self.last_limit(UsageSource::Antigravity)?,
            },
        })
    }

    fn last_limit(&self, source: UsageSource) -> rusqlite::Result<Option<LimitNote>> {
        self.connection
            .query_row(
                "SELECT occurred_at_ms, model, message, resets_at_ms FROM api_usage_last_limit WHERE source = ?1",
                [source.as_str()],
                |row| {
                    Ok(LimitNote {
                        occurred_at_ms: row.get(0)?,
                        model: row.get(1)?,
                        message: row.get(2)?,
                        resets_at_ms: row.get(3)?,
                    })
                },
            )
            .optional()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // 2027-01-15 20:00 UTC is 12:00 PST on the 15th.
    const NOON_PST: i64 = 1_800_043_200_000;
    const HOUR_MS: i64 = 3_600_000;

    fn request(source: UsageSource, model: &str, at_ms: i64) -> UsageEvent {
        UsageEvent::Request {
            source,
            model: model.into(),
            at_ms,
        }
    }

    fn limited(
        source: UsageSource,
        message: &str,
        at_ms: i64,
        resets_at_ms: Option<i64>,
    ) -> UsageEvent {
        UsageEvent::Limited {
            source,
            model: "m".into(),
            message: message.into(),
            resets_at_ms,
            at_ms,
        }
    }

    #[test]
    fn requests_are_counted_per_model_and_start_over_at_pacific_midnight() {
        let db = SessionDatabase::open_in_memory().unwrap();
        assert_eq!(pacific_day(NOON_PST), "2027-01-15");
        for _ in 0..3 {
            db.record_api_usage(&request(
                UsageSource::Gemini,
                "gemini-3.5-flash-lite",
                NOON_PST,
            ))
            .unwrap();
        }
        db.record_api_usage(&request(UsageSource::Gemini, "gemini-3.5-flash", NOON_PST))
            .unwrap();
        db.record_api_usage(&request(
            UsageSource::Antigravity,
            "gemini-3.8-flash-medium",
            NOON_PST,
        ))
        .unwrap();
        let today = db.api_usage_overview(NOON_PST).unwrap();
        assert_eq!(today.day, "2027-01-15");
        assert_eq!(
            today.gemini.models,
            [
                ModelRequests {
                    model: "gemini-3.5-flash-lite".into(),
                    requests: 3
                },
                ModelRequests {
                    model: "gemini-3.5-flash".into(),
                    requests: 1
                },
            ]
        );
        assert_eq!(today.antigravity.requests_today, 1);

        // One minute before Pacific midnight the count still stands; one minute after it is empty.
        let midnight = today.gemini.resets_at_ms;
        assert_eq!(midnight - NOON_PST, 12 * HOUR_MS);
        let before = db.api_usage_overview(midnight - 60_000).unwrap();
        assert_eq!(before.gemini.models.len(), 2);
        let after = db.api_usage_overview(midnight + 60_000).unwrap();
        assert_eq!(after.day, "2027-01-16");
        assert!(after.gemini.models.is_empty());
        assert_eq!(after.antigravity.requests_today, 0);

        // A request sent just after midnight counts for the new day only.
        db.record_api_usage(&request(
            UsageSource::Gemini,
            "gemini-3.5-flash-lite",
            midnight + 1_000,
        ))
        .unwrap();
        assert_eq!(
            db.api_usage_overview(midnight + 60_000)
                .unwrap()
                .gemini
                .models[0]
                .requests,
            1
        );
        assert_eq!(
            db.api_usage_overview(NOON_PST).unwrap().gemini.models[0].requests,
            3
        );
    }

    #[test]
    fn a_gemini_limit_error_shows_only_on_the_day_it_happened() {
        let db = SessionDatabase::open_in_memory().unwrap();
        assert!(db
            .api_usage_overview(NOON_PST)
            .unwrap()
            .gemini
            .last_limit
            .is_none());
        db.record_api_usage(&limited(
            UsageSource::Gemini,
            "first",
            NOON_PST - HOUR_MS,
            None,
        ))
        .unwrap();
        db.record_api_usage(&limited(UsageSource::Gemini, "second", NOON_PST, None))
            .unwrap();
        let note = db
            .api_usage_overview(NOON_PST)
            .unwrap()
            .gemini
            .last_limit
            .unwrap();
        assert_eq!(
            (note.message.as_str(), note.occurred_at_ms),
            ("second", NOON_PST)
        );
        let tomorrow = db.api_usage_overview(NOON_PST + 24 * HOUR_MS).unwrap();
        assert!(tomorrow.gemini.last_limit.is_none());
    }

    #[test]
    fn the_last_antigravity_quota_error_keeps_its_reset_time() {
        let db = SessionDatabase::open_in_memory().unwrap();
        let resets_at = NOON_PST + 17_093_000;
        db.record_api_usage(&limited(
            UsageSource::Antigravity,
            "429 RESOURCE_EXHAUSTED",
            NOON_PST,
            Some(resets_at),
        ))
        .unwrap();
        let note = db
            .api_usage_overview(NOON_PST + HOUR_MS)
            .unwrap()
            .antigravity
            .last_quota_error
            .unwrap();
        assert_eq!(note.resets_at_ms, Some(resets_at));
        assert_eq!(note.message, "429 RESOURCE_EXHAUSTED");
    }

    #[test]
    fn old_days_are_dropped_and_counts_survive_reopening() {
        let directory = crate::providers::agy::runner::ScratchDirectory::new().unwrap();
        let path = directory.path().join("usage.sqlite3");
        let db = SessionDatabase::open(&path).unwrap();
        db.record_api_usage(&request(UsageSource::Gemini, "a", NOON_PST - 30 * DAY_MS))
            .unwrap();
        db.record_api_usage(&request(UsageSource::Gemini, "a", NOON_PST))
            .unwrap();
        let old_rows: i64 = db
            .connection
            .query_row("SELECT COUNT(*) FROM api_usage_days", [], |row| row.get(0))
            .unwrap();
        assert_eq!(old_rows, 1);
        drop(db);
        let db = SessionDatabase::open(&path).unwrap();
        assert_eq!(
            db.api_usage_overview(NOON_PST).unwrap().gemini.models[0].requests,
            1
        );
    }

    #[test]
    fn a_database_from_before_version_twelve_gets_the_tables() {
        let directory = crate::providers::agy::runner::ScratchDirectory::new().unwrap();
        let path = directory.path().join("old.sqlite3");
        let db = SessionDatabase::open(&path).unwrap();
        db.connection
            .execute_batch("DROP TABLE api_usage_days; DROP TABLE api_usage_last_limit; PRAGMA user_version = 11;")
            .unwrap();
        drop(db);
        let db = SessionDatabase::open(&path).unwrap();
        db.record_api_usage(&request(UsageSource::Gemini, "a", NOON_PST))
            .unwrap();
        assert_eq!(
            db.api_usage_overview(NOON_PST).unwrap().gemini.models.len(),
            1
        );
    }
}
