# Talk session

The header of the Talk screen and the session clock. The session itself (state, start, finish,
stage changes) lives in `core/practice-session`; this feature shows it and keeps the Rust clock
honest.

## Clock

```mermaid
sequenceDiagram
    participant Screen as TalkScreen (useSessionClock)
    participant Atom as sessionClockAtom
    participant State as practiceStateAtom
    participant Service as PracticeSessions
    participant Rust as set_practice_clock

    Screen->>Atom: mount
    Atom->>State: an answerable stage is open and the microphone is not paused?
    Atom->>Service: setClock(sessionId, running)
    Service->>Rust: invoke
    Rust-->>State: PracticeSession snapshot (elapsed time, running flag)
    loop every 15 s while running
        Atom->>Service: setClock(sessionId, true)
    end
    alt the stage ends, the mic is paused or the screen closes
        Atom->>Service: setClock(sessionId, false)
    else IpcError while the session is still open
        Service-->>State: a message that clears on the next saved checkpoint
    else IpcError after the session finished
        Service-->>Atom: ignored, finishing already stopped the clock
    end
```

## Header progress

The header shows `mm:ss of mm:ss · mode` with a progress bar when the session has a suggested length,
and only `mm:ss · mode` without a bar when it has none (No limit). Usual-mistake practice shows its
question count instead.

## Header actions

```mermaid
sequenceDiagram
    actor Learner
    participant Header as SessionHeader
    participant Atoms as core/practice-session and core/practice-turn
    participant Rust as conversation commands

    Learner->>Header: Finish, Review writing, Review speaking
    Header->>Atoms: finishPracticeAtom or transitionPhaseAtom
    Atoms->>Rust: finish_practice_session or transition_practice_phase
    Learner->>Header: Pause, Resume
    Header->>Atoms: pauseMicrophone (also stops Eva) or resumeMicrophone
    Note over Header: Pause explains itself when it cannot act (recording, transcribing, Eva replying)
```
