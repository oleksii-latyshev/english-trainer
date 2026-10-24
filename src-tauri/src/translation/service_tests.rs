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
        text: "take it for granted".to_string(),
        context: "Do not take it for granted.".to_string(),
    }
}

const TRANSLATION: &str = "{\"text\":\"take it for granted\",\"native_language\":\"ru\",\"translation\":\"принимать как должное\"}";
const EXPLANATION: &str =
    "{\"text\":\"take it for granted\",\"english_explanation\":\"To assume something will always be there.\"}";

fn answering(line: &str) -> String {
    format!("while read request; do printf '%s\\n' '{line}'; done")
}

#[test]
fn a_warm_helper_answers_many_requests_with_one_process() {
    let counter = std::env::temp_dir().join(format!(
        "english-trainer-translation-spawns-{}",
        std::process::id()
    ));
    let script = format!(
        "echo started >> '{}'; {}",
        counter.display(),
        answering(TRANSLATION)
    );
    let path = helper(&script, 1);
    let service = TranslationService::new(Some(path.clone()));
    for _ in 0..3 {
        let translation = service.translate(&request(), "ru").unwrap();
        assert_eq!(translation.translation, "принимать как должное");
    }
    let spawns = std::fs::read_to_string(&counter).unwrap();
    assert_eq!(spawns.lines().count(), 1);
    std::fs::remove_file(path).unwrap();
    std::fs::remove_file(counter).unwrap();
}

#[test]
fn the_explanation_runs_on_its_own_helper_and_never_waits_for_the_translation() {
    let slow = helper(&format!("sleep 1; {}", answering(TRANSLATION)), 2);
    let service = TranslationService::new(Some(slow.clone()));
    let started = Instant::now();
    let explanation_helper = helper(&answering(EXPLANATION), 3);
    let fast = TranslationService::new(Some(explanation_helper.clone()));
    let pending = std::thread::spawn({
        let service = service.clone();
        move || service.translate(&request(), "ru")
    });
    let explanation = fast.explain(&request(), "ru").unwrap();
    assert!(started.elapsed() < Duration::from_millis(900));
    assert_eq!(
        explanation.english_explanation,
        "To assume something will always be there."
    );
    assert!(pending.join().unwrap().is_ok());
    std::fs::remove_file(slow).unwrap();
    std::fs::remove_file(explanation_helper).unwrap();
}

#[test]
fn a_crashed_helper_is_replaced_on_the_next_request() {
    let marker = std::env::temp_dir().join(format!(
        "english-trainer-translation-crash-{}",
        std::process::id()
    ));
    let script = format!(
        "if [ -e '{marker}' ]; then {answer}; else touch '{marker}'; read request; exit 1; fi",
        marker = marker.display(),
        answer = answering(TRANSLATION)
    );
    let path = helper(&script, 4);
    let service = TranslationService::new(Some(path.clone()));
    assert_eq!(
        service.translate(&request(), "ru").unwrap_err().code,
        TranslationErrorCode::ProcessFailed
    );
    assert!(service.translate(&request(), "ru").is_ok());
    std::fs::remove_file(path).unwrap();
    std::fs::remove_file(marker).unwrap();
}

#[test]
fn a_timed_out_helper_is_killed_and_the_next_request_starts_a_fresh_one() {
    let script = format!(
        "while read request; do case \"$request\" in *hang*) sleep 5;; *) printf '%s\\n' '{TRANSLATION}';; esac; done"
    );
    let path = helper(&script, 5);
    let worker = WarmWorker::new(Some(path.clone()), "translate");
    let request = |text| HelperRequest {
        operation: "translate",
        native_language: "ru",
        text,
        context: "",
    };
    let started = Instant::now();
    assert_eq!(
        worker
            .call(&request("hang"), Duration::from_millis(300))
            .unwrap_err()
            .code,
        TranslationErrorCode::Timeout
    );
    assert!(started.elapsed() < Duration::from_secs(3));
    assert!(worker
        .call(&request("Hello"), Duration::from_secs(5))
        .is_ok());
    std::fs::remove_file(path).unwrap();
}

#[test]
fn helper_failures_keep_their_code_and_invalid_answers_are_rejected() {
    let unsupported = helper(
        &answering(
            "{\"error\":{\"code\":\"download_required\",\"message\":\"Prepare the languages.\"}}",
        ),
        6,
    );
    let service = TranslationService::new(Some(unsupported.clone()));
    let error = service.translate(&request(), "ru").unwrap_err();
    assert_eq!(error.code, TranslationErrorCode::DownloadRequired);
    assert_eq!(error.message, "Prepare the languages.");
    std::fs::remove_file(unsupported).unwrap();

    let other_text = helper(
        &answering("{\"text\":\"other\",\"native_language\":\"ru\",\"translation\":\"другое\"}"),
        7,
    );
    let service = TranslationService::new(Some(other_text.clone()));
    assert_eq!(
        service.translate(&request(), "ru").unwrap_err().code,
        TranslationErrorCode::InvalidOutput
    );
    std::fs::remove_file(other_text).unwrap();

    let oversized = helper(
        "while read request; do head -c 17000 /dev/zero | tr '\\000' x; echo; done",
        8,
    );
    let service = TranslationService::new(Some(oversized.clone()));
    assert_eq!(
        service.translate(&request(), "ru").unwrap_err().code,
        TranslationErrorCode::ProcessFailed
    );
    std::fs::remove_file(oversized).unwrap();
}

#[test]
fn helper_status_and_typed_errors_are_parsed() {
    let status = helper(
        "cat >/dev/null; printf '%s' '{\"status\":\"installed\",\"message\":\"Languages are ready.\"}'",
        9,
    );
    let service = TranslationService::new(Some(status.clone()));
    let value = service.status("ru").unwrap();
    assert_eq!(value.native_language, "ru");
    assert_eq!(value.status, TranslationStatusKind::Installed);
    std::fs::remove_file(status).unwrap();

    let unsupported = helper(
        "cat >/dev/null; printf '%s' '{\"error\":{\"code\":\"unsupported_language\",\"message\":\"Choose a supported language.\"}}'",
        10,
    );
    let service = TranslationService::new(Some(unsupported.clone()));
    assert_eq!(
        service.status("ru").unwrap_err().code,
        TranslationErrorCode::UnsupportedLanguage
    );
    std::fs::remove_file(unsupported).unwrap();
}

#[test]
fn status_timeout_reaps_child_and_a_later_status_succeeds() {
    let path = helper("cat >/dev/null; exec sleep 2", 11);
    let service = TranslationService::new(Some(path.clone()));
    let started = Instant::now();
    let error = service
        .invoke("status", "ru", Duration::from_millis(50))
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
fn a_running_status_check_returns_busy_and_the_session_lock_stays_free() {
    let store = crate::conversation::SessionStore::default();
    store.start().unwrap();
    let prepared = store.prepare_translation_lookup(request()).unwrap();
    assert_eq!(prepared.request.text, "take it for granted");
    let marker = std::env::temp_dir().join(format!(
        "english-trainer-translation-started-{}",
        std::process::id()
    ));
    let release = marker.with_extension("release");
    let script = format!(
        "touch '{}'; cat >/dev/null; while [ ! -e '{}' ]; do sleep 0.02; done; printf '%s' '{{\"status\":\"installed\",\"message\":\"Languages are ready.\"}}'",
        marker.display(),
        release.display()
    );
    let helper = helper(&script, 12);
    let service = TranslationService::new(Some(helper.clone()));
    let busy_probe = service.clone();
    let operation = std::thread::spawn(move || service.status("ru"));
    let deadline = Instant::now() + Duration::from_secs(5);
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
    std::fs::write(&release, "continue").unwrap();
    assert!(operation.join().unwrap().is_ok());
    std::fs::remove_file(helper).unwrap();
    std::fs::remove_file(marker).unwrap();
    std::fs::remove_file(release).unwrap();
}

#[test]
fn absent_bundle_is_actionably_unavailable() {
    let service = TranslationService::new(None);
    assert_eq!(
        service.status("ru").unwrap_err().code,
        TranslationErrorCode::Unavailable
    );
    assert_eq!(
        service.translate(&request(), "ru").unwrap_err().code,
        TranslationErrorCode::Unavailable
    );
}

#[test]
#[ignore = "requires macOS 26+, installed English/Russian translation models, and Apple Intelligence"]
fn real_bundled_helper_translates_and_explains_a_phrase_on_device() {
    let binary = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("binaries")
        .join("apple-translation");
    assert!(
        binary.is_file(),
        "build the bundled apple-translation helper before running this test"
    );
    let service = TranslationService::new(Some(binary));

    let status = service.status("ru").unwrap();
    assert_eq!(status.status, TranslationStatusKind::Installed);

    let cold = Instant::now();
    let translation = service.translate(&request(), "ru").unwrap();
    let cold = cold.elapsed();
    assert!(!translation.translation.trim().is_empty());
    let warm = Instant::now();
    service.translate(&request(), "ru").unwrap();
    let warm = warm.elapsed();
    assert!(warm < Duration::from_secs(1), "warm lookup took {warm:?}");
    println!("cold translate {cold:?}, warm translate {warm:?}");

    let explanation = service.explain(&request(), "ru").unwrap();
    assert!(!explanation.english_explanation.trim().is_empty());
}
