# Write, then speak flow

Write, then speak (F11) runs in four stages: `writing`, `writing_review`, `speaking`,
`speaking_review`. Rust owns the phase and the turn counts (`conversation` context); the frontend
asks for a change and shows what Rust answers. This feature owns the two review screens and the
"original question" prompt shown while the learner speaks. The composer, the chat and the stage
buttons belong to `talk-composer`, `talk-dialogue` and `talk-session`; `screens/talk`
composes them and hands this feature the dialogue, the history error and `AnswerReview` from
`coaching-note`.

Rust reports `written_turn_count` as 0 while the learner is writing; the counts are fixed when
the phase changes (`core/practice-session` helper `session-from-ipc`).

## Review the written answers and start speaking

```mermaid
sequenceDiagram
    actor Learner
    participant Stage as Review writing button (talk-session)
    participant Review as WriteSpeakReview
    participant Phase as core/practice-session transitionPhaseAtom
    participant Service as PracticeSessions
    participant Command as transition_practice_phase
    participant Playback as core/speech playback
    participant Prompt as OriginalQuestion

    Learner->>Stage: Review writing
    Stage->>Phase: writing_review
    Phase->>Service: transition(sessionId, writing_review)
    Service->>Command: validated by Rust
    Command-->>Phase: session with written_turn_count
    Phase-->>Review: Review writing, written answers and their coaching
    Learner->>Review: Ready to speak
    Review->>Phase: speaking
    Phase->>Playback: stop
    Phase->>Service: transition(sessionId, speaking)
    alt accepted
        Command-->>Phase: session in the speaking phase
        Phase->>Playback: play the first original question
        Phase-->>Prompt: Original question 1 of N
    else failed
        Command-->>Phase: typed IpcError
        Phase-->>Review: stays in Review writing with an alert, Ready to speak can be retried
    end
```

No microphone capture or speech playback starts before Ready to speak succeeds.

## Speak the same questions and review them

```mermaid
sequenceDiagram
    actor Learner
    participant Prompt as OriginalQuestion
    participant Turn as talk-composer and core/practice-turn
    participant Stage as Review speaking button (talk-session)
    participant Phase as core/practice-session transitionPhaseAtom
    participant Review as WriteSpeakReview
    participant Answer as AnswerReview (coaching-note)
    participant Finish as finishPracticeAtom

    Learner->>Turn: speaks answer, sends it
    Turn-->>Prompt: next original question, or Replay complete
    Learner->>Stage: Review speaking
    Stage->>Phase: speaking_review
    Phase-->>Review: written and spoken answers in two lists
    Review->>Answer: one per answer, with its coaching state
    Note over Review,Answer: pending, paused or failed coaching is shown as such and never blocks the review
    Learner->>Review: Finish
    Review->>Finish: finish the session
    Finish-->>Learner: wrap-up with both stages counted
```

Finish and Ready to speak are disabled while the session is busy, while another change is in
flight or while the learner is re-speaking an answer in the review (`sayAgainActiveAtom`, passed
in by the route as `isLocked`).
