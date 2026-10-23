# Talk dialogue

Eva's and the learner's messages, with the reply that is still arriving, and the reads that keep
them current. Coaching notes are not here: the screen passes a render function for the note under
each answer.

```mermaid
sequenceDiagram
    participant Screen as TalkScreen
    participant View as dialogueViewAtom
    participant Service as DialogueService
    participant Ipc as Ipc and IpcEvents
    participant Rust as get_practice_dialogue
    participant Turn as core/practice-turn pendingReplyAtom

    Screen->>View: read
    View->>Service: read(sessionId)
    Service->>Ipc: get_practice_dialogue
    Ipc->>Rust: invoke
    alt history
        Rust-->>View: turns, input sources, times, help use, coaching state
    else IpcError or a dialogue of another session
        Rust-->>View: the earlier history stays and a retry notice appears
    end
    Note over View: read again when the turn count, the prompt or the stage changes
    Rust-->>Ipc: coaching-updated event for this session
    Ipc-->>View: read again (the screen never polls)
    Turn-->>Screen: reply text while streaming
    Note over Screen: shown until the saved history has the turn, then the saved message replaces it
```
