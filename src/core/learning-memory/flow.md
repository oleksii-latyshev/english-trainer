# Learning memory flow

What the learner saved (phrases) and what Eva noticed (mistakes), read from Rust. Rust owns the
learning rules ([TECHNICAL_REQUIREMENTS §9](../../../docs/TECHNICAL_REQUIREMENTS.md)); this module
only reads, decodes and exposes the data to features. `ReviewRunService` wraps the spoken review
commands (run, recall, skip, finish and the review situations) for `features/spoken-review`.

## Read the library without side effects

The Talk start screen, the sidebar badge and the first-run gate read the same data.

```mermaid
sequenceDiagram
    participant Consumer as App / routes/talk-start
    participant Atom as learningMemoryAtom
    participant Service as LearningMemoryService
    participant Ipc
    participant Command as get_learning_memory
    participant Rust as LearningService (Rust)
    participant Repo as SessionLearningStore

    Consumer->>Atom: useAtomValue
    Atom->>Service: read
    Service->>Ipc: invoke("get_learning_memory")
    Ipc->>Command: IPC
    Command->>Rust: memory() on a blocking thread
    Rust->>Repo: memory()
    alt database unreadable
        Repo-->>Rust: LearningError::Storage
        Command-->>Ipc: IpcError database_error
        Ipc-->>Atom: failure
        Atom-->>Consumer: dueMemory() = unavailable
    else read
        Repo-->>Rust: mistakes seen at least twice, every phrase card, due flags
        Command-->>Ipc: LearningMemoryView
        Ipc-->>Service: decoded with LearningMemoryViewSchema
        Atom-->>Consumer: dueMemory() = due count, next due phrase, usual mistakes
    end
```

## Open Memory

Opening the Memory screen reads through `view_learning_memory`: Rust also records that the saved cues
were shown, which the usage review needs to tell cued answers from independent ones.

```mermaid
sequenceDiagram
    participant Screen as Memory screen
    participant Atom as openedLearningMemoryAtom
    participant Ipc
    participant Rust as LearningService (Rust)
    participant Sessions as SessionStore

    Screen->>Atom: useAtomValue
    Atom->>Ipc: invoke("view_learning_memory")
    Ipc->>Rust: open_memory()
    Rust->>Sessions: mark_memory_shown() (only while a conversation is open)
    Rust-->>Ipc: LearningMemoryView
    Ipc-->>Atom: decoded
```

## Evidence of one item

```mermaid
sequenceDiagram
    participant Row as EvidenceList
    participant Atom as memoryUsageEvidenceAtom(item)
    participant Ipc
    participant Rust as LearningService (Rust)

    Row->>Atom: useAtomValue when the row opens
    Atom->>Ipc: invoke("get_memory_usage_evidence", item_type, item_id)
    Ipc->>Rust: usage_evidence()
    alt item removed meanwhile
        Rust-->>Ipc: IpcError invalid_request
        Ipc-->>Row: failure, Retry
    else read
        Rust-->>Ipc: sessions with independent use, streak, last five events (correct, with_help, incorrect)
        Ipc-->>Row: decoded with MemoryUsageEvidenceSchema
    end
```

## The saved review run

The Memory screen and the review read the same run. `activeReviewRunAtom` asks Rust for the run that
was started and not finished; "Resume review" on Memory and its counts come from it.

```mermaid
sequenceDiagram
    participant Card as ReviewCard
    participant Atom as activeReviewRunAtom
    participant Service as ReviewRunService
    participant Ipc
    participant Rust as ReviewService (Rust)

    Card->>Atom: useAtomValue
    Atom->>Service: active
    Service->>Ipc: invoke("get_memory_review")
    Ipc->>Rust: active()
    Rust-->>Card: run with answered and skipped items, or null (Start spoken review)
```

`startItem` (`start_item_review`) opens a run of one chosen item for "Say it now"; an open run is
returned unchanged, like `start`.

`start`, `startItem`, `submit`, `skip` and `finish` carry the `LEARNING_MEMORY` key when `features/spoken-review`
runs them, so the card, the library and the badges reload after every answer.

## Refresh after a change

Changes made through atoms (`archive`, `delete` in `features/memory-library`) carry the
`LEARNING_MEMORY` reactivity key, so every atom above reloads. That includes the saves and undos of
`features/wrap-up` and the usage review of `features/usage-review`.
