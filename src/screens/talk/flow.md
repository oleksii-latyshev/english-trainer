# Talk screen

`screens/talk` composes the Talk features over the core atoms. `routes/talk` only mounts it and passes
the two navigation callbacks (Settings, the microphone section of Settings). Features never import
each other: the screen reads the state that crosses them (`core/practice-session`,
`core/answer-capture`, `core/practice-turn`) and hands each feature what it needs as props or slots.

```mermaid
sequenceDiagram
    actor Learner
    participant Route as routes/talk
    participant Screen as TalkScreen
    participant Session as features/talk-session
    participant Composer as features/talk-composer
    participant Dialogue as features/talk-dialogue
    participant Help as features/answer-help
    participant Rescue as features/rescue
    participant Recall as features/spoken-recall
    participant Usage as features/usage-review
    participant Review as features/write-speak
    participant Coaching as features/coaching-note

    Learner->>Route: opens /conversation
    Route->>Screen: onOpenSettings, onChooseMicrophone
    Screen->>Session: header, clock, Pause, Finish
    Screen->>Composer: Eva's stage, composer, live transcript
    Screen->>Dialogue: messages, streaming reply, extras
    Screen->>Composer: helpSlot (AnswerHelp) and rescueSlot (Rescue)
    Screen->>Help: only when the stage keeps the microphone warm and nothing else holds the turn
    Screen->>Rescue: only while the capture is recording
    Screen->>Recall: once every answer is in
    Screen->>Usage: after a spoken answer
    Dialogue-->>Learner: a quiet tip marker beside each answer, never a note
    Note over Screen,Review: no open session shows the start prompt; review phases hand the screen to ReviewStage
    Screen->>Review: ReviewStage with renderAnswerReview
    Review->>Coaching: AnswerReview for each written or spoken answer
```

Coaching never appears in the chat: each answer gets a quiet marker, and the review of every answer
lives on the wrap-up screen (`features/coaching-note`, composed by `screens/wrap-up`). The
write-then-speak review stage (`features/write-speak`) renders `AnswerReview` from that feature
through a render prop, and the spoken replay shows `OriginalQuestion`.

The screen owns the cross-feature guards in `model/use-talk-guards`: while a phrase recall or a
Say it again retry is running the turn is locked (`lockTurn`), Finish is blocked during recall, a
retry is cancelled when the stage changes, and the composer shows the matching reason.
Mistake practice shares the screen; its progress is in the header, help and rescue are not offered,
and the stage locks with "Practice complete" once the five questions are answered.
