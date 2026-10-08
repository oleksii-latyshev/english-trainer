use super::*;
use crate::providers::agy::test_support::{recorded_calls, recording_cli, TestDirectory};

fn answer(sequence: usize, transcript: &str) -> CoachingAnswer {
    CoachingAnswer {
        sequence,
        question: "What did you do?".into(),
        transcript: transcript.into(),
    }
}

fn reply(structured_output: &str) -> String {
    format!(r#"printf '%s' '{{"status":"SUCCESS","structured_output":{structured_output}}}'"#)
}

#[test]
fn valid_entries_become_feedback_and_a_bad_quote_drops_only_its_focus_point() {
    let dir = TestDirectory::new();
    let cli = recording_cli(
        &dir,
        &reply(
            r#"{"answers":[
            {"n":4,"mistakes":[{"original":"He go home","improved":"He goes home","explanation":"After he the verb takes -s.","category":"grammar"}],"rewrite":"He goes home."},
            {"n":5,"mistakes":[{"original":"made-up words","improved":"real words","explanation":"Not in the transcript."}],"rewrite":"I like tea."},
            {"n":6,"mistakes":[],"rewrite":"**not plain text**"},
            {"n":9,"mistakes":[],"rewrite":"Unknown answer."}]}"#,
        ),
    );
    let answers = [
        answer(4, "He go home"),
        answer(5, "I like tea"),
        answer(6, "Hello"),
    ];

    let coached = coach_answers_with(&cli, &answers).unwrap();

    assert_eq!(
        coached.len(),
        2,
        "answer 6 has an unusable rewrite, 9 was not asked"
    );
    assert_eq!(coached[0].sequence, 4);
    let focus = &coached[0].feedback.focus_feedback;
    assert_eq!(focus.len(), 1);
    assert_eq!(focus[0].original, "He go home");
    assert_eq!(focus[0].improved, "He goes home");
    assert_eq!(coached[0].feedback.b2_rewrite, "He goes home.");
    assert_eq!(coached[1].sequence, 5);
    assert!(coached[1].feedback.focus_feedback.is_empty());
}

#[test]
fn only_the_first_valid_mistake_is_kept_and_missing_category_means_grammar() {
    let dir = TestDirectory::new();
    let cli = recording_cli(
        &dir,
        &reply(
            r#"{"answers":[{"n":1,"mistakes":[
            {"original":"nothing here","improved":"x","explanation":"Invalid quote."},
            {"original":"a big mistake","improved":"a major mistake","explanation":"Use the usual pairing.","category":"vocabulary"},
            {"original":"I am agree","improved":"I agree","explanation":"Agree is a verb."}],"rewrite":"I agree."}]}"#,
        ),
    );
    let answers = [answer(1, "I am agree it is a big mistake")];
    let coached = coach_answers_with(&cli, &answers).unwrap();
    let focus = &coached[0].feedback.focus_feedback;
    assert_eq!(focus.len(), 1);
    assert_eq!(focus[0].improved, "a major mistake");
    assert_eq!(focus[0].category, FocusCategory::Vocabulary);
}

#[test]
fn structured_output_as_text_or_only_a_response_is_still_read() {
    let dir = TestDirectory::new();
    let as_text = recording_cli(
        &dir,
        r#"printf '%s' '{"status":"SUCCESS","structured_output":"{\"answers\":[{\"n\":1,\"mistakes\":[],\"rewrite\":\"Fine.\"}]}"}'"#,
    );
    assert_eq!(
        coach_answers_with(&as_text, &[answer(1, "Fine")])
            .unwrap()
            .len(),
        1
    );
    let only_response = recording_cli(
        &dir,
        r#"printf '%s' '{"status":"SUCCESS","response":"Here you go: {\"answers\":[{\"n\":1,\"mistakes\":[],\"rewrite\":\"Fine.\"}]}"}'"#,
    );
    assert_eq!(
        coach_answers_with(&only_response, &[answer(1, "Fine")])
            .unwrap()
            .len(),
        1
    );
}

#[test]
fn an_envelope_without_an_answer_is_invalid_output() {
    let dir = TestDirectory::new();
    let cli = recording_cli(
        &dir,
        r#"printf '%s' '{"status":"SUCCESS","response":"I could not.","denied_actions":[{"tool":"run"}]}'"#,
    );
    let error = coach_answers_with(&cli, &[answer(1, "Hello")]).unwrap_err();
    assert_eq!(error.code, ProviderErrorCode::InvalidOutput);
}

#[test]
fn an_exhausted_quota_is_a_rate_limit_not_an_invalid_reply() {
    let dir = TestDirectory::new();
    let from_stderr = recording_cli(
        &dir,
        "echo 'rpc error: code = ResourceExhausted desc = RESOURCE_EXHAUSTED (429)' >&2\nexit 1",
    );
    let error = coach_answers_with(&from_stderr, &[answer(1, "Hello")]).unwrap_err();
    assert_eq!(error.code, ProviderErrorCode::RateLimited);

    let from_envelope = recording_cli(
        &dir,
        r#"printf '%s' '{"status":"ERROR","response":"429 RESOURCE_EXHAUSTED: quota"}'"#,
    );
    let error = coach_answers_with(&from_envelope, &[answer(1, "Hello")]).unwrap_err();
    assert_eq!(error.code, ProviderErrorCode::RateLimited);

    let other_failure = recording_cli(&dir, "echo 'boom' >&2\nexit 1");
    let error = coach_answers_with(&other_failure, &[answer(1, "Hello")]).unwrap_err();
    assert_eq!(error.code, ProviderErrorCode::ProcessFailed);
}

#[test]
fn one_call_carries_every_answer_with_its_question_and_the_pinned_gemini_model() {
    let dir = TestDirectory::new();
    let cli = recording_cli(&dir, &reply(r#"{"answers":[]}"#));
    let mut second = answer(7, "I has a dog");
    second.question = "Do you have pets?".into();
    coach_answers_with(&cli, &[answer(6, "I works here"), second]).unwrap();

    let calls = recorded_calls(&dir);
    assert_eq!(calls.len(), 1, "one process call for the whole batch");
    let arguments = &calls[0];
    let model = arguments.iter().position(|argument| argument == "--model");
    assert_eq!(
        model
            .and_then(|index| arguments.get(index + 1))
            .map(String::as_str),
        Some("gemini-3.8-flash-medium")
    );
    let prompt = arguments
        .iter()
        .find(|argument| argument.contains("Learner data JSON"))
        .expect("the prompt is an argument");
    assert!(prompt.contains("Do not use any tools or commands"));
    assert!(prompt.contains(r#""n":6"#) && prompt.contains(r#""n":7"#));
    assert!(prompt.contains("Do you have pets?"));
    assert!(prompt.contains("I has a dog"));
}

#[test]
fn the_batch_size_is_bounded() {
    let too_many: Vec<_> = (1..=6).map(|n| answer(n, "Hello")).collect();
    let error = coach_answers_with(Path::new("/nonexistent"), &too_many).unwrap_err();
    assert_eq!(error.code, ProviderErrorCode::InvalidRequest);
    let error = coach_answers_with(Path::new("/nonexistent"), &[]).unwrap_err();
    assert_eq!(error.code, ProviderErrorCode::InvalidRequest);
}

#[test]
#[ignore = "Explicit synthetic live-provider check; one real Antigravity call, requires sign-in"]
fn live_coaching_batch() {
    let answers = [
        answer(1, "Yesterday I go to the office and I meet my manager, he say the project is delayed."),
        answer(2, "I am working on a small app that help me to practise English every day."),
        answer(3, "We decided to use Rust because it is fast and the memory safety is very important for us."),
    ];
    let started = std::time::Instant::now();
    let coached = coach_answers(&answers).expect("the live batch returns a result");
    println!(
        "LIVE batch of {} answers took {} ms",
        answers.len(),
        started.elapsed().as_millis()
    );
    for item in &coached {
        println!(
            "LIVE #{} focus={:?} rewrite={}",
            item.sequence, item.feedback.focus_feedback, item.feedback.b2_rewrite
        );
    }
    assert!(!coached.is_empty());
}
