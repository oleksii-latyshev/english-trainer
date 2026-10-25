# Coaching note

The review of one answer, and of the whole conversation on the wrap-up: what the learner said, the
more natural version with the changed words marked, one short reason, Hear it and Say it again.
Talk never shows it; Talk only marks an answer (`features/talk-dialogue`). The wrap-up screen
(`screens/wrap-up`) renders `ConversationReview`, and the write-then-speak review stage renders
`AnswerReview` per answer. Both take an optional `renderAnswerActions` slot that adds actions beside
Hear it; the wrap-up screen uses it for the per-answer save of `features/wrap-up`.

## Read the conversation and fill in pending answers

```mermaid
sequenceDiagram
    actor Learner
    participant View as ConversationReview
    participant Atoms as conversationAtom
    participant Service as CoachingNoteService
    participant Ipc as Ipc and IpcEvents
    participant Rust as get_practice_dialogue

    Learner->>View: opens the wrap-up
    View->>Atoms: useAtomValue and mount the update stream
    Atoms->>Service: readConversation(sessionId)
    Service->>Ipc: get_practice_dialogue
    Ipc->>Rust: invoke (works for a finished session)
    alt turns and coaching
        Rust-->>View: every turn, each answer pending, ready, failed or paused
    else IpcError or decode failure
        Rust-->>View: notice with Retry (an earlier read stays visible)
    end
    Note over View: a pending answer shows "Checking your answer…"
    Rust-->>Ipc: coaching-updated for this session
    Ipc-->>Atoms: refresh (no polling), answers fill in where they stand
```

The stream is the same `coaching-updated` signal the wrap-up already listens to. It is read here
too because a retried answer that gave up earlier is not counted as pending, so the wrap-up
summary would not refresh for it.

## Check an answer again

```mermaid
sequenceDiagram
    actor Learner
    participant Review as AnswerReview
    participant Retry as retryCoachingAtom
    participant Service as CoachingNoteService
    participant Rust as retry_answer_coaching

    Learner->>Review: Retry (failed) or Try again (paused)
    Review->>Retry: target (session, sequence)
    Retry->>Service: retryCoaching
    Service->>Rust: invoke, which also resumes a paused queue
    alt accepted
        Rust-->>Retry: ok
        Retry->>Review: conversation read again, the answer is pending
    else IpcError
        Rust-->>Review: "Could not ask again. Please retry."
    end
```

## Say it again

Capture is `core/answer-capture` (one microphone path for the whole app). The feature only decides
which answer is being re-spoken (`sayAgainTargetAtom`) and reacts to the transcript.

```mermaid
sequenceDiagram
    actor Learner
    participant UI as SayAgain
    participant Controls as startSayAgain
    participant Capture as core/answer-capture
    participant Effects as sayAgainEffectsAtom
    participant Service as CoachingNoteService
    participant Rust as retry_practice_turn

    Learner->>UI: Say it again
    UI->>Controls: target
    Controls->>Capture: reset, startListening (manual)
    Capture-->>UI: requesting, then recording (Stop is enabled once it records)
    Learner->>UI: Stop recording
    Capture->>Capture: transcribe locally
    alt transcript
        Capture-->>Effects: transcript text
        Effects->>Service: compareSecondTry(session, sequence, transcript)
        Service->>Rust: invoke
        alt comparison
            Rust-->>Effects: AttemptComparison
            Effects-->>UI: "Second try" with the transcript, a win line or a hint
        else IpcError
            Rust-->>UI: message, capture reset, the learner can record again
        end
    else transcription failed
        Capture-->>UI: message, Retry transcription when the recording was kept
    end
    Learner->>UI: Cancel
    UI->>Controls: cancelSayAgain (drops the target, resets capture, interrupts a comparison)
```

Only one answer is re-spoken at a time: the other answers' buttons are disabled while one is active.
`sayAgainActiveAtom` lets the route lock the turn composer while the write-then-speak review stage
is open. A comparison lasts for the life of the screen; Rust also saves it (`attempt_comparisons`).
