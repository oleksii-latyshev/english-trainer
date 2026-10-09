use super::*;
use std::os::unix::fs::PermissionsExt;
use std::time::Instant;

fn helper(script: &str, index: u32) -> PathBuf {
    let path = std::env::temp_dir().join(format!(
        "english-trainer-translation-{}-{index}",
        std::process::id()
    ));
    std::fs::write(&path, format!("#!/bin/sh\n{script}\n")).unwrap();
    std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o700)).unwrap();
    path
}

fn request() -> TranslationRequest {
    TranslationRequest {
        word: "resilient".to_string(),
        context: "The system remained resilient.".to_string(),
    }
}

const SUCCESS: &str = "{\"word\":\"resilient\",\"native_language\":\"ru\",\"translation\":\"устойчивый\",\"english_explanation\":\"Able to recover quickly.\",\"explanation_error\":null}";

#[test]
fn fake_helper_validates_translation_and_rejects_oversized_stdout() {
    let success = helper(&format!("cat >/dev/null; printf '%s' '{SUCCESS}'"), 1);
    let service = TranslationService::new(Some(success.clone()));
    assert_eq!(
        service.translate(&request(), "ru").unwrap().translation,
        "устойчивый"
    );
    std::fs::remove_file(success).unwrap();

    let too_large = helper("cat >/dev/null; head -c 17000 /dev/zero | tr '\\000' x", 2);
    let service = TranslationService::new(Some(too_large.clone()));
    assert_eq!(
        service.translate(&request(), "ru").unwrap_err().code,
        TranslationErrorCode::InvalidOutput
    );
    std::fs::remove_file(too_large).unwrap();
}

#[test]
fn helper_status_and_typed_errors_are_parsed() {
    let status = helper(
        "cat >/dev/null; printf '%s' '{\"status\":\"installed\",\"message\":\"Languages are ready.\"}'",
        3,
    );
    let service = TranslationService::new(Some(status.clone()));
    let value = service.status("ru").unwrap();
    assert_eq!(value.native_language, "ru");
    assert_eq!(value.status, TranslationStatusKind::Installed);
    std::fs::remove_file(status).unwrap();

    let unsupported = helper(
        "cat >/dev/null; printf '%s' '{\"error\":{\"code\":\"unsupported_language\",\"message\":\"Choose a supported language.\"}}'",
        4,
    );
    let service = TranslationService::new(Some(unsupported.clone()));
    assert_eq!(
        service.status("ru").unwrap_err().code,
        TranslationErrorCode::UnsupportedLanguage
    );
    std::fs::remove_file(unsupported).unwrap();
}

#[test]
fn timeout_reaps_child_and_a_later_status_succeeds() {
    let path = helper("cat >/dev/null; exec sleep 2", 5);
    let service = TranslationService::new(Some(path.clone()));
    let started = Instant::now();
    let error = service
        .invoke("status", "ru", None, Duration::from_millis(50))
        .unwrap_err();
    assert_eq!(error.code, TranslationErrorCode::Timeout);
    assert!(started.elapsed() < Duration::from_secs(1));

    std::fs::write(
        &path,
        "#!/bin/sh\ncat >/dev/null; printf '%s' '{\"status\":\"installed\",\"message\":\"Languages are ready.\"}'\n",
    )
    .unwrap();
    assert_eq!(
        service.status("ru").unwrap().status,
        TranslationStatusKind::Installed
    );
    std::fs::remove_file(path).unwrap();
}

#[test]
fn active_helper_returns_busy_and_session_lock_stays_free() {
    let store = crate::conversation::SessionStore::default();
    store.start().unwrap();
    let prepared = store
        .prepare_translation_lookup(TranslationRequest {
            word: "resilient".to_string(),
            context: "The system remained resilient.".to_string(),
        })
        .unwrap();
    let marker = std::env::temp_dir().join(format!(
        "english-trainer-translation-started-{}",
        std::process::id()
    ));
    let script = format!(
        "touch {}; cat >/dev/null; sleep 1; printf '%s' '{SUCCESS}'",
        marker.display()
    );
    let helper = helper(&script, 6);
    let service = TranslationService::new(Some(helper.clone()));
    let busy_probe = service.clone();
    let request = prepared.request;
    let native_language = prepared.native_language;
    let operation = std::thread::spawn(move || service.translate(&request, &native_language));
    let deadline = Instant::now() + Duration::from_secs(1);
    while !marker.exists() && Instant::now() < deadline {
        std::thread::sleep(Duration::from_millis(5));
    }
    assert!(marker.exists(), "fake translation helper did not start");
    assert_eq!(
        busy_probe.status("ru").unwrap_err().code,
        TranslationErrorCode::Busy
    );
    let lock_check = Instant::now();
    assert_eq!(store.translation_settings().unwrap().native_language, "ru");
    assert!(lock_check.elapsed() < Duration::from_millis(500));
    assert_eq!(operation.join().unwrap().unwrap().translation, "устойчивый");
    std::fs::remove_file(helper).unwrap();
    let _ = std::fs::remove_file(marker);
}

#[test]
fn absent_bundle_is_actionably_unavailable() {
    let service = TranslationService::new(None);
    assert_eq!(
        service.status("ru").unwrap_err().code,
        TranslationErrorCode::Unavailable
    );
}

#[test]
#[ignore = "requires macOS 26+, installed English/Russian translation models, and Apple Intelligence"]
fn real_bundled_helper_translates_a_word_on_device() {
    let binary = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("binaries")
        .join("apple-translation");
    assert!(
        binary.is_file(),
        "build the bundled apple-translation helper before running this test"
    );
    let service = TranslationService::new(Some(binary));

    let status = service.status("ru").unwrap();
    assert_eq!(status.native_language, "ru");
    assert_eq!(status.status, TranslationStatusKind::Installed);

    let prepared = service.prepare("ru").unwrap();
    assert_eq!(prepared.native_language, "ru");
    assert_eq!(prepared.status, TranslationStatusKind::Installed);

    let result = service.translate(&request(), "ru").unwrap();
    assert_eq!(result.word, "resilient");
    assert_eq!(result.native_language, "ru");
    assert!(!result.translation.trim().is_empty());
    assert!(result
        .english_explanation
        .as_ref()
        .is_some_and(|explanation| !explanation.trim().is_empty()));
    assert!(result.explanation_error.is_none());
}
