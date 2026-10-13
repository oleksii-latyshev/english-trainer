# Talk start screen

Composes the start-of-practice features for the `/` route. It owns layout and the two pieces of
ephemeral state that connect features (the practice selection and the warm-up choice); everything
that touches Rust, the open session or the router is passed in by the app layer
(`src/routes/talk-start`), which keeps the legacy Talk and Memory state out of the screen.

```text
TalkStartScreen
  left column   StartGreeting (Eva + greeting)
                ResumeCard            when a conversation is open
                ModeChoice, TopicChoice   otherwise
                ActivityCard          26-week grid, from local data
                LengthChoice + StartBar   otherwise
                StartError            when starting failed
  right column  WarmupCard            when review data is ready
                UsualMistakesCard     when a repeated mistake exists
                WeekCard              minutes spoken this week
```

Below the `narrow` breakpoint the right column stacks under the left one.

## Start a conversation

```mermaid
sequenceDiagram
    actor Learner
    participant Screen as TalkStartScreen
    participant Setup as practice-setup
    participant Warmup as review-warmup
    participant Route as TalkStartRoute
    participant Talk as Talk / TrainerContext (legacy)

    Learner->>Setup: chooses mode, topic, length
    Setup->>Screen: onChange(patch)
    Learner->>Warmup: Before session or Skip today
    Warmup->>Screen: onWarmupFirstChange
    Learner->>Screen: Start talking or Random topic
    Screen->>Setup: toPracticeOptions(selection)
    Screen->>Warmup: startsWithWarmup(mode, next phrase, choice)
    alt warm-up first
        Screen->>Route: onStartWarmup(options)
        Route-->>Learner: spoken review, then the conversation
    else straight in
        Screen->>Route: onStart(options)
        Route->>Talk: startPractice(options)
        Talk-->>Learner: opens /conversation, or sets the error shown in StartError
    end
```

## What each card launches

| Control | Goes to |
| :--- | :--- |
| Continue | `startOrResumePractice` in the open conversation |
| Review now | `/memory` |
| Practice 5 questions | `startMistakePractice` (F12), then `/conversation` |
