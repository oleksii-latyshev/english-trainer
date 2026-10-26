# Eva growth core flow

Keeps Eva's growth readable from every layer. Rust owns the rules (drops, stages, nap, today's gains);
this module reads the result with `get_eva_growth`, decodes it with `EvaGrowthSchema` and keeps the
Show growth preference in the WebView's `localStorage` (`english_trainer_eva_growth`). Reading is never
on the turn path.

## Read growth

```mermaid
sequenceDiagram
    participant Consumer as any Eva, card or screen
    participant Stage as evaStageAtom / evaNappingAtom
    participant Known as knownGrowthAtom
    participant Growth as evaGrowthAtom
    participant Service as EvaGrowthService
    participant Ipc
    participant Rust as get_eva_growth

    Consumer->>Stage: useAtomValue
    Stage->>Known: last loaded snapshot
    Known->>Growth: result
    Growth->>Service: growth
    Service->>Ipc: invoke("get_eva_growth")
    Ipc->>Rust: IPC (blocking thread)
    alt database unreadable
        Rust-->>Ipc: IpcError database_error
        Ipc-->>Growth: failure
        Known-->>Stage: previous snapshot or null
    else read
        Rust-->>Ipc: EvaGrowth
        Ipc-->>Service: decoded with EvaGrowthSchema
        Service-->>Growth: success
        Growth-->>Known: snapshot
        Stage->>Stage: showGrowth ? stage : null
        Stage-->>Consumer: EvaStage or null; napping only while growth is shown
    end
```

## Refresh

```mermaid
sequenceDiagram
    participant Practice as practiceStateAtom
    participant Finished as finishedSessionAtom
    participant Memory as LEARNING_MEMORY key
    participant Growth as evaGrowthAtom
    participant Known as knownGrowthAtom

    Practice->>Finished: state becomes completed (session id)
    Finished->>Growth: dependency changed, read again
    Memory->>Growth: wrap-up saved phrases or usage evidence
    Growth-->>Known: new snapshot; the old one stays visible meanwhile
```

## Show growth preference

```mermaid
sequenceDiagram
    actor Learner
    participant Settings as Settings › Eva
    participant Pref as growthPreferenceAtom (Atom.kvs)
    participant Store as KeyValueStore.layerStorage

    Learner->>Settings: switches Show growth
    Settings->>Pref: set({ showGrowth })
    Pref->>Store: encode with GrowthSchema, write to localStorage
    Pref-->>Settings: every Eva loses or regains the plant; the sidebar card hides or shows
```
