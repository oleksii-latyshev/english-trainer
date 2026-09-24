use serde::Serialize;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct QuestionScaffold {
    pub sentence_starters: Vec<&'static str>,
    pub useful_expressions: Vec<&'static str>,
    pub structure: Vec<&'static str>,
}

pub fn question_scaffold(question: &str) -> QuestionScaffold {
    let lower = question.to_lowercase();
    if lower.contains("why") || lower.contains("reason") {
        return QuestionScaffold {
            sentence_starters: vec![
                "The main reason is…",
                "Another factor was…",
                "Looking back, I think…",
            ],
            useful_expressions: vec!["mainly because", "as a result", "in hindsight"],
            structure: vec!["Give the reason", "Add one example", "Explain the result"],
        };
    }
    if ["think", "opinion", "agree", "prefer", "would you"]
        .iter()
        .any(|word| lower.contains(word))
    {
        return QuestionScaffold {
            sentence_starters: vec![
                "In my view…",
                "One reason I feel this way is…",
                "On the other hand…",
            ],
            useful_expressions: vec!["from my perspective", "for instance", "on balance"],
            structure: vec!["State your view", "Give a reason", "Add a concrete example"],
        };
    }
    if ["happen", "recently", "your day", "experience", "last time"]
        .iter()
        .any(|word| lower.contains(word))
    {
        return QuestionScaffold {
            sentence_starters: vec![
                "It started when…",
                "The most interesting part was…",
                "After that, I…",
            ],
            useful_expressions: vec!["at first", "afterwards", "in the end"],
            structure: vec![
                "Set the scene",
                "Say what happened",
                "Explain why it stood out",
            ],
        };
    }
    QuestionScaffold {
        sentence_starters: vec![
            "I'd say that…",
            "A good example is…",
            "What matters most is…",
        ],
        useful_expressions: vec!["in particular", "for example", "overall"],
        structure: vec![
            "Answer directly",
            "Add a concrete detail",
            "Explain why it matters",
        ],
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn chooses_help_for_the_current_question_without_a_provider_call() {
        let event = question_scaffold("What happened to you recently?");
        assert_eq!(event.sentence_starters[0], "It started when…");
        assert_eq!(event.structure.len(), 3);
        assert_eq!(event.useful_expressions.len(), 3);

        let reason = question_scaffold("Why did you choose that?");
        assert_eq!(reason.sentence_starters[0], "The main reason is…");

        let general = question_scaffold("Can you tell me more?");
        assert_eq!(general.structure[0], "Answer directly");
    }
}
