# Wrap-up

The numbers, the phrases worth learning and the saves of one finished session. `screens/wrap-up`
composes this feature with `features/coaching-note` (Your conversation); features never import each
other, so the screen hands the per-answer save to the review as a slot.

## Fill in live

The wrap-up opens with the snapshot `finish_practice_session` returned. The feature reads the session
again and keeps it current, so phrases and the "Still checking" line change as work lands in Rust.
The conversation never waits for either.

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
        Rust-->>Screen: numbers, phrases, preparation, pending coaching
    else IpcError or decode failure
        Rust-->>Screen: the snapshot already on screen stays
    end
    Atoms->>Atoms: both listeners registered, the marker triggers a read
    Rust-->>Ipc: wrapup-updated or coaching-updated for this session
    Ipc-->>Atoms: refresh (events of other sessions are dropped)
    Atoms-->>Screen: the new snapshot replaces the old one
```

`IpcEvents.listenAll` registers both listeners and then emits a "listening" marker before any
event. The feature reads the summary when the marker arrives and again on each matching event, so a
result that lands between registration and the first read is not lost. There is no timer.

## Save all and Undo

```mermaid
sequenceDiagram
    actor Learner
    participant Section as PhraseSection
    participant Save as savePhrasesAtom
    participant Service as WrapUpService
    participant Rust as save_wrapup_phrases
    participant Toast as saved toast
    participant Undo as undoPhrasesAtom
    participant Memory as LearningMemoryService

    Learner->>Section: Remove on a phrase
    Section->>Section: the phrase leaves the list (kept for this session)
    Learner->>Section: Save all N phrases to Memory
    Section->>Save: the kept phrases that are not saved yet
    Save->>Service: savePhrases(sessionId, phrases)
    Service->>Rust: invoke (one transaction)
    alt saved
        Rust-->>Save: cards and created_ids
        Save->>Section: phrases marked saved, button says Saved to Memory
        Save->>Toast: Saved to Memory, with Undo only when created_ids is not empty
        Note over Save: the LEARNING_MEMORY key reloads Memory and the badges
    else IpcError
        Rust-->>Section: "Could not save these phrases. Please try again."
    end
    Learner->>Toast: Undo
    Toast->>Undo: phrases and created_ids
    Undo->>Memory: remove each created phrase card
    alt removed
        Undo->>Section: phrases are unsaved again, toast "Removed from Memory"
    else failure
        Undo->>Toast: "Could not undo the save. Remove it from Memory instead."
    end
```

Undo removes only the cards this save created; a phrase that was already in Memory is never deleted.

## Prepare phrases again

```mermaid
sequenceDiagram
    actor Learner
    participant Section as PhraseSection
    participant Retry as retryPreparationAtom
    participant Service as WrapUpService
    participant Rust as retry_session_wrapup

    Learner->>Section: Retry phrases or Prepare phrases
    Section->>Retry: sessionId
    Retry->>Service: retryPreparation
    Service->>Rust: invoke (wakes the worker)
    alt accepted
        Rust-->>Retry: ok
        Retry->>Section: read again, "Preparing phrases from your answers…"
        Rust-->>Section: wrapup-updated, the phrases fill in
    else IpcError
        Rust-->>Section: the Rust message, or "Could not prepare phrases. Please retry."
    end
```

## Save the better version of one answer

`SaveAnswerPhrase` is rendered by the screen inside each ready review of "Your conversation". It
saves the improved wording of the first focus point with its explanation, or the whole natural
rewrite when there is no focus point, with the session and answer it came from. Nothing is offered
when the phrase is longer than a Memory card takes.

```mermaid
sequenceDiagram
    actor Learner
    participant Button as SaveAnswerPhrase
    participant Save as saveAnswerAtom
    participant Service as WrapUpService
    participant Rust as save_phrase_card
    participant Undo as undoAnswerAtom

    Learner->>Button: Save phrase
    Button->>Save: phrase, note, session, answer
    Save->>Service: saveAnswerPhrase
    Service->>Rust: invoke
    alt saved
        Rust-->>Save: the card
        Save->>Button: Saved to Memory, with Undo only for a card created by this save
    else IpcError
        Rust-->>Button: "Retry saving phrase"
    end
    Learner->>Undo: Undo
    Undo->>Button: Save phrase again after the card is removed
```
