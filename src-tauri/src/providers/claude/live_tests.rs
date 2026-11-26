use super::super::CoachingAnswer;
use super::coaching::coach_answers;

#[test]
#[ignore = "Calls the real Claude Code CLI; requires it installed and signed in"]
fn live_coaching_batch() {
    let answers = [CoachingAnswer {
        sequence: 1,
        question: "What did you do yesterday?".into(),
        transcript: "Yesterday I go to the office and I am agree with my manager about the plan."
            .into(),
    }];
    let started = std::time::Instant::now();

    let coached = coach_answers(&answers).expect("Claude answered");

    println!("LIVE coaching latency_ms={}", started.elapsed().as_millis());
    assert_eq!(coached.len(), 1);
    println!("LIVE coaching result={:?}", coached[0].feedback);
    assert!(!coached[0].feedback.b2_rewrite.is_empty());
}
