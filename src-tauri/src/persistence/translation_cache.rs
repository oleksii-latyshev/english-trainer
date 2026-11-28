use super::SessionDatabase;
use crate::translation::TranslationError;
use rusqlite::OptionalExtension;

impl SessionDatabase {
    pub fn cached_translation(
        &self,
        text: &str,
        native_language: &str,
    ) -> Result<Option<String>, TranslationError> {
        self.connection
            .query_row(
                "SELECT translation FROM translation_cache WHERE text = ?1 AND native_language = ?2",
                [text, native_language],
                |row| row.get::<_, String>(0),
            )
            .optional()
            .map_err(|_| TranslationError::database())
    }

    pub fn store_translation(
        &self,
        text: &str,
        native_language: &str,
        translation: &str,
        created_at_ms: i64,
    ) -> Result<(), TranslationError> {
        self.connection
            .execute(
                "INSERT INTO translation_cache (text, native_language, translation, created_at_ms)
                 VALUES (?1, ?2, ?3, ?4)
                 ON CONFLICT(text, native_language) DO UPDATE SET
                    translation = excluded.translation, created_at_ms = excluded.created_at_ms",
                rusqlite::params![text, native_language, translation, created_at_ms],
            )
            .map(|_| ())
            .map_err(|_| TranslationError::database())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_stored_translation_is_found_per_text_and_language_and_survives_reopening() {
        let path = std::env::temp_dir().join(format!(
            "english-trainer-translation-cache-{}.sqlite3",
            std::process::id()
        ));
        {
            let database = SessionDatabase::open(&path).unwrap();
            assert_eq!(database.cached_translation("grant", "ru").unwrap(), None);
            database.store_translation("grant", "ru", "дар", 1).unwrap();
            database
                .store_translation("grant", "de", "Zuschuss", 2)
                .unwrap();
            database
                .store_translation("grant", "ru", "грант", 3)
                .unwrap();
        }
        let database = SessionDatabase::open(&path).unwrap();
        assert_eq!(
            database
                .cached_translation("grant", "ru")
                .unwrap()
                .as_deref(),
            Some("грант")
        );
        assert_eq!(
            database
                .cached_translation("grant", "de")
                .unwrap()
                .as_deref(),
            Some("Zuschuss")
        );
        assert_eq!(database.cached_translation("grant", "fr").unwrap(), None);
        drop(database);
        let _ = std::fs::remove_file(path);
    }
}
