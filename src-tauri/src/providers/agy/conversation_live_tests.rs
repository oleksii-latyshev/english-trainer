use super::*;

#[test]
#[ignore = "Explicit synthetic live-provider benchmark; requires signed-in Antigravity"]
fn live_conversation_benchmark() {
    let engine = AgyEngine {
        binary: runner::resolve_binary().expect("Antigravity installed"),
    };
    let request = ConversationContext {
        opening_question: "What are you working on today?".into(),
        recent_turns: Vec::new(),
        latest_transcript:
            "I am working on a small English practice app. Today I want to improve the chat.".into(),
        learning_targets: Vec::new(),
    };
    let mut failures = 0;
    for model in [
        None,
        Some("gemini-3.8-flash-low"),
        Some("gemini-3.8-flash-high"),
    ] {
        for run in 1..=3 {
            let started = std::time::Instant::now();
            let result = generate_using_model(&engine, &request, model);
            match result {
                Ok(_) => println!(
                    "BENCH model={} run={} latency_ms={} outcome=success",
                    model.unwrap_or("default"),
                    run,
                    started.elapsed().as_millis()
                ),
                Err(error) => {
                    failures += 1;
                    println!(
                        "BENCH model={} run={} latency_ms={} outcome={:?} stage={:?}",
                        model.unwrap_or("default"),
                        run,
                        started.elapsed().as_millis(),
                        error.code,
                        error.reply_stage
                    );
                }
            }
        }
    }
    assert_eq!(
        failures, 0,
        "Inspect synthetic benchmark error categories; no personal text is logged."
    );
}
