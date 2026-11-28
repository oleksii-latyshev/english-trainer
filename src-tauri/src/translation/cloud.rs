//! Translation without the Apple helper: the local cache first, then a primary translator, and a
//! fallback translator only when the primary reports that its quota or rate limit is used up.

use super::domain::{validate_translation, TextTranslation, TranslationError, TranslationRequest};
use std::sync::Arc;

pub trait TranslationCache: Send + Sync {
    fn find(&self, text: &str, native_language: &str) -> Option<String>;
    fn save(&self, text: &str, native_language: &str, translation: &str);
}

pub enum CloudFailure {
    Limited,
    Failed(TranslationError),
}

pub trait PhraseTranslator: Send + Sync {
    fn translate(
        &self,
        request: &TranslationRequest,
        native_language: &str,
    ) -> Result<String, CloudFailure>;
}

#[derive(Clone)]
pub struct CloudTranslation {
    cache: Arc<dyn TranslationCache>,
    primary: Arc<dyn PhraseTranslator>,
    fallback: Arc<dyn PhraseTranslator>,
}

impl CloudTranslation {
    pub fn new(
        cache: impl TranslationCache + 'static,
        primary: impl PhraseTranslator + 'static,
        fallback: impl PhraseTranslator + 'static,
    ) -> Self {
        Self {
            cache: Arc::new(cache),
            primary: Arc::new(primary),
            fallback: Arc::new(fallback),
        }
    }

    pub fn translate(
        &self,
        request: &TranslationRequest,
        native_language: &str,
    ) -> Result<TextTranslation, TranslationError> {
        let key = cache_key(&request.text);
        let answer = |translation: String| {
            validate_translation(
                TextTranslation {
                    text: request.text.clone(),
                    native_language: native_language.to_string(),
                    translation,
                },
                request,
                native_language,
            )
        };
        if let Some(cached) = self.cache.find(&key, native_language) {
            return answer(cached);
        }
        let fresh = answer(self.ask(request, native_language)?)?;
        self.cache.save(&key, native_language, &fresh.translation);
        Ok(fresh)
    }

    fn ask(
        &self,
        request: &TranslationRequest,
        native_language: &str,
    ) -> Result<String, TranslationError> {
        match self.primary.translate(request, native_language) {
            Ok(translation) => Ok(translation),
            Err(CloudFailure::Failed(error)) => Err(error),
            Err(CloudFailure::Limited) => self
                .fallback
                .translate(request, native_language)
                .map_err(|failure| match failure {
                    CloudFailure::Failed(error) => error,
                    CloudFailure::Limited => TranslationError::new(
                        super::domain::TranslationErrorCode::Unavailable,
                        "Translation is rate limited right now. Wait a minute and retry.",
                    ),
                }),
        }
    }
}

fn cache_key(text: &str) -> String {
    text.to_lowercase()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::translation::TranslationErrorCode;
    use std::collections::HashMap;
    use std::sync::Mutex;

    #[derive(Clone, Default)]
    struct MemoryCache(Arc<Mutex<HashMap<(String, String), String>>>);

    impl TranslationCache for MemoryCache {
        fn find(&self, text: &str, native_language: &str) -> Option<String> {
            self.0
                .lock()
                .unwrap()
                .get(&(text.to_string(), native_language.to_string()))
                .cloned()
        }

        fn save(&self, text: &str, native_language: &str, translation: &str) {
            self.0.lock().unwrap().insert(
                (text.to_string(), native_language.to_string()),
                translation.to_string(),
            );
        }
    }

    #[derive(Clone)]
    struct Scripted {
        calls: Arc<Mutex<usize>>,
        answer: Arc<dyn Fn() -> Result<String, CloudFailure> + Send + Sync>,
    }

    impl Scripted {
        fn new(answer: impl Fn() -> Result<String, CloudFailure> + Send + Sync + 'static) -> Self {
            Self {
                calls: Arc::new(Mutex::new(0)),
                answer: Arc::new(answer),
            }
        }

        fn says(text: &'static str) -> Self {
            Self::new(move || Ok(text.to_string()))
        }

        fn limited() -> Self {
            Self::new(|| Err(CloudFailure::Limited))
        }

        fn calls(&self) -> usize {
            *self.calls.lock().unwrap()
        }
    }

    impl PhraseTranslator for Scripted {
        fn translate(&self, _: &TranslationRequest, _: &str) -> Result<String, CloudFailure> {
            *self.calls.lock().unwrap() += 1;
            (self.answer)()
        }
    }

    fn request(text: &str) -> TranslationRequest {
        TranslationRequest {
            text: text.to_string(),
            context: String::new(),
        }
    }

    #[test]
    fn gemini_answers_and_the_result_is_cached() {
        let primary = Scripted::says("грант");
        let fallback = Scripted::says("claude");
        let cache = MemoryCache::default();
        let cloud = CloudTranslation::new(cache.clone(), primary.clone(), fallback.clone());
        let answer = cloud.translate(&request("Grant"), "ru").unwrap();
        assert_eq!(answer.translation, "грант");
        assert_eq!(answer.text, "Grant");
        assert_eq!(cache.find("grant", "ru").as_deref(), Some("грант"));
        assert_eq!(fallback.calls(), 0);
    }

    #[test]
    fn a_cached_translation_is_never_requested_again() {
        let primary = Scripted::says("грант");
        let cloud = CloudTranslation::new(
            MemoryCache::default(),
            primary.clone(),
            Scripted::says("claude"),
        );
        cloud.translate(&request("grant"), "ru").unwrap();
        let again = cloud.translate(&request("GRANT"), "ru").unwrap();
        assert_eq!(again.translation, "грант");
        assert_eq!(primary.calls(), 1);
        cloud.translate(&request("grant"), "de").unwrap();
        assert_eq!(primary.calls(), 2);
    }

    #[test]
    fn a_quota_error_falls_back_to_claude_and_caches_its_answer() {
        let primary = Scripted::limited();
        let fallback = Scripted::says("грант");
        let cache = MemoryCache::default();
        let cloud = CloudTranslation::new(cache.clone(), primary.clone(), fallback.clone());
        let answer = cloud.translate(&request("grant"), "ru").unwrap();
        assert_eq!(answer.translation, "грант");
        assert_eq!((primary.calls(), fallback.calls()), (1, 1));
        assert_eq!(cache.find("grant", "ru").as_deref(), Some("грант"));
    }

    #[test]
    fn other_gemini_failures_do_not_use_claude_and_are_not_cached() {
        let primary = Scripted::new(|| {
            Err(CloudFailure::Failed(TranslationError::new(
                TranslationErrorCode::Unavailable,
                "Could not reach Gemini.",
            )))
        });
        let fallback = Scripted::says("claude");
        let cache = MemoryCache::default();
        let cloud = CloudTranslation::new(cache.clone(), primary, fallback.clone());
        let error = cloud.translate(&request("grant"), "ru").unwrap_err();
        assert_eq!(error.code, TranslationErrorCode::Unavailable);
        assert_eq!(fallback.calls(), 0);
        assert_eq!(cache.find("grant", "ru"), None);
    }

    #[test]
    fn both_translators_limited_is_a_retryable_error() {
        let cloud = CloudTranslation::new(
            MemoryCache::default(),
            Scripted::limited(),
            Scripted::limited(),
        );
        let error = cloud.translate(&request("grant"), "ru").unwrap_err();
        assert_eq!(error.code, TranslationErrorCode::Unavailable);
    }

    #[test]
    fn a_blank_translation_is_rejected_and_not_cached() {
        let cache = MemoryCache::default();
        let cloud = CloudTranslation::new(
            cache.clone(),
            Scripted::says("  "),
            Scripted::says("claude"),
        );
        let error = cloud.translate(&request("grant"), "ru").unwrap_err();
        assert_eq!(error.code, TranslationErrorCode::InvalidOutput);
        assert_eq!(cache.find("grant", "ru"), None);
    }
}
