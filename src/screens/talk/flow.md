# Talk screen

`screens/talk` composes three features over the core atoms and leaves slots for the flows that are
not migrated yet. The route (`src/routes/talk`) fills the slots with the legacy components; nothing
a learner uses today is missing.

```mermaid
sequenceDiagram
    actor Learner
    participant Route as routes/talk
    participant Screen as TalkScreen
    participant Session as features/talk-session
    participant Composer as features/talk-composer
    participant Dialogue as features/talk-dialogue
    participant Legacy as features/practice (legacy)

    Learner->>Route: opens /conversation
    Route->>Screen: slots (help bar, Stuck panel, coaching notes, recall, replay prompt, review stage)
    Screen->>Session: header, clock, Pause, Finish
    Screen->>Composer: Eva's stage, composer, live transcript
    Screen->>Dialogue: messages, streaming reply
    Dialogue-->>Legacy: a render function for the note under each answer
    Composer-->>Legacy: Stuck panel beside the microphone, help bar above the composer
    Note over Screen,Legacy: no open session shows the start prompt; review phases hand the screen to the review stage
```

Slots still filled by legacy components, and the issue that migrates each one:

| Slot | Legacy component | Issue |
| :--- | :--- | :--- |
| coaching note under an answer, second try | `AnswerNote`, `SecondTryBox`, `features/coach` | #75 |
| help bar, planning timer | `HelpBar`, `GuidedAnswerPanel`, `PlanningTimer` | #76 |
| Stuck panel | `RescuePanel` | #77 |
| spoken phrase recall, usage review, wrap-up | `DailyRecallPanel`, `MemoryUsageReview`, `PracticeCompletion` | #78 |
| write then speak review and prompts | `PracticeReview`, `OriginalQuestionPrompt` | #79 |
| mistake practice | shares the screen; its progress is in the header | #80 |
