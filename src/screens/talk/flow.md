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
    Route->>Screen: slots (help bar, Stuck panel, recall, replay prompt, review stage)
    Screen->>Session: header, clock, Pause, Finish
    Screen->>Composer: Eva's stage, composer, live transcript
    Screen->>Dialogue: messages, streaming reply
    Dialogue-->>Learner: a quiet tip marker beside each answer, never a note
    Composer-->>Legacy: Stuck panel beside the microphone, help bar above the composer
    Note over Screen,Legacy: no open session shows the start prompt; review phases hand the screen to the review stage
```

Coaching never appears in the chat: each answer gets a quiet marker, and the review of every answer
lives on the wrap-up screen (`features/coaching-note`, composed by `screens/wrap-up`). The
write-then-speak review stage also renders `AnswerReview` from that feature.

The route fills the `dialogueExtras` slot with `features/spoken-recall` (an optional recall of a
saved phrase once every answer is in) and `features/usage-review` (the learning use review after a
spoken answer). Both read the microphone through `core/answer-capture` and keep their own state.

Slots still filled by legacy components, and the issue that migrates each one:

| Slot | Legacy component | Issue |
| :--- | :--- | :--- |
| help bar, planning timer | `HelpBar`, `GuidedAnswerPanel`, `PlanningTimer` | #76 |
| Stuck panel | `RescuePanel` | #77 |
| write then speak review and prompts | `PracticeReview`, `OriginalQuestionPrompt` | #79 |
| mistake practice | shares the screen; its progress is in the header | #80 |
