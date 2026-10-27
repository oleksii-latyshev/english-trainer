# Eva settings flow

Settings › Eva changes how Eva looks (`core/eva-look`), whether her growth shows, which Dock icon the
app uses, and previews her faces. Everything except the Dock icon is a pure UI preference kept in
the WebView's `localStorage`. The Dock icon crosses IPC because only the Dock tile can change it.
The growth switch is a stored visual preference that lives in `core/eva-growth`; every Eva and the sidebar card read it.

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
    participant Atoms as previewMoodAtom, previewStageAtom, growthPreferenceAtom

    Learner->>Guide: clicks a face
    Guide->>Atoms: previewMoodAtom = mood
    Learner->>Controls: picks Sprout, Bud, Bloom or Full bloom
    Controls->>Atoms: pickPreviewStageAtom: previewStageAtom = stage, growthPreferenceAtom = shown
    Atoms-->>Controls: preview redrawn
```

## Switch growth

```mermaid
sequenceDiagram
    actor Learner
    participant Controls as EvaLookControls
    participant Growth as growthPreferenceAtom (Atom.kvs)
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
    participant Stage as evaStageAtom (core/eva-growth)
    participant Sync as dockIconSyncAtom
    participant Service as DockIconService
    participant Ipc as Ipc
    participant Rust as set_dock_icon

    Learner->>Controls: picks Eva, Dark or Light
    Controls->>Icon: set({ icon })
    Icon->>Store: encode with DockIconSchema, write to localStorage
    Icon-->>Sync: new value
    Stage-->>Sync: the stage, read only for the Eva style (null while growth is hidden)
    Sync->>Service: apply(icon, stage)
    Service->>Ipc: invokeUnitCommand
    Ipc->>Rust: set_dock_icon { icon, stage }
    Note over Rust: Eva with a stage shows that stage's tile, Eva without one the bundle icon, Dark and Light ignore it
    alt the Dock tile changed
        Rust-->>Ipc: null
    else rejected
        Ipc-->>Service: IpcError or IpcDecodeError
        Service-->>Sync: logged as a warning, the choice is kept
    end
```

Eva's stage changing (a new drop, or Show growth flipped) re-applies the Dock icon the same way; the
sync reads the stage only for the Eva style, so Dark and Light never re-apply and an unchanged
style and stage never cross IPC again.

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
    participant Atoms as evaLookAtom, growthPreferenceAtom, dockIconAtom, preview atoms

    Learner->>Controls: Reset to default
    Controls->>Reset: run
    Reset->>Atoms: default look, growth shown, Eva Dock icon, Happy face at Bloom
```
