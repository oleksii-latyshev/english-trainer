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
fn a_long_answer_gets_its_whole_rewrite_while_a_runaway_one_is_dropped() {
    let long_answer =
        "We cache the catalog page for one hour so the next user gets it fast. ".repeat(14);
    let rewrite =
        "We cache the catalog page for an hour, so the next user gets it quickly. ".repeat(14);
    let runaway = "Caching helps. ".repeat(200);
    let dir = TestDirectory::new();
    let cli = recording_cli(
        &dir,
        &reply(&format!(
            r#"{{"answers":[{{"n":1,"mistakes":[],"rewrite":"{}"}},{{"n":2,"mistakes":[],"rewrite":"{}"}}]}}"#,
            rewrite.trim(),
            runaway.trim()
        )),
    );

    let coached =
        coach_answers_with(&cli, &[answer(1, &long_answer), answer(2, &long_answer)]).unwrap();

    assert!(long_answer.chars().count() > 900);
    assert_eq!(coached.len(), 1);
    assert_eq!(coached[0].sequence, 1);
    assert_eq!(coached[0].feedback.b2_rewrite, rewrite.trim());
}

#[test]
fn invalid_mistakes_are_dropped_valid_ones_kept_and_missing_category_means_grammar() {
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
    assert_eq!(focus.len(), 2);
    assert_eq!(focus[0].improved, "a major mistake");
    assert_eq!(focus[0].category, FocusCategory::Vocabulary);
    assert_eq!(focus[1].improved, "I agree");
    assert_eq!(focus[1].category, FocusCategory::Grammar);
}

const PLAIN_TRANSCRIPT: &str =
    "I was very tired after the thing for the meeting because we did a lot of work";

fn coached_from(entry: &str) -> crate::providers::TurnFeedback {
    let dir = TestDirectory::new();
    let cli = recording_cli(&dir, &reply(&format!(r#"{{"answers":[{entry}]}}"#)));
    let mut coached = coach_answers_with(&cli, &[answer(1, PLAIN_TRANSCRIPT)]).unwrap();
    coached.remove(0).feedback
}

#[test]
fn upgrades_gaps_and_words_to_take_are_read_from_the_reply() {
    let feedback = coached_from(
        r#"{"n":1,"mistakes":[],
        "upgrades":[{"original":"very tired","improved":"exhausted","explanation":"A stronger, common word."}],
        "gaps":[{"original":"the thing for the meeting","word":"agenda","meaning":"a list of topics for a meeting"}],
        "words_to_take":[
          {"phrase":"agenda","meaning":"a list of topics for a meeting","example":"I prepared the agenda for the meeting."},
          {"phrase":"exhausted","meaning":"very tired","example":"I was exhausted after a long day."}],
        "rewrite":"I was exhausted after preparing the agenda for the meeting because we put in a lot of work."}"#,
    );

    assert_eq!(feedback.upgrades[0].improved, "exhausted");
    assert_eq!(feedback.gaps[0].word, "agenda");
    assert_eq!(
        feedback
            .words_to_take
            .iter()
            .map(|word| word.phrase.as_str())
            .collect::<Vec<_>>(),
        ["agenda", "exhausted"]
    );
}

#[test]
fn findings_with_a_bad_fragment_are_dropped_and_the_answer_still_comes_back() {
    let feedback = coached_from(
        r#"{"n":1,"mistakes":[],
        "upgrades":[
          {"original":"never said this","improved":"exhausted","explanation":"Not in the transcript."},
          {"original":"very tired","improved":"Very tired!","explanation":"Same words."},
          {"original":"a lot of work","improved":"**a heavy workload**","explanation":"Markdown."}],
        "gaps":[
          {"original":"made up fragment","word":"agenda","meaning":"Not in the transcript."},
          {"original":"the thing for the meeting","word":"the thing","meaning":"Already said."}],
        "words_to_take":[
          {"phrase":"work","meaning":"The learner used it.","example":"I like work."},
          {"phrase":"agenda","meaning":"A list.","example":"No such word in the example."},
          {"phrase":"workload","meaning":"Not in the better version.","example":"The workload is heavy."}],
        "rewrite":"I was exhausted after the meeting."}"#,
    );

    assert!(feedback.upgrades.is_empty());
    assert!(feedback.gaps.is_empty());
    assert!(feedback.words_to_take.is_empty());
    assert_eq!(feedback.b2_rewrite, "I was exhausted after the meeting.");
}

#[test]
fn every_list_is_capped_at_two_deduplicated_and_does_not_repeat_a_mistake_fragment() {
    let feedback = coached_from(
        r#"{"n":1,
        "mistakes":[{"original":"we did a lot of work","improved":"we did a lot of work","explanation":"Same."},
                    {"original":"did a lot","improved":"put in a lot","explanation":"Better pairing.","category":"vocabulary"}],
        "upgrades":[
          {"original":"did a lot","improved":"put in a lot","explanation":"Already a mistake."},
          {"original":"very tired","improved":"exhausted","explanation":"Stronger."},
          {"original":"Very Tired","improved":"worn out","explanation":"Repeats the fragment."},
          {"original":"after the thing","improved":"after the task","explanation":"More exact."},
          {"original":"the meeting","improved":"the stand-up","explanation":"More exact."}],
        "gaps":[],
        "words_to_take":[
          {"phrase":"exhausted","meaning":"very tired","example":"I was exhausted."},
          {"phrase":"Exhausted","meaning":"very tired","example":"I was exhausted."},
          {"phrase":"put in","meaning":"spend effort","example":"We put in a lot of work."},
          {"phrase":"the task","meaning":"a job","example":"I did the task."}],
        "rewrite":"I was exhausted after we put in a lot of work on the task."}"#,
    );

    assert_eq!(feedback.focus_feedback.len(), 1);
    assert_eq!(feedback.focus_feedback[0].improved, "put in a lot");
    let upgraded: Vec<_> = feedback
        .upgrades
        .iter()
        .map(|upgrade| upgrade.original.as_str())
        .collect();
    assert_eq!(upgraded, ["very tired", "after the thing"]);
    assert_eq!(
        feedback
            .words_to_take
            .iter()
            .map(|word| word.phrase.as_str())
            .collect::<Vec<_>>(),
        ["exhausted", "put in"]
    );
}

#[test]
fn a_reply_without_the_new_lists_still_validates() {
    let feedback = coached_from(r#"{"n":1,"mistakes":[],"rewrite":"I was exhausted."}"#);

    assert!(feedback.upgrades.is_empty() && feedback.gaps.is_empty());
    assert!(feedback.words_to_take.is_empty());
}

#[test]
fn the_prompt_and_schema_ask_for_every_finding_and_for_gap_signals() {
    let prompt = make_prompt(&[answer(1, "Hello")]);

    for needle in [
        "upgrades",
        "gaps",
        "words_to_take",
        "B1 to B2",
        "fillers",
        "recognition errors",
    ] {
        assert!(prompt.contains(needle), "the prompt names {needle}");
    }
    for field in ["upgrades", "gaps", "words_to_take"] {
        assert!(SCHEMA.contains(&format!(r#""{field}":{{"type":"array","maxItems":2"#)));
    }
    assert!(serde_json::from_str::<serde_json::Value>(SCHEMA).is_ok());
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
