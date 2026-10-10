use super::SessionDatabase;
use crate::translation::{validate_native_language, NativeLanguageSettings, TranslationError};
use rusqlite::OptionalExtension;

impl SessionDatabase {
    pub fn translation_settings(&self) -> Result<NativeLanguageSettings, TranslationError> {
        let native_language = self
            .connection
            .query_row(
                "SELECT native_language FROM translation_settings WHERE id = 1",
                [],
                |row| row.get::<_, String>(0),
            )
            .optional()
            .map_err(|_| TranslationError::database())?
            .unwrap_or_else(|| "ru".to_string());
        validate_native_language(&native_language)?;
        Ok(NativeLanguageSettings { native_language })
    }

    pub fn save_translation_settings(
        &mut self,
        settings: NativeLanguageSettings,
    ) -> Result<NativeLanguageSettings, TranslationError> {
        validate_native_language(&settings.native_language)?;
        self.connection
            .execute(
                "INSERT INTO translation_settings (id, native_language) VALUES (1, ?1)
                 ON CONFLICT(id) DO UPDATE SET native_language = excluded.native_language",
                [&settings.native_language],
            )
            .map_err(|_| TranslationError::database())?;
        Ok(settings)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicUsize, Ordering};

    static NEXT_PATH: AtomicUsize = AtomicUsize::new(0);

    fn path() -> std::path::PathBuf {
        std::env::temp_dir().join(format!(
            "english-trainer-translation-settings-{}-{}.sqlite3",
            std::process::id(),
            NEXT_PATH.fetch_add(1, Ordering::Relaxed)
        ))
    }

    #[test]
    fn migrates_version_seventeen_additively_and_persists_allowlisted_choice() {
        let path = path();
        {
            let mut database = SessionDatabase::open(&path).unwrap();
            database.create_session("Existing question?").unwrap();
            database
                .connection
                .execute_batch("DROP TABLE translation_settings; PRAGMA user_version = 17;")
                .unwrap();
        }

        {
            let mut database = SessionDatabase::open(&path).unwrap();
            assert_eq!(
                database.translation_settings().unwrap().native_language,
                "ru"
            );
            let settings = NativeLanguageSettings {
                native_language: "de".to_string(),
            };
            database
                .save_translation_settings(settings.clone())
                .unwrap();
            assert_eq!(database.translation_settings().unwrap(), settings);
            let session = database.active_session().unwrap().unwrap();
            assert_eq!(session.opening_question, "Existing question?");
            assert_eq!(
                database
                    .connection
                    .pragma_query_value(None, "user_version", |row| row.get::<_, i64>(0))
                    .unwrap(),
                super::super::SCHEMA_VERSION
            );
        }

        let mut database = SessionDatabase::open(&path).unwrap();
        assert_eq!(
            database.translation_settings().unwrap().native_language,
            "de"
        );
        let invalid = database.save_translation_settings(NativeLanguageSettings {
            native_language: "en".to_string(),
        });
        assert_eq!(
            invalid.unwrap_err().code,
            crate::translation::TranslationErrorCode::UnsupportedLanguage
        );
        assert_eq!(
            database.translation_settings().unwrap().native_language,
            "de"
        );
        drop(database);
        let _ = std::fs::remove_file(path);
    }
}
