# Conversation flow preference

How the learner's conversation rhythm is stored and read. It is a pure UI preference kept in the
WebView's `localStorage`; it never crosses IPC. Settings writes it, Talk and the microphone read it
from the same atom.

## Change a setting

```mermaid
sequenceDiagram
    actor Learner
    participant Settings as Conversation flow settings
    participant Flow as conversationFlowAtom (Atom.kvs)
    participant Store as KeyValueStore.layerStorage
    participant Talk as Talk, microphone, listening

    Learner->>Settings: toggles hands-free, picks a pause or an auto-send delay
    Settings->>Flow: set({ ...flow, patch })
    Flow->>Store: encode with ConversationFlowSchema, write to localStorage
    Flow-->>Talk: new value (React hooks and readConversationFlow share one registry)
```

## Start the app

```mermaid
sequenceDiagram
    participant Talk as Talk, microphone, listening
    participant Flow as conversationFlowAtom
    participant Store as KeyValueStore.layerStorage

    Talk->>Flow: reads
    Flow->>Store: get, decode with ConversationFlowSchema
    alt stored value decodes
        Store-->>Flow: preference, durations clamped, invalid or missing fields replaced one by one
    else nothing stored, storage blocked or not JSON
        Store-->>Flow: defaults, written back
    end
```
