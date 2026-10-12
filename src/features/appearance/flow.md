# Appearance flow

The learner picks System, Light or Dark in Settings › Appearance. The choice is a pure UI preference
kept in the WebView's `localStorage`; it never crosses IPC.

## Choose a theme

```mermaid
sequenceDiagram
    actor Learner
    participant Settings as AppearanceSettings
    participant Atom as appearanceAtom (Atom.kvs)
    participant Store as KeyValueStore.layerStorage
    participant Applier as ThemeApplier
    participant Root as document root

    Learner->>Settings: picks System, Light or Dark
    Settings->>Atom: set({ theme })
    Atom->>Store: encode with AppearanceSchema, write to localStorage
    Atom-->>Applier: new value
    Applier->>Root: layout effect sets data-theme and the dark or light class
    Note over Applier,Root: System follows prefers-color-scheme until the choice changes
```

## Start the app

```mermaid
sequenceDiagram
    participant Main as main.tsx
    participant Applier as ThemeApplier
    participant Atom as appearanceAtom
    participant Store as KeyValueStore.layerStorage
    participant Root as document root

    Main->>Applier: mounts once
    Applier->>Atom: reads
    Atom->>Store: get, decode with AppearanceSchema
    alt stored theme is system, light or dark
        Store-->>Atom: the stored theme
    else missing, blocked or unknown theme
        Store-->>Atom: system
    end
    Applier->>Root: applies the theme and follows the system appearance
```
