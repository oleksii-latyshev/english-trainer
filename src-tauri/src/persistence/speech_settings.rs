use super::SessionDatabase;
use crate::audio::SpeechSettings;
use rusqlite::OptionalExtension;

impl SessionDatabase {
    pub fn speech_settings(&self) -> rusqlite::Result<SpeechSettings> {
        let stored = self
            .connection
            .query_row(
                "SELECT model_file, keep_raw_audio, live_transcript FROM speech_settings WHERE id = 1",
                [],
                |row| {
                    Ok(SpeechSettings {
                        model_file: row.get(0)?,
                        keep_raw_audio: row.get(1)?,
                        live_transcript: row.get(2)?,
                    })
                },
            )
            .optional()?;
        Ok(stored.unwrap_or_default())
    }

    pub fn save_speech_settings(&self, settings: &SpeechSettings) -> rusqlite::Result<()> {
        self.connection.execute(
            "INSERT INTO speech_settings(id, model_file, keep_raw_audio, live_transcript) VALUES(1, ?1, ?2, ?3)
             ON CONFLICT(id) DO UPDATE SET model_file = excluded.model_file,
                keep_raw_audio = excluded.keep_raw_audio, live_transcript = excluded.live_transcript",
            rusqlite::params![
                settings.model_file,
                settings.keep_raw_audio,
                settings.live_transcript
            ],
        )?;
        Ok(())
    }

    pub fn glossary_terms(&self) -> rusqlite::Result<Vec<String>> {
        let mut statement = self
            .connection
            .prepare("SELECT term FROM glossary_terms ORDER BY position")?;
        let rows = statement.query_map([], |row| row.get(0))?;
        rows.collect()
    }

    /// Replaces the whole list in one transaction, keeping the given order.
    pub fn replace_glossary_terms(&self, terms: &[String]) -> rusqlite::Result<()> {
        let transaction = self.connection.unchecked_transaction()?;
        transaction.execute("DELETE FROM glossary_terms", [])?;
        for (position, term) in terms.iter().enumerate() {
            transaction.execute(
                "INSERT INTO glossary_terms(position, term) VALUES(?1, ?2)",
                rusqlite::params![position as i64, term],
            )?;
        }
        transaction.commit()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::audio::SEED_GLOSSARY;

    #[test]
    fn settings_default_to_no_model_choice_with_raw_audio_discarded_and_live_text_on() {
        let db = SessionDatabase::open_in_memory().unwrap();
        let settings = db.speech_settings().unwrap();
        assert_eq!(settings.model_file, "");
        assert!(!settings.keep_raw_audio);
        assert!(settings.live_transcript);
    }

    #[test]
    fn settings_round_trip() {
        let db = SessionDatabase::open_in_memory().unwrap();
        let settings = SpeechSettings {
            model_file: "ggml-small.en.bin".into(),
            keep_raw_audio: true,
            live_transcript: false,
        };
        db.save_speech_settings(&settings).unwrap();
        assert_eq!(db.speech_settings().unwrap(), settings);
    }

    #[test]
    fn glossary_is_seeded_once_and_stays_edited() {
        let directory = crate::providers::agy::runner::ScratchDirectory::new().unwrap();
        let path = directory.path().join("glossary.sqlite3");
        let db = SessionDatabase::open(&path).unwrap();
        assert_eq!(db.glossary_terms().unwrap(), SEED_GLOSSARY);
        db.replace_glossary_terms(&["Tauri".into(), "Mirage".into()])
            .unwrap();
        drop(db);
        let db = SessionDatabase::open(&path).unwrap();
        assert_eq!(db.glossary_terms().unwrap(), ["Tauri", "Mirage"]);
        db.replace_glossary_terms(&[]).unwrap();
        drop(db);
        assert!(SessionDatabase::open(&path)
            .unwrap()
            .glossary_terms()
            .unwrap()
            .is_empty());
    }

    #[test]
    fn version_twelve_upgrades_with_the_seeded_glossary() {
        let directory = crate::providers::agy::runner::ScratchDirectory::new().unwrap();
        let path = directory.path().join("upgrade.sqlite3");
        let db = SessionDatabase::open(&path).unwrap();
        db.connection
            .execute_batch(
                "DROP TABLE speech_settings; DROP TABLE glossary_terms; PRAGMA user_version = 12;",
            )
            .unwrap();
        drop(db);
        let db = SessionDatabase::open(&path).unwrap();
        assert_eq!(db.glossary_terms().unwrap().len(), SEED_GLOSSARY.len());
        assert_eq!(db.speech_settings().unwrap(), SpeechSettings::default());
    }

    #[test]
    fn version_thirteen_forgets_the_old_base_default_but_keeps_other_choices() {
        let directory = crate::providers::agy::runner::ScratchDirectory::new().unwrap();
        for (stored, expected) in [
            ("ggml-base.en.bin", ""),
            ("ggml-small.en.bin", "ggml-small.en.bin"),
        ] {
            let path = directory.path().join(format!("{expected}-upgrade.sqlite3"));
            let db = SessionDatabase::open(&path).unwrap();
            db.connection
                .execute_batch(
                    "ALTER TABLE speech_settings DROP COLUMN live_transcript;
                     PRAGMA user_version = 13;",
                )
                .unwrap();
            db.connection
                .execute(
                    "INSERT INTO speech_settings(id, model_file, keep_raw_audio) VALUES(1, ?1, 1)",
                    [stored],
                )
                .unwrap();
            drop(db);
            let settings = SessionDatabase::open(&path)
                .unwrap()
                .speech_settings()
                .unwrap();
            assert_eq!(settings.model_file, expected);
            assert!(settings.keep_raw_audio);
            assert!(settings.live_transcript);
        }
    }
}
