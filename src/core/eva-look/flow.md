# Eva look flow

The learner picks Eva's colours and motion in Settings › Eva. The choice is a pure UI preference kept
in the WebView's `localStorage`; it never crosses IPC. The same store keeps whether Talk shows Eva
folded into the session header (`evaFoldedAtom`, default unfolded).

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

## Fold Eva on Talk

```mermaid
sequenceDiagram
    actor Learner
    participant Talk as Talk (TurnStage, FoldedEva, FoldEvaButton)
    participant Fold as evaFoldedAtom (Atom.kvs)
    participant Store as KeyValueStore.layerStorage

    Learner->>Talk: Fold Eva, or Unfold Eva in the session header
    Talk->>Fold: set(isFolded)
    Fold->>Store: write to localStorage
    Fold-->>Talk: folded shows a small avatar and her state in the header, unfolded shows the full stage
    Note over Fold,Store: on start the stored boolean is read; missing or invalid means unfolded
```
