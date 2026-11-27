use super::super::CoachingAnswer;
use super::coaching::coach_answers;

#[test]
#[ignore = "Calls the real Claude Code CLI; requires it installed and signed in"]
fn live_coaching_batch() {
    let answers = [
        CoachingAnswer {
            sequence: 1,
            question: "What did you do yesterday?".into(),
            transcript: "Yesterday I go to the office and I am agree with my manager about the plan."
                .into(),
            habits: Vec::new(),
        },
        CoachingAnswer {
            sequence: 2,
            question: "What was the hardest part of your week?".into(),
            transcript: "The hardest part was a very big problem with the server. It was very bad because the users could not do the payment, and we had to do a lot of work, very long hours, to make it good again. I was very tired and, um, the thing, the thing that you write to say what went wrong, I forgot how to say it."
                .into(),
            habits: Vec::new(),
        },
        CoachingAnswer {
            sequence: 3,
            question: "How do you plan to improve your English this year?".into(),
            transcript: "I want to speak more good with my team. I think it is a good idea to practise every day, and I will make a lot of conversations, and I will do a good plan so I can say what I think in a good way."
                .into(),
            habits: Vec::new(),
        },
    ];
    let started = std::time::Instant::now();

    let coached = coach_answers(&answers).expect("Claude answered");

    println!("LIVE coaching latency_ms={}", started.elapsed().as_millis());
    assert!(!coached.is_empty());
    for answer in &coached {
        let feedback = &answer.feedback;
        println!("--- answer {} ---", answer.sequence);
        println!("said: {}", answers[answer.sequence - 1].transcript);
        println!("better: {}", feedback.b2_rewrite);
        for mistake in &feedback.focus_feedback {
            println!(
                "FIX    [{:?}] {:?} -> {:?} | {}",
                mistake.category, mistake.original, mistake.improved, mistake.explanation
            );
        }
        for upgrade in &feedback.upgrades {
            println!(
                "BETTER {:?} -> {:?} | {}",
                upgrade.original, upgrade.improved, upgrade.explanation
            );
        }
        for gap in &feedback.gaps {
            println!(
                "GAP    {:?} -> {:?} | {}",
                gap.original, gap.word, gap.meaning
            );
        }
        for word in &feedback.words_to_take {
            println!(
                "TAKE   {:?} = {} | e.g. {}",
                word.phrase, word.meaning, word.example
            );
        }
    }
    assert!(coached
        .iter()
        .any(|answer| !answer.feedback.upgrades.is_empty() || !answer.feedback.gaps.is_empty()));
}
