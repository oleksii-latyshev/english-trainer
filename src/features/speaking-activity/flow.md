# Speaking activity flow

The 26-week grid and the "This week" card on the Talk start screen. Minutes come from the sessions
saved on this Mac (`active_duration_ms` per session, text-chat sessions left out); nothing leaves the
device. The copy is neutral: no streaks, no "you missed" wording, and an empty history shows an
invitation instead of zeros.

## Show the activity

```mermaid
sequenceDiagram
    actor Learner
    participant Screen as TalkStartScreen
    participant Atom as speakingActivityAtom
    participant Service as SpeakingActivityService
    participant Ipc
    participant Command as get_speaking_activity
    participant Rust as SpeakingActivityService (Rust)
    participant Store as SessionActivityStore

    Learner->>Screen: opens Talk
    Screen->>Atom: useAtomValue (ActivityCard, WeekCard)
    Atom->>Service: activity
    Service->>Ipc: invoke("get_speaking_activity")
    Ipc->>Command: IPC
    Command->>Rust: overview() on a blocking thread
    Rust->>Store: active_ms_by_day(now - 190 days)
    alt database unreadable
        Store-->>Rust: SpeakingActivityError::Storage
        Command-->>Ipc: IpcError database_error
        Ipc-->>Atom: failure
        Atom-->>Screen: "could not be loaded" + Retry
    else read
        Store-->>Rust: local day, active ms (sessions grouped by local calendar day)
        Rust-->>Command: days with whole minutes, empty days dropped
        Command-->>Ipc: SpeakingActivity
        Ipc-->>Service: decoded with SpeakingActivitySchema
        Service-->>Atom: AsyncResult.Success
        Atom-->>Screen: buildActivityGrid(days, today) draws weeks, totals and the week bars
    end
```

## Retry

```mermaid
sequenceDiagram
    actor Learner
    participant Card as ActivityCard
    participant Atom as speakingActivityAtom

    Learner->>Card: presses Retry
    Card->>Atom: refresh
    Atom-->>Card: loading, then the grid or the same failure
```
