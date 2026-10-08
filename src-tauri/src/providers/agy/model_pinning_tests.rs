//! Every Antigravity call names a Gemini model. Without `--model`, agy runs its own default,
//! which is a Claude model and spends the learner's Claude quota.

use super::test_support::{recorded_calls, recording_cli, TestDirectory};
use super::{coaching, guided, AgyEngine};
use crate::learning::LearningItemType;
use crate::providers::{
    AgyModel, CoachingAnswer, ConversationContext, ConversationEngine, UsageCandidate,
    UsageReviewEngine, UsageReviewRequest,
};

fn model_of(call: &[String]) -> Option<&str> {
    let index = call.iter().position(|argument| argument == "--model")?;
    call.get(index + 1).map(String::as_str)
}

fn assert_every_call_is_gemini(dir: &TestDirectory, expected_calls: usize) {
    let calls = recorded_calls(dir);
    assert!(
        calls.len() >= expected_calls,
        "the entry point should have called agy"
    );
    for call in calls {
        let model = model_of(&call);
        assert!(
            model.is_some_and(|id| id.starts_with("gemini-")),
            "an agy call without a Gemini model: {model:?}"
        );
    }
}

#[test]
fn every_agy_entry_point_passes_a_gemini_model() {
    // The replies are not valid answers; only the command line matters here.
    let dir = TestDirectory::new();
    let cli = recording_cli(
        &dir,
        r#"printf '%s' '{"status":"SUCCESS","structured_output":{}}'"#,
    );

    let _ = coaching::coach_answers_with(
        &cli,
        &[CoachingAnswer {
            sequence: 1,
            question: "Q?".into(),
            transcript: "I work.".into(),
        }],
    );
    assert_every_call_is_gemini(&dir, 1);

    let _ = guided::generate(&cli, "What did you do?");
    assert_every_call_is_gemini(&dir, 2);

    let engine = AgyEngine { binary: cli };
    let _ = engine.review_usage(&UsageReviewRequest {
        answered_question: "What happened?".into(),
        transcript: "I work there now.".into(),
        candidates: vec![UsageCandidate {
            item_type: LearningItemType::Mistake,
            item_id: 10,
            target: "work there".into(),
            cue: "work in there".into(),
        }],
    });
    assert_every_call_is_gemini(&dir, 3);

    let _ = engine.generate_turn(&ConversationContext {
        latest_transcript: "I went to the park.".into(),
        ..Default::default()
    });
    assert_every_call_is_gemini(&dir, 4);
}

#[test]
fn every_conversation_model_choice_resolves_to_a_gemini_model() {
    for choice in [AgyModel::Default, AgyModel::FlashLow, AgyModel::FlashHigh] {
        assert!(choice.cli_id().starts_with("gemini-"), "{choice:?}");
    }
    assert_eq!(AgyModel::Default.cli_id(), "gemini-3.8-flash-medium");
    assert_eq!(coaching::COACHING_MODEL, "gemini-3.8-flash-medium");
}
