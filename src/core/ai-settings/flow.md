# AI settings flow

The saved conversation provider, Antigravity model and Eva's style. Read by Settings
(`AiProviderSettings`), first run (`ProviderList`) and Talk (`useConversationProvider`,
`usePrewarmProvider`). The Gemini API key never travels here: it has its own feature,
`gemini-key`.

## Read the settings

```mermaid
sequenceDiagram
    actor Learner
    participant Component as AiProviderSettings / ProviderList
    participant Atoms as aiSettingsAtom
    participant Service as AiSettingsService
    participant Ipc
    participant Command as get_ai_settings
    participant Rust as AiSettingsService (Rust)
    participant Store as SessionSettingsStore

    Learner->>Component: opens Settings or first run
    Component->>Atoms: useAtomValue
    Atoms->>Service: get
    Service->>Ipc: invoke("get_ai_settings")
    Ipc->>Command: IPC
    Command->>Rust: get() on a blocking thread
    Rust->>Store: load()
    alt nothing saved yet
        Store-->>Rust: None
        Rust-->>Command: defaults (Gemini, pinned model, natural)
    else saved
        Store-->>Rust: AiSettings
    else database unreadable
        Store-->>Rust: AiSettingsError::Storage
        Command-->>Ipc: IpcError database_error
        Ipc-->>Atoms: failure
        Atoms-->>Component: "Settings could not be loaded" + Retry
    end
    Command-->>Ipc: AiSettings
    Ipc-->>Service: decoded with AiSettingsSchema
    Service-->>Atoms: AsyncResult.Success
    Atoms-->>Component: selected provider, model and style
```

## Change one setting

```mermaid
sequenceDiagram
    actor Learner
    participant Component as ProviderChoice / selects
    participant Atoms as updateAiSettingsAtom
    participant Service as AiSettingsService
    participant Ipc
    participant Command as save_ai_settings
    participant Rust as AiSettingsService (Rust)
    participant Store as SessionSettingsStore

    Learner->>Component: picks a provider, model or style
    Component->>Atoms: update({ field })
    Atoms->>Service: get, then save({ ...current, field })
    Service->>Ipc: invoke("save_ai_settings", { settings })
    Ipc->>Command: IPC
    Command->>Rust: save(settings) on a blocking thread
    Rust->>Store: save(settings)
    alt database cannot be written
        Store-->>Rust: AiSettingsError::Storage
        Command-->>Ipc: IpcError database_error
        Ipc-->>Atoms: failure, the shown choice does not change
        Atoms-->>Component: "Could not read or save conversation settings locally."
    else saved
        Command-->>Ipc: AiSettings
        Atoms->>Atoms: reactivity key "ai-settings" refreshes aiSettingsAtom
        Atoms-->>Component: the confirmed choice
    end
```

## Warm the provider

```mermaid
sequenceDiagram
    participant Talk as usePrewarmProvider
    participant Atoms as prewarmConversationProviderAtom
    participant Service as AiSettingsService
    participant Ipc
    participant Command as prewarm_conversation_provider
    participant Rust as AiSettingsService (Rust)
    participant Warmup as AppleProviderWarmup

    Talk->>Atoms: prewarm when a session opens
    Atoms->>Service: prewarm
    Service->>Ipc: invoke("prewarm_conversation_provider")
    Ipc->>Command: IPC
    Command->>Rust: prewarm() on a blocking thread
    Rust->>Rust: get() the saved settings
    Rust->>Warmup: warm(settings)
    Warmup-->>Rust: started, or nothing to do for Gemini and Antigravity
    alt warm-up failed
        Command-->>Ipc: IpcError with the provider's code
        Atoms-->>Talk: failure, ignored: the first turn reports real failures
    else warm
        Command-->>Ipc: null
    end
```

## A turn reads the settings

```mermaid
sequenceDiagram
    participant Command as send_practice_turn / generate_follow_up
    participant Rust as AiSettingsService (Rust)
    participant Provider as providers::generate_configured_turn

    Command->>Rust: get()
    Rust-->>Command: AiSettings, or IpcError mapped to ProviderError
    Command->>Provider: generate with the saved provider
```
