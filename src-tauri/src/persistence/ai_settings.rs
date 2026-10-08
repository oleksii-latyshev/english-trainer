use super::SessionDatabase;
use crate::providers::AiSettings;
use rusqlite::OptionalExtension;

impl SessionDatabase {
    pub fn ai_settings(&self) -> rusqlite::Result<AiSettings> {
        let stored: Option<String> = self
            .connection
            .query_row(
                "SELECT settings_json FROM ai_settings WHERE id = 1",
                [],
                |row| row.get(0),
            )
            .optional()?;
        match stored {
            None => Ok(AiSettings::default()),
            Some(json) => serde_json::from_str(&json).map_err(|error| {
                rusqlite::Error::FromSqlConversionFailure(
                    0,
                    rusqlite::types::Type::Text,
                    Box::new(error),
                )
            }),
        }
    }

    pub fn save_ai_settings(&self, settings: &AiSettings) -> rusqlite::Result<()> {
        let json = serde_json::to_string(settings)
            .map_err(|error| rusqlite::Error::ToSqlConversionFailure(Box::new(error)))?;
        self.connection.execute("INSERT INTO ai_settings(id, settings_json) VALUES(1, ?1) ON CONFLICT(id) DO UPDATE SET settings_json = excluded.settings_json", [json])?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::providers::{AgyModel, ConversationProvider, EvaStyle};

    #[test]
    fn settings_default_and_round_trip_without_changing_sessions() {
        let db = SessionDatabase::open_in_memory().unwrap();
        assert_eq!(db.ai_settings().unwrap(), AiSettings::default());
        let settings = AiSettings {
            provider: ConversationProvider::Apple,
            agy_model: AgyModel::FlashLow,
            eva_style: EvaStyle::ShortAndSimple,
        };
        db.save_ai_settings(&settings).unwrap();
        assert_eq!(db.ai_settings().unwrap(), settings);
        assert!(serde_json::from_str::<AiSettings>(
            r#"{"provider":"unknown","agy_model":"default"}"#
        )
        .is_err());
        assert!(serde_json::from_str::<AiSettings>(
            r#"{"provider":"agy","agy_model":"arbitrary"}"#
        )
        .is_err());
    }
    #[test]
    fn settings_saved_before_the_style_existed_read_as_natural() {
        let db = SessionDatabase::open_in_memory().unwrap();
        db.connection
            .execute(
                "INSERT INTO ai_settings(id, settings_json) VALUES(1, ?1)",
                [r#"{"provider":"apple","agy_model":"default"}"#],
            )
            .unwrap();
        let settings = db.ai_settings().unwrap();
        assert_eq!(settings.provider, ConversationProvider::Apple);
        assert_eq!(settings.eva_style, EvaStyle::Natural);
        assert!(serde_json::from_str::<AiSettings>(
            r#"{"provider":"apple","agy_model":"default","eva_style":"chatty"}"#
        )
        .is_err());
    }

    #[test]
    fn version_six_migrates_and_settings_survive_reopening() {
        let directory = crate::providers::agy::runner::ScratchDirectory::new().unwrap();
        let path = directory.path().join("settings.sqlite3");
        let db = SessionDatabase::open(&path).unwrap();
        db.connection
            .execute_batch("DROP TABLE ai_settings; PRAGMA user_version = 6;")
            .unwrap();
        drop(db);
        let db = SessionDatabase::open(&path).unwrap();
        assert_eq!(db.ai_settings().unwrap(), AiSettings::default());
        let settings = AiSettings {
            provider: ConversationProvider::Apple,
            agy_model: AgyModel::FlashHigh,
            eva_style: EvaStyle::Natural,
        };
        db.save_ai_settings(&settings).unwrap();
        drop(db);
        assert_eq!(
            SessionDatabase::open(&path).unwrap().ai_settings().unwrap(),
            settings
        );
    }
}
