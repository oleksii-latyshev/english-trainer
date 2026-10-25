# Spoken recall

Once a voice session has all its answers, Talk offers an optional recall of a phrase saved in an
earlier session: Eva shows a cue, the learner says the phrase, and the transcript is saved as
evidence. It is a text check, never a pronunciation or mastery score. The microphone is the one in
`core/answer-capture`; this feature only decides what the recording is for.

## Offer, record and save

```mermaid
sequenceDiagram
    actor Learner
    participant Panel as SpokenRecall
    participant Plan as recallPlanAtom
    participant Capture as core/answer-capture
    participant Submit as submitRecallAtom
    participant Service as SpokenRecallService
    participant Rust as get_daily_recall_plan / submit_daily_recall

    Panel->>Plan: read when the session has all its answers
    Plan->>Service: plan(sessionId)
    Service->>Rust: invoke
    alt plan
        Rust-->>Panel: due phrases with a cue and the attempts already saved
    else IpcError
        Rust-->>Panel: "Could not load due phrases. Retry to continue." with Retry loading
    end
    Learner->>Panel: Start spoken recall
    Panel->>Capture: reset, recallActiveAtom on (Talk locks the composer and Finish)
    Learner->>Panel: Start recording
    Panel->>Capture: interruptReply and record, then stop, then transcribe locally
    Capture-->>Panel: transcript (or a kept recording with Transcribe retry)
    Learner->>Panel: Save spoken recall
    Panel->>Submit: phrase and transcript
    Submit->>Service: submit
    Service->>Rust: invoke
    alt saved
        Rust-->>Submit: result
        Submit->>Plan: read again, then show "You said", "Saved phrase" and the text check
        Submit->>Capture: reset
    else IpcError
        Rust-->>Panel: the transcript stays, "Could not confirm spoken recall…"
    end
    Learner->>Panel: Next phrase or Return to conversation
    Panel->>Capture: reset, recall off
```

Leaving the recall resets the capture and never saves. A saved attempt is not duplicated by a retry.
