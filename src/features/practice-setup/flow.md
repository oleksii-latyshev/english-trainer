# Practice setup flow

The choices on the Talk start screen: how to practise, the topic, the suggested length, and the
buttons that start a conversation. The selection is ephemeral screen state owned by
`TalkStartScreen`; the feature supplies the controls and the rules that turn a selection into the
options Rust receives.

## Choose and start

```mermaid
sequenceDiagram
    actor Learner
    participant Screen as TalkStartScreen
    participant Setup as ModeChoice / TopicChoice / LengthChoice / StartBar
    participant Helper as toPracticeOptions
    participant App as startPractice (app layer)
    participant Rust as start_practice_session

    Learner->>Setup: picks a mode, topic and length (5, 10, 15 min or No limit)
    Setup->>Screen: onChange(patch)
    Learner->>Setup: Start talking
    Setup->>Screen: onStart
    Screen->>Helper: selection
    Helper-->>Screen: PracticeOptions (duration_goal_seconds is null for No limit)
    Screen->>App: onStart(options)
    App->>Rust: start_practice_session
    alt cannot start
        Rust-->>App: error text
        App-->>Screen: error
        Screen-->>Learner: StartError with Try again, which starts with the same selection
    else started
        App-->>Learner: opens the conversation
    end
```

## Free topic and Random topic

```mermaid
sequenceDiagram
    actor Learner
    participant Topic as TopicChoice
    participant Helper as canStart / toPracticeOptions
    participant Screen as TalkStartScreen

    Learner->>Topic: chooses Free topic
    Topic-->>Learner: input for the subject, 150 characters at most
    alt subject empty or too long
        Helper-->>Screen: canStart is false, Start is disabled
    else valid
        Helper-->>Screen: topic_custom is the trimmed subject
    end
    Learner->>Screen: Random topic
    Screen->>Helper: toPracticeOptions(selection, "random")
    Helper-->>Screen: topic_id "random", no custom subject
```
