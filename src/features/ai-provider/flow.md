# AI provider flow

Settings › Conversation AI: choosing the provider, the Antigravity model, Eva's style and the
"Test AI response" check. The saved values live in `core/ai-settings` (see its `flow.md`); the
Gemini key field is composed in by the screen as a slot, because features never import each other.

## Choose a provider, model or style

```mermaid
sequenceDiagram
    actor Learner
    participant Settings as AiProviderSettings
    participant Atoms as updateAiSettingsAtom (core/ai-settings)
    participant Service as AiSettingsService
    participant Ipc
    participant Command as save_ai_settings
    participant Rust as AiSettingsService (Rust)
    participant Store as SessionSettingsStore

    Learner->>Settings: selects a card or a select option
    Settings->>Atoms: update({ provider | agy_model | eva_style })
    Atoms->>Service: get, then save the merged settings
    Service->>Ipc: invoke("save_ai_settings", { settings })
    Ipc->>Command: IPC
    Command->>Rust: save(settings)
    Rust->>Store: save(settings)
    alt save failed
        Command-->>Ipc: IpcError database_error
        Atoms-->>Settings: error notice, cards keep the saved choice
    else saved
        Command-->>Ipc: AiSettings
        Atoms->>Atoms: reactivity refreshes aiSettingsAtom
        Atoms-->>Settings: the card selects, Gemini shows the key field, Antigravity its model
    end
```

## Test the AI response

```mermaid
sequenceDiagram
    actor Learner
    participant Test as ResponseTest
    participant Atoms as runResponseTestAtom
    participant Service as ResponseTestService
    participant Ipc
    participant Command as generate_follow_up
    participant Rust as AiSettingsService (Rust)
    participant Provider as providers::generate_configured_turn

    Learner->>Test: presses Run test
    Test->>Atoms: run
    Atoms->>Atoms: clear responseTestStreamAtom
    Atoms->>Service: run(sample sentence, onDelta)
    Service->>Ipc: invoke("generate_follow_up", { transcript, onReply: channel })
    Ipc->>Command: IPC
    Command->>Rust: get() the saved settings
    Command->>Provider: generate the reply on a blocking thread
    loop reply text arrives
        Provider-->>Command: delta
        Command-->>Service: channel message { kind: "delta", text }
        Service-->>Atoms: onDelta appends to responseTestStreamAtom
        Atoms-->>Test: streamed words shown
    end
    alt provider failed (no key, offline, Apple Intelligence off, agy signed out)
        Command-->>Ipc: IpcError with the provider's code and message
        Ipc-->>Atoms: failure
        Atoms-->>Test: error notice with that message
    else reply could not be read
        Ipc-->>Atoms: IpcDecodeError
        Atoms-->>Test: "The provider returned a response the app could not read…"
    else replied
        Command-->>Ipc: ConversationTurn
        Ipc-->>Service: decoded with ConversationTurnSchema
        Atoms-->>Test: First words / Full reply timings, the reply, "Answered by"
    end
```
