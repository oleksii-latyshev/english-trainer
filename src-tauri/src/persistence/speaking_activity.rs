use super::SessionDatabase;

impl SessionDatabase {
    pub fn active_ms_by_day(&self, since_ms: i64) -> rusqlite::Result<Vec<(String, u64)>> {
        let mut statement = self.connection.prepare(
            "SELECT strftime('%Y-%m-%d', started_at / 1000, 'unixepoch', 'localtime') AS day,
                    SUM(COALESCE(active_duration_ms, 0))
             FROM sessions
             WHERE started_at >= ?1 AND COALESCE(practice_mode, 'voice') <> 'text_chat'
             GROUP BY day
             ORDER BY day",
        )?;
        let rows = statement.query_map([since_ms], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)?))
        })?;
        rows.map(|row| row.map(|(day, ms)| (day, u64::try_from(ms).unwrap_or(0))))
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const NOON_UTC_OCT_8: i64 = 1_791_460_800_000;
    const DAY_MS: i64 = 86_400_000;

    fn insert(db: &SessionDatabase, started_at: i64, active_ms: i64, mode: &str, ended: bool) {
        db.connection
            .execute(
                "INSERT INTO sessions (mode, scenario, started_at, ended_at, opening_question, active_duration_ms, practice_mode)
                 VALUES ('conversation', 'free', ?1, ?2, 'Q?', ?3, ?4)",
                rusqlite::params![started_at, ended.then_some(started_at + active_ms), active_ms, mode],
            )
            .unwrap();
    }

    #[test]
    fn sessions_of_one_day_are_summed_and_text_chat_is_left_out() {
        let db = SessionDatabase::open_in_memory().unwrap();
        insert(&db, NOON_UTC_OCT_8, 300_000, "voice", true);
        insert(
            &db,
            NOON_UTC_OCT_8 + 1_000,
            120_000,
            "write_then_speak",
            true,
        );
        insert(&db, NOON_UTC_OCT_8 + 2_000, 900_000, "text_chat", true);
        insert(&db, NOON_UTC_OCT_8 + DAY_MS, 60_000, "voice", false);

        let days = db.active_ms_by_day(NOON_UTC_OCT_8 - DAY_MS).unwrap();

        assert_eq!(days.len(), 2);
        assert_eq!(days[0].1, 420_000);
        assert_eq!(days[1].1, 60_000);
        assert!(days[0].0 < days[1].0);
    }

    #[test]
    fn sessions_before_the_window_are_ignored() {
        let db = SessionDatabase::open_in_memory().unwrap();
        insert(&db, NOON_UTC_OCT_8 - 2 * DAY_MS, 300_000, "voice", true);
        assert!(db.active_ms_by_day(NOON_UTC_OCT_8).unwrap().is_empty());
    }
}
