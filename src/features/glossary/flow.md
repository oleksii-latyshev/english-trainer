# Personal glossary

The Settings chips of words and names speech recognition should know. Rust merges them with terms
taken from the profile (`effective_glossary_terms`); the UI edits only the manual list. The commands
`get_glossary` and `save_glossary` belong to the audio context and are migrated with the speech step.

## Read the glossary

```mermaid
sequenceDiagram
    actor Learner
    participant Component as Glossary
    participant Atoms as glossaryAtom
    participant Service as GlossaryService
    participant Ipc
    participant Command as get_glossary

    Learner->>Component: opens Settings
    Component->>Atoms: useAtomValue
    Atoms->>Service: get
    Service->>Ipc: invoke("get_glossary")
    Ipc->>Command: IPC
    alt unreadable
        Command-->>Ipc: error
        Atoms-->>Component: "The glossary could not be read." + Retry
    else
        Command-->>Atoms: string list
        Atoms-->>Component: chips (first eight, "+N more" for the rest)
    end
```

## Add or remove a word

```mermaid
sequenceDiagram
    actor Learner
    participant Component as Glossary
    participant Atoms as addGlossaryTermAtom / removeGlossaryTermAtom
    participant Service as GlossaryService
    participant Ipc
    participant Command as save_glossary

    Learner->>Component: types a word, clicks Add (or clicks × on a chip)
    Component->>Atoms: add(word) / remove(word)
    Atoms->>Service: get, then save(list with or without the word)
    Service->>Ipc: invoke("save_glossary", { terms })
    Ipc->>Command: IPC
    alt rejected (empty, too long, database error)
        Command-->>Ipc: error with a message
        Atoms-->>Component: alert, the shown chips and the typed word stay
    else saved
        Command-->>Atoms: normalized list
        Atoms->>Atoms: draft cleared, reactivity key refreshes glossaryAtom
        Atoms-->>Component: the chips with the change
    end
```
