# Eva settings flow

Settings › Eva changes how Eva looks (`core/eva-look`), whether her growth shows, which Dock icon the
app uses, and previews her faces. Everything except the Dock icon is a pure UI preference kept in
the WebView's `localStorage`. The Dock icon crosses IPC because only the Dock tile can change it.
The growth switch is a stored visual preference: nothing reads it yet except this preview.

## Choose a look

```mermaid
sequenceDiagram
    actor Learner
    participant Controls as EvaLookControls
    participant Look as evaLookAtom (core/eva-look)
    participant Preview as EvaPreview and EvaMoodGuide

    Learner->>Controls: picks a body, eyes, leaves, bloom or animation
    Controls->>Look: set(look)
    Look-->>Preview: new colours and motion (EvaLookApplier sets --eva-* on the document root)
    Note over Controls: locked leaves and blooms are disabled and say how to unlock them
```

## Preview a face or a growth stage

```mermaid
sequenceDiagram
    actor Learner
    participant Guide as EvaMoodGuide
    participant Controls as EvaPreview
    participant Atoms as previewMoodAtom, previewStageAtom, growthAtom

    Learner->>Guide: clicks a face
    Guide->>Atoms: previewMoodAtom = mood
    Learner->>Controls: picks Sprout, Bud, Bloom or Full bloom
    Controls->>Atoms: pickPreviewStageAtom: previewStageAtom = stage, growthAtom = shown
    Atoms-->>Controls: preview redrawn
```

## Switch growth

```mermaid
sequenceDiagram
    actor Learner
    participant Controls as EvaLookControls
    participant Growth as growthAtom (Atom.kvs)
    participant Store as KeyValueStore.layerStorage

    Learner->>Controls: flips Growth
    Controls->>Growth: set({ showGrowth })
    Growth->>Store: encode with GrowthSchema, write to localStorage
    Growth-->>Controls: preview shows or hides the plant
```

## Choose the Dock icon

```mermaid
sequenceDiagram
    actor Learner
    participant Controls as EvaLookControls
    participant Icon as dockIconAtom (Atom.kvs)
    participant Store as KeyValueStore.layerStorage
    participant Sync as dockIconSyncAtom
    participant Service as DockIconService
    participant Ipc as Ipc
    participant Rust as set_dock_icon

    Learner->>Controls: picks Eva, Dark or Light
    Controls->>Icon: set({ icon })
    Icon->>Store: encode with DockIconSchema, write to localStorage
    Icon-->>Sync: new value
    Sync->>Service: apply(icon)
    Service->>Ipc: invokeUnitCommand
    Ipc->>Rust: set_dock_icon
    alt the Dock tile changed
        Rust-->>Ipc: null
    else rejected
        Ipc-->>Service: IpcError or IpcDecodeError
        Service-->>Sync: logged as a warning, the choice is kept
    end
```

## Start the app

```mermaid
sequenceDiagram
    participant Main as main.tsx
    participant Applier as DockIconApplier
    participant Sync as dockIconSyncAtom
    participant Icon as dockIconAtom
    participant Rust as set_dock_icon

    Main->>Applier: mounts once
    Applier->>Sync: mounts
    Sync->>Icon: reads the saved icon (missing or unknown becomes Eva)
    Sync->>Rust: set_dock_icon, because the Dock tile exists only while the app runs
```

## Reset to default

```mermaid
sequenceDiagram
    actor Learner
    participant Controls as EvaLookControls
    participant Reset as resetEvaSettingsAtom
    participant Atoms as evaLookAtom, growthAtom, dockIconAtom, preview atoms

    Learner->>Controls: Reset to default
    Controls->>Reset: run
    Reset->>Atoms: default look, growth shown, Eva Dock icon, Happy face at Bloom
```
