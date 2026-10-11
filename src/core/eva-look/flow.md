# Eva look flow

The learner picks Eva's colours and motion in Settings › Eva. The choice is a pure UI preference kept
in the WebView's `localStorage`; it never crosses IPC.

## Choose a look

```mermaid
sequenceDiagram
    actor Learner
    participant Settings as Settings › Eva
    participant Look as evaLookAtom
    participant Applied as evaLookAppliedAtom
    participant Storage as localStorage
    participant Root as document root
    participant Eva as every Eva

    Learner->>Settings: picks a body, ink, leaf, bloom or motion
    Settings->>Look: set(look)
    Look-->>Applied: changed
    Applied->>Storage: store(look)
    Applied->>Root: custom properties --eva-* and data-eva-motion
    Root-->>Eva: new colours and animations
```

## Start the app

```mermaid
sequenceDiagram
    participant Main as main.tsx
    participant Applier as EvaLookApplier
    participant Look as evaLookAtom
    participant Storage as localStorage
    participant Root as document root

    Main->>Applier: mounts once
    Applier->>Look: reads
    Look->>Storage: readStoredEvaLook
    alt stored value parses
        Storage-->>Look: look, legacy ids mapped (pearl to cloud)
    else missing, blocked or invalid
        Storage-->>Look: default look, per field
    end
    Applier->>Root: applies the look
```
