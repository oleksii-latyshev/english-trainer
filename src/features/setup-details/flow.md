# Setup details flow

The Setup details panel at the end of Settings shows what the app found for local transcription and
coaching: the Whisper command, server and model, the `agy` command and the database path. It stays
closed until the learner needs it, and offers to run setup again. `get_setup_diagnostics` belongs to
the `setup` module in Rust, which has no context of its own yet: its types derive `ts_rs::TS` and
are decoded with `SetupDiagnosticsSchema` in `core/ipc`.

## Read and recheck

```mermaid
sequenceDiagram
    actor Learner
    participant Panel as SetupDetails
    participant Atom as setupDiagnosticsAtom
    participant Service as SetupDiagnosticsService
    participant Ipc as Ipc
    participant Rust as get_setup_diagnostics

    Learner->>Panel: opens Settings
    Panel->>Atom: reads
    Atom->>Service: read
    Service->>Ipc: invokeCommand
    Ipc->>Rust: IPC
    alt the files are checked
        Rust-->>Panel: one line per file with its status, path and advice for what is missing
    else the command fails or answers an unexpected shape
        Ipc-->>Panel: failure, "Setup details could not be read."
    end
    Learner->>Panel: Recheck files
    Panel->>Atom: refresh, "Checking setup…" until the answer arrives
```

## Run setup again

```mermaid
sequenceDiagram
    actor Learner
    participant Panel as SetupDetails
    participant Host as Settings (host)

    Learner->>Panel: Run setup again
    alt a conversation or practice recording owns the microphone
        Panel-->>Learner: button disabled, the host's reason is shown
    else free
        Panel->>Host: onRunSetupAgain
        Host-->>Learner: opens first run
    end
```
