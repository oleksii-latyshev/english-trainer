# Eva look flow

The learner picks Eva's colours and motion in Settings › Eva. The choice is a pure UI preference kept
in the WebView's `localStorage`; it never crosses IPC.

## Choose a look

```mermaid
sequenceDiagram
    actor Learner
    participant Settings as Settings › Eva
    participant Look as evaLookAtom (Atom.kvs)
    participant Store as KeyValueStore.layerStorage
    participant Applier as EvaLookApplier
    participant Root as document root
    participant Eva as every Eva

    Learner->>Settings: picks a body, ink, leaf, bloom or motion
    Settings->>Look: set(look)
    Look->>Store: encode with EvaLookSchema, write to localStorage
    Look-->>Applier: new value
    Applier->>Root: layout effect sets --eva-* properties and data-eva-motion
    Root-->>Eva: new colours and animations
```

## Start the app

```mermaid
sequenceDiagram
    participant Main as main.tsx
    participant Applier as EvaLookApplier
    participant Look as evaLookAtom
    participant Store as KeyValueStore.layerStorage
    participant Root as document root

    Main->>Applier: mounts once
    Applier->>Look: reads
    Look->>Store: get, decode with EvaLookSchema
    alt stored value decodes
        Store-->>Look: look, legacy fields renamed (sphere, eye, pearl to cloud)
    else missing, blocked or invalid
        Store-->>Look: default look, per field
    end
    Applier->>Root: applies the look
```
