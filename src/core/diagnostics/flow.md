# Diagnostics core flow

A small local log the owner can read from the built app. Rust owns the file; this module only sends
typed events. An event carries enums and numbers, never learner text, so nothing personal can reach
the log. Sending is fire and forget: it never waits and never fails the caller.

The file is `~/Library/Logs/<bundle identifier>/diagnostics.log`, one line per event
(`timestamp area message`). At about 1 MB it moves to `diagnostics.1.log`, replacing the older one,
and a fresh file starts. Rust's own warnings (worker threads, recordings, speech engine fallbacks)
go to the same file and to stderr.

## Record an event

```mermaid
sequenceDiagram
    participant Caller as any core service (for example the speech pipeline)
    participant Service as Diagnostics.record
    participant Ipc
    participant Rust as record_diagnostic_event
    participant File as diagnostics.log

    Caller->>Service: DiagnosticEvent
    Service-->>Caller: returns at once (detached fiber)
    Service->>Service: encode with DiagnosticEventSchema
    Service->>Ipc: invoke("record_diagnostic_event", event)
    Ipc->>Rust: IPC (blocking thread)
    Rust->>File: one line, rotate first when the file is full
    alt write or IPC fails
        Rust-->>Service: ignored; the line is still echoed to stderr
    end
```
