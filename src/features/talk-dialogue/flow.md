# Talk dialogue

Eva's and the learner's messages, with the reply that is still arriving, and the reads that keep
them current. Coaching never expands in the chat: a learner message carries only a quiet marker
from its coaching state, and the review lives in `features/coaching-note` on the wrap-up.

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

## Following the newest message

The history is one surface with Eva: no frame, and a top fade mask lets older messages dissolve
under her. The view follows the newest message while a reply streams and while notes, notices or
answer help change the height of the content.

```mermaid
stateDiagram-v2
    [*] --> Following
    Following --> Paused: learner scrolls up
    Paused --> Paused: new message arrives, the New message pill appears
    Paused --> Following: learner reaches the end or presses the pill
```

## The quiet coaching marker

The meta line under a learner message always has its own row, so a marker appearing never changes the
height of the message and the chat never shifts. It is not a button.

| Coaching state | Marker |
| :--- | :--- |
| pending | a faint dot ("Being checked") |
| ready, N focus items | "1 tip" or "N tips", tooltip "Reviewed after the conversation" |
| ready, none | "Looks good" |
| failed, paused | nothing |
