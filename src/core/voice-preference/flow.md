# Voice preference

How the learner's voice choices are stored and read. They are pure UI preferences kept in the
WebView's `localStorage`; they never cross IPC. Settings writes them, speech playback and first run
read them from the same atoms.

Two keys keep the shapes earlier versions stored:

- `english_trainer_natural_voice`: `{ engine: "natural" | "system", voiceId: 0..9 }`
- `english_trainer_voice`: `{ voiceURI: string | null, rate: 0.85..1.2 }` (system voice and speed)

## Change a preference

```mermaid
sequenceDiagram
    actor Learner
    participant Settings as Voice settings
    participant Atom as naturalVoiceAtom / speechVoiceAtom (Atom.kvs)
    participant Store as KeyValueStore.layerStorage
    participant Speech as core/speech useSpeech

    Learner->>Settings: picks a voice, an engine or a speed
    Settings->>Atom: set(new value)
    Atom->>Store: encode with the schema, write to localStorage
    Atom-->>Speech: new value (React hooks and readNaturalVoice share one registry)
```

## Start the app

```mermaid
sequenceDiagram
    participant Reader as Speech, first run
    participant Atom as naturalVoiceAtom / speechVoiceAtom
    participant Store as KeyValueStore.layerStorage

    Reader->>Atom: reads
    Atom->>Store: get, decode with the schema
    alt stored value decodes
        Store-->>Atom: preference, speed clamped, invalid or missing fields replaced one by one
    else nothing stored, storage blocked or not JSON
        Store-->>Atom: defaults (natural engine, first voice, automatic system voice, 1.0x)
    end
```
