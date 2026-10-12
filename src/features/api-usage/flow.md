# API usage flow

Settings › Usage: what the app can tell about the Gemini and Antigravity limits. Neither provider
reports its remaining quota, so requests are counted where they are sent and limit errors are
noted where they arrive; Google's own page shows the exact figures.

## Record usage (providers)

```mermaid
sequenceDiagram
    participant Provider as Gemini / Antigravity request
    participant Recorder as api_usage::record_request / record_limit
    participant Thread as recording thread
    participant Rust as ApiUsageService (Rust)
    participant Store as SessionUsageStore

    Provider->>Recorder: a request was sent, or the provider said its limit is reached
    Recorder->>Thread: UsageEvent over a channel, never delaying the reply
    Thread->>Rust: record(event)
    Rust->>Store: record(event)
    alt the count cannot be saved
        Store-->>Rust: ApiUsageError::Storage
        Rust-->>Thread: dropped, nothing else depends on it
    end
```

## Show usage

```mermaid
sequenceDiagram
    actor Learner
    participant Settings as ApiUsageSettings
    participant Atoms as apiUsageAtom
    participant Service as ApiUsageService
    participant Ipc
    participant Command as get_api_usage
    participant Rust as ApiUsageService (Rust)
    participant Store as SessionUsageStore

    Learner->>Settings: opens Settings, or presses Refresh
    Settings->>Atoms: useAtomValue / refresh
    Atoms->>Service: snapshot
    Service->>Ipc: invoke("get_api_usage")
    Ipc->>Command: IPC
    Command->>Rust: overview() on a blocking thread
    Rust->>Store: overview(now) for the Pacific day
    alt database unreadable
        Store-->>Rust: ApiUsageError::Storage
        Command-->>Ipc: IpcError database_error
        Ipc-->>Atoms: failure
        Atoms-->>Settings: "Usage could not be loaded" + Retry
    else counts
        Command-->>Ipc: ApiUsageOverview
        Ipc-->>Service: decoded with ApiUsageOverviewSchema
        Service-->>Atoms: usage + loadedAtMs
        Atoms-->>Settings: requests per model, limit notes, time until the daily reset
    end
```

## Open Google AI Studio

```mermaid
sequenceDiagram
    actor Learner
    participant Settings as ApiUsageSettings
    participant Atoms as openExternalLinkAtom (core/external-link)
    participant Service as ExternalLinkService
    participant Opener as tauri-plugin-opener / window.open

    Learner->>Settings: presses Open AI Studio
    Settings->>Atoms: open(aistudio.google.com/usage)
    Atoms->>Service: open(url)
    Service->>Opener: default browser (a new tab in the web preview)
    alt the link cannot be opened
        Opener-->>Service: ExternalLinkError
        Service-->>Atoms: failure, ignored: the page can be opened by hand
    end
```
