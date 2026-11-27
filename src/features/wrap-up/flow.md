# Wrap-up

The numbers, the "Still checking" line and the Take button of one finished session. `screens/wrap-up`
composes this feature with `features/coaching-note` (the Debrief); features never import each
other, so the screen hands the Take button and the taken state to the Debrief.

## Fill in live

The wrap-up opens with the snapshot `finish_practice_session` returned. The feature reads the session
again and keeps it current, so the numbers and the "Still checking" line change as coaching lands in
Rust. The conversation never waits for it.

```mermaid
sequenceDiagram
    actor Learner
    participant Screen as WrapUpScreen
    participant Hook as useLiveWrapup
    participant Atoms as wrapupAtom / wrapupUpdatesAtom
    participant Service as WrapUpService
    participant Ipc as Ipc and IpcEvents
    participant Rust as get_session_wrapup

    Learner->>Screen: finishes a session
    Screen->>Hook: the finished snapshot
    Hook->>Atoms: mount the update stream, read
    Atoms->>Service: read(sessionId)
    Service->>Ipc: get_session_wrapup
    Ipc->>Rust: invoke
    alt snapshot
        Rust-->>Screen: numbers, pending coaching
    else IpcError or decode failure
        Rust-->>Screen: the snapshot already on screen stays
    end
    Atoms->>Atoms: the listener is registered, the marker triggers a read
    Rust-->>Ipc: coaching-updated for this session
    Ipc-->>Atoms: refresh (events of other sessions are dropped)
    Atoms-->>Screen: the new snapshot replaces the old one
```

`IpcEvents.listenAll` registers the listener and then emits a "listening" marker before any
event. The feature reads the summary when the marker arrives and again on each matching event, so a
result that lands between registration and the first read is not lost. There is no timer.

## Take a word

`TakeWord` is rendered by the screen beside each word of a Debrief card that Rust offered (at most
five per session; the cap is a Rust decision). It saves the word as a Memory phrase with its meaning
and the session and answer it came from, so the existing weaving into later questions and the
"used on your own" evidence rules apply unchanged. `useIsTaken` tells the Debrief which words are
taken, for the "N of M taken" line and the summary.

```mermaid
sequenceDiagram
    actor Learner
    participant Button as TakeWord
    participant Take as takeWordAtom
    participant Service as WrapUpService
    participant Rust as save_phrase_card
    participant Undo as undoTakeAtom

    Learner->>Button: Take
    Button->>Take: phrase, meaning, session, answer
    Take->>Service: saveWord
    Service->>Rust: invoke
    alt saved
        Rust-->>Take: the card
        Take->>Button: Taken, with a toast that offers Undo only for a card created by this take
    else IpcError
        Rust-->>Button: "Retry taking"
    end
    Learner->>Undo: Undo
    Undo->>Button: Take again after the card is removed
```
