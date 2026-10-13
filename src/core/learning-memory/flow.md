# Learning memory flow

What the learner saved (phrases) and what Eva noticed (mistakes), read from Rust. Rust owns the
learning rules ([TECHNICAL_REQUIREMENTS §9](../../../docs/TECHNICAL_REQUIREMENTS.md)); this module
only reads, decodes and exposes the data to features. Spoken review and mistake practice keep their
own commands until their slice moves.

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
        Rust-->>Ipc: sessions with independent use, streak, last five events
        Ipc-->>Row: decoded with MemoryUsageEvidenceSchema
    end
```

## Refresh after a change

Changes made through atoms (`archive`, `delete` in `features/memory-library`) carry the
`LEARNING_MEMORY` reactivity key, so every atom above reloads. Legacy code that still changes
Memory (saving a phrase from Talk, a finished review or session) calls `refreshLearningMemory()`.
