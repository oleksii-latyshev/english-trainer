use super::{
    domain::{
        valid_wav, AnswerContext, CheckRecording, KeptRecordings, ServerState, ServerStatus,
        SettingsChange, SpeechCheckResults, SpeechModel, SpeechSettings, Transcript,
    },
    error::SpeechRecognitionError,
    ports::{
        GlossaryStore, ModelCatalog, OneOffTranscriber, PortResult, PracticeConversation,
        RecordingVault, SettingsStore, SpeechCheckStore, TranscriptionEngine,
    },
    service::{SpeechRecognitionPorts, SpeechRecognitionService},
};
use std::{
    path::{Path, PathBuf},
    sync::{Arc, Mutex},
};

#[derive(Default)]
struct EngineCalls {
    transcribed: Vec<(String, Option<String>)>,
    partials: usize,
    rescues: usize,
    warmed: Vec<String>,
}

#[derive(Default)]
struct FakeEngine {
    calls: Mutex<EngineCalls>,
    rescue_text: Mutex<Option<String>>,
}

fn file_name(path: &Path) -> String {
    path.file_name()
        .map(|name| name.to_string_lossy().into_owned())
        .unwrap_or_default()
}

impl TranscriptionEngine for FakeEngine {
    fn warm(&self, model: &Path) {
        self.calls.lock().unwrap().warmed.push(file_name(model));
    }

    fn transcribe(
        &self,
        _wav: Vec<u8>,
        model: &Path,
        prompt: Option<&str>,
    ) -> PortResult<Transcript> {
        self.calls
            .lock()
            .unwrap()
            .transcribed
            .push((file_name(model), prompt.map(str::to_string)));
        Ok(Transcript::english("hello".into(), 1))
    }

    fn transcribe_partial(&self, _: &Path, _: &[u8], _: Option<&str>) -> Option<String> {
        self.calls.lock().unwrap().partials += 1;
        Some("hel".into())
    }

    fn transcribe_rescue(&self, _: &Path, _: &[u8], _: Option<&str>) -> Option<String> {
        self.calls.lock().unwrap().rescues += 1;
        self.rescue_text.lock().unwrap().clone()
    }

    fn status(&self) -> ServerStatus {
        ServerStatus {
            state: ServerState::Ready,
            failure: None,
        }
    }

    fn shutdown(&self) {}
}

#[derive(Default)]
struct FakeSettings {
    stored: Mutex<SpeechSettings>,
}

impl SettingsStore for FakeSettings {
    fn load(&self) -> PortResult<SpeechSettings> {
        Ok(self.stored.lock().unwrap().clone())
    }

    fn apply(&self, change: &SettingsChange) -> PortResult<SpeechSettings> {
        let mut stored = self.stored.lock().unwrap();
        change.apply(&mut stored);
        Ok(stored.clone())
    }
}

#[derive(Default)]
struct FakeGlossary {
    terms: Mutex<Vec<String>>,
}

impl GlossaryStore for FakeGlossary {
    fn terms(&self) -> PortResult<Vec<String>> {
        Ok(self.terms.lock().unwrap().clone())
    }

    fn effective_terms(&self) -> PortResult<Vec<String>> {
        self.terms()
    }

    fn replace(&self, terms: &[String]) -> PortResult<()> {
        *self.terms.lock().unwrap() = terms.to_vec();
        Ok(())
    }
}

#[derive(Default)]
struct FakeConversation {
    slot: Option<(u64, usize)>,
    question: Option<String>,
}

impl PracticeConversation for FakeConversation {
    fn next_turn_slot(&self) -> Option<(u64, usize)> {
        self.slot
    }

    fn answer_context(&self) -> Option<AnswerContext> {
        self.question.as_ref().map(|question| AnswerContext {
            question: question.clone(),
            recent_answers: Vec::new(),
        })
    }

    fn rescue_question(&self, _: u64, _: usize, _: Option<&str>) -> PortResult<String> {
        self.question
            .clone()
            .ok_or_else(|| SpeechRecognitionError::InvalidRequest("No question.".into()))
    }
}

struct FakeModels {
    installed: Vec<String>,
}

impl ModelCatalog for FakeModels {
    fn list(&self) -> Vec<SpeechModel> {
        self.installed
            .iter()
            .map(|file| SpeechModel {
                file: file.clone(),
                size_bytes: 1,
            })
            .collect()
    }

    fn override_path(&self) -> Option<String> {
        None
    }

    fn path(&self, model_file: &str) -> PathBuf {
        PathBuf::from("/models").join(model_file)
    }

    fn is_installed(&self, model_file: &str) -> bool {
        self.installed.iter().any(|file| file == model_file)
    }

    fn ready_installed(&self, model_file: &str) -> PortResult<PathBuf> {
        if self.is_installed(model_file) {
            Ok(self.path(model_file))
        } else {
            Err(SpeechRecognitionError::ModelMissing(model_file.into()))
        }
    }
}

type Slot = Option<(u64, usize)>;

#[derive(Default)]
struct FakeVault {
    kept: Mutex<Vec<(Slot, usize)>>,
}

impl RecordingVault for FakeVault {
    fn keep(&self, slot: Option<(u64, usize)>, wav: &[u8]) -> PortResult<()> {
        self.kept.lock().unwrap().push((slot, wav.len()));
        Ok(())
    }

    fn summary(&self) -> PortResult<KeptRecordings> {
        Ok(KeptRecordings {
            count: self.kept.lock().unwrap().len() as u64,
            size_bytes: 0,
        })
    }

    fn delete_all(&self) -> PortResult<()> {
        self.kept.lock().unwrap().clear();
        Ok(())
    }
}

#[derive(Default)]
struct FakeCheckStore {
    recordings: Mutex<Vec<CheckRecording>>,
    saved: Mutex<Option<SpeechCheckResults>>,
}

impl SpeechCheckStore for FakeCheckStore {
    fn recorded_indices(&self) -> Vec<u32> {
        self.recordings
            .lock()
            .unwrap()
            .iter()
            .map(|recording| recording.index)
            .collect()
    }

    fn recordings(&self) -> Vec<CheckRecording> {
        self.recordings.lock().unwrap().clone()
    }

    fn results(&self) -> SpeechCheckResults {
        self.saved.lock().unwrap().clone().unwrap_or_default()
    }

    fn save_recording(&self, index: u32, sentence: &str, _: &[u8]) -> PortResult<()> {
        self.recordings.lock().unwrap().push(CheckRecording {
            index,
            reference: sentence.into(),
            path: PathBuf::from(format!("{index}.wav")),
        });
        Ok(())
    }

    fn save_results(&self, results: &SpeechCheckResults) -> PortResult<()> {
        *self.saved.lock().unwrap() = Some(results.clone());
        Ok(())
    }

    fn delete_all(&self) -> PortResult<()> {
        self.recordings.lock().unwrap().clear();
        Ok(())
    }
}

struct FakeOneOff {
    transcript: Mutex<Result<Transcript, SpeechRecognitionError>>,
}

impl OneOffTranscriber for FakeOneOff {
    fn ensure_available(&self) -> PortResult<()> {
        Ok(())
    }

    fn transcribe_file(&self, _: &Path, _: &Path, _: Option<&str>) -> PortResult<Transcript> {
        match &*self.transcript.lock().unwrap() {
            Ok(transcript) => Ok(transcript.clone()),
            Err(SpeechRecognitionError::NoSpeech) => Err(SpeechRecognitionError::NoSpeech),
            Err(_) => Err(SpeechRecognitionError::EngineFailed("broken".into())),
        }
    }
}

struct Fixture {
    service: SpeechRecognitionService,
    engine: Arc<FakeEngine>,
    settings: Arc<FakeSettings>,
    glossary: Arc<FakeGlossary>,
    vault: Arc<FakeVault>,
    check: Arc<FakeCheckStore>,
}

fn fixture_with(conversation: FakeConversation, installed: &[&str]) -> Fixture {
    let engine = Arc::new(FakeEngine::default());
    let settings = Arc::new(FakeSettings::default());
    let glossary = Arc::new(FakeGlossary::default());
    let vault = Arc::new(FakeVault::default());
    let check = Arc::new(FakeCheckStore::default());
    let service = SpeechRecognitionService::new(SpeechRecognitionPorts {
        engine: engine.clone(),
        one_off: Arc::new(FakeOneOff {
            transcript: Mutex::new(Ok(Transcript::english("I tried the Gemini API".into(), 0))),
        }),
        settings: settings.clone(),
        glossary: glossary.clone(),
        conversation: Arc::new(conversation),
        models: Arc::new(FakeModels {
            installed: installed.iter().map(|file| file.to_string()).collect(),
        }),
        recordings: vault.clone(),
        speech_check: check.clone(),
    });
    Fixture {
        service,
        engine,
        settings,
        glossary,
        vault,
        check,
    }
}

fn fixture() -> Fixture {
    fixture_with(FakeConversation::default(), &["ggml-base.en.bin"])
}

#[test]
fn raw_audio_is_discarded_unless_retention_is_on() {
    let f = fixture_with(
        FakeConversation {
            slot: Some((7, 3)),
            question: None,
        },
        &["ggml-base.en.bin"],
    );
    f.service.transcribe(valid_wav()).unwrap();
    assert!(f.vault.kept.lock().unwrap().is_empty());

    f.service.save_keep_raw_audio(true).unwrap();
    f.service.transcribe(valid_wav()).unwrap();
    assert_eq!(
        *f.vault.kept.lock().unwrap(),
        [(Some((7, 3)), valid_wav().len())]
    );

    f.service.save_keep_raw_audio(false).unwrap();
    f.service.transcribe(valid_wav()).unwrap();
    assert_eq!(f.vault.kept.lock().unwrap().len(), 1);
}

#[test]
fn an_unchosen_model_resolves_to_the_installed_default() {
    let base_only = fixture();
    assert_eq!(
        base_only.service.settings().unwrap().model_file,
        "ggml-base.en.bin"
    );
    let with_small = fixture_with(
        FakeConversation::default(),
        &["ggml-base.en.bin", "ggml-small.en.bin"],
    );
    assert_eq!(
        with_small.service.settings().unwrap().model_file,
        "ggml-small.en.bin"
    );
    with_small.service.transcribe(valid_wav()).unwrap();
    assert_eq!(
        with_small.engine.calls.lock().unwrap().transcribed[0].0,
        "ggml-small.en.bin"
    );
}

#[test]
fn the_prompt_holds_the_open_question_and_the_glossary() {
    let f = fixture_with(
        FakeConversation {
            slot: None,
            question: Some("What did you build?".into()),
        },
        &["ggml-base.en.bin"],
    );
    f.service.save_glossary(&["Tauri".to_string()]).unwrap();
    f.service.transcribe(valid_wav()).unwrap();
    let prompt = f.engine.calls.lock().unwrap().transcribed[0].1.clone();
    assert_eq!(
        prompt.as_deref(),
        Some("What did you build? Vocabulary: Tauri.")
    );
}

#[test]
fn live_updates_need_the_switch_and_a_light_model() {
    let f = fixture();
    assert_eq!(
        f.service.transcribe_partial(&valid_wav()).unwrap(),
        Some("hel".into())
    );
    f.service.save_live_transcript(false).unwrap();
    assert_eq!(f.service.transcribe_partial(&valid_wav()).unwrap(), None);
    f.service.save_live_transcript(true).unwrap();
    f.service.save_model("ggml-medium.en.bin".into()).unwrap();
    assert_eq!(f.service.transcribe_partial(&valid_wav()).unwrap(), None);
    assert_eq!(f.engine.calls.lock().unwrap().partials, 1);
}

#[test]
fn only_model_file_names_can_be_chosen() {
    let f = fixture();
    let error = f.service.save_model("../etc/passwd".into()).unwrap_err();
    assert!(matches!(error, SpeechRecognitionError::InvalidRequest(_)));
    assert_eq!(f.settings.stored.lock().unwrap().model_file, "");
}

#[test]
fn warming_loads_the_chosen_model() {
    let f = fixture();
    f.service.save_model("ggml-small.en.bin".into()).unwrap();
    f.service.warm().unwrap();
    assert_eq!(f.engine.calls.lock().unwrap().warmed, ["ggml-small.en.bin"]);
}

#[test]
fn a_rescue_snapshot_comes_back_as_text_only_when_something_was_heard() {
    let f = fixture_with(
        FakeConversation {
            slot: None,
            question: Some("Why?".into()),
        },
        &["ggml-base.en.bin"],
    );
    assert!(matches!(
        f.service.transcribe_rescue(1, 1, &valid_wav()),
        Err(SpeechRecognitionError::Unavailable(_))
    ));
    *f.engine.rescue_text.lock().unwrap() = Some("  ".into());
    assert!(matches!(
        f.service.transcribe_rescue(1, 1, &valid_wav()),
        Err(SpeechRecognitionError::InvalidOutput(_))
    ));
    *f.engine.rescue_text.lock().unwrap() = Some("because".into());
    assert_eq!(
        f.service.transcribe_rescue(1, 1, &valid_wav()).unwrap(),
        "because"
    );
}

#[test]
fn a_rescue_snapshot_that_is_not_audio_never_reaches_the_engine() {
    let f = fixture_with(
        FakeConversation {
            slot: None,
            question: Some("Why?".into()),
        },
        &["ggml-base.en.bin"],
    );
    assert!(matches!(
        f.service.transcribe_rescue(1, 1, b"not a wav"),
        Err(SpeechRecognitionError::InvalidRequest(_))
    ));
    assert_eq!(f.engine.calls.lock().unwrap().rescues, 0);
}

#[test]
fn the_glossary_is_normalized_before_it_is_saved() {
    let f = fixture();
    let saved = f
        .service
        .save_glossary(&["  Tauri ".into(), "tauri".into(), "".into()])
        .unwrap();
    assert_eq!(saved, ["Tauri"]);
    assert_eq!(*f.glossary.terms.lock().unwrap(), ["Tauri"]);
    let too_long = "x".repeat(41);
    assert!(matches!(
        f.service.save_glossary(&[too_long]),
        Err(SpeechRecognitionError::InvalidRequest(_))
    ));
}

#[test]
fn deleting_kept_recordings_reports_what_is_left() {
    let f = fixture();
    f.service.save_keep_raw_audio(true).unwrap();
    f.service.transcribe(valid_wav()).unwrap();
    assert_eq!(f.service.kept_recordings().unwrap().count, 1);
    assert_eq!(f.service.delete_kept_recordings().unwrap().count, 0);
}

#[test]
fn the_speech_check_accepts_only_known_sentences_and_real_audio() {
    let f = fixture();
    assert!(matches!(
        f.service.save_speech_check_recording(0, &valid_wav()),
        Err(SpeechRecognitionError::InvalidAudio(_))
    ));
    assert!(matches!(
        f.service.save_speech_check_recording(1, b"nope"),
        Err(SpeechRecognitionError::InvalidAudio(_))
    ));
    let status = f
        .service
        .save_speech_check_recording(3, &valid_wav())
        .unwrap();
    assert!(status.sentences[2].is_recorded);
    let cleared = f.service.delete_speech_check_recordings().unwrap();
    assert!(cleared
        .sentences
        .iter()
        .all(|sentence| !sentence.is_recorded));
}

#[test]
fn measuring_scores_each_model_with_and_without_the_glossary_and_keeps_the_results() {
    let f = fixture_with(
        FakeConversation::default(),
        &["ggml-base.en.bin", "ggml-small.en.bin"],
    );
    f.service.save_glossary(&["Gemini".to_string()]).unwrap();
    f.service
        .save_speech_check_recording(1, &valid_wav())
        .unwrap();
    let models = vec![
        "ggml-base.en.bin".to_string(),
        "ggml-small.en.bin".to_string(),
    ];
    let mut progress = Vec::new();
    let results = f
        .service
        .run_speech_check(&models, true, |step| progress.push((step.done, step.total)))
        .unwrap();
    assert_eq!(results.runs.len(), 4);
    assert_eq!(progress.first(), Some(&(0, 4)));
    assert_eq!(progress.last(), Some(&(4, 4)));
    assert_eq!(f.check.results(), results);
}

#[test]
fn measuring_needs_recordings_and_installed_models() {
    let f = fixture();
    let base = vec!["ggml-base.en.bin".to_string()];
    assert!(matches!(
        f.service.run_speech_check(&base, false, |_| {}),
        Err(SpeechRecognitionError::InvalidAudio(_))
    ));
    f.service
        .save_speech_check_recording(1, &valid_wav())
        .unwrap();
    assert!(matches!(
        f.service
            .run_speech_check(&["ggml-large.bin".to_string()], false, |_| {}),
        Err(SpeechRecognitionError::ModelMissing(_))
    ));
    assert!(matches!(
        f.service
            .run_speech_check(&["../x.bin".to_string()], false, |_| {}),
        Err(SpeechRecognitionError::ModelMissing(_))
    ));
    assert!(matches!(
        f.service.run_speech_check(&[], false, |_| {}),
        Err(SpeechRecognitionError::ModelMissing(_))
    ));
}

#[test]
fn only_one_measurement_runs_at_a_time() {
    let f = fixture();
    f.service
        .save_speech_check_recording(1, &valid_wav())
        .unwrap();
    let base = vec!["ggml-base.en.bin".to_string()];
    let service = f.service.clone();
    let mut nested = None;
    f.service
        .run_speech_check(&base, false, |_| {
            nested = Some(service.run_speech_check(&base, false, |_| {}));
        })
        .unwrap();
    assert!(matches!(nested, Some(Err(SpeechRecognitionError::Busy(_)))));
    assert!(f.service.run_speech_check(&base, false, |_| {}).is_ok());
}
