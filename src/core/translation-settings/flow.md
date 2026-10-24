# Translation settings flow

The learner's native language and whether Apple Translation has its language pair on this Mac.
Read and changed by Settings (`TranslationSettings`); the "Prepare languages" action is also offered
by the text-translation panel. The lookup itself (`translate_text`, `explain_text`) lives in
`features/text-translation`.

## Read the language and its availability

```mermaid
sequenceDiagram
    actor Learner
    participant Component as TranslationSettings
    participant Atoms as nativeLanguageAtom / translationAvailabilityAtom
    participant Service as TranslationSettingsService
    participant Ipc
    participant Command as get_translation_settings / get_translation_status
    participant Rust as TranslationSettingsService (Rust)
    participant Store as SessionLanguageStore
    participant Helper as AppleLanguageAvailability

    Learner->>Component: opens Settings
    Component->>Atoms: useAtomValue
    Atoms->>Service: get
    Service->>Ipc: invoke("get_translation_settings")
    Ipc->>Command: IPC
    Command->>Rust: get() on a blocking thread
    Rust->>Store: load()
    alt database unreadable
        Store-->>Rust: TranslationSettingsError::Storage
        Command-->>Ipc: IpcError database_error
        Atoms-->>Component: "Translation settings could not be loaded" + Retry
    else saved or default (Russian)
        Command-->>Atoms: { native_language }
        Atoms-->>Component: the selected language
    end
    Atoms->>Service: status
    Service->>Ipc: invoke("get_translation_status")
    Command->>Rust: status() on a blocking thread
    Rust->>Store: load()
    Rust->>Helper: status(language)
    alt helper failed
        Command-->>Ipc: IpcError (unavailable, timeout, process_failed, ...)
        Atoms-->>Component: availability message + Retry; the language stays editable
    else
        Command-->>Atoms: TranslationStatus
        Atoms-->>Component: "ready on this Mac" or "Prepare languages"
    end
```

## Change the native language

```mermaid
sequenceDiagram
    actor Learner
    participant Component as Select "Native language"
    participant Atoms as setNativeLanguageAtom
    participant Service as TranslationSettingsService
    participant Ipc
    participant Command as save_translation_settings
    participant Rust as TranslationSettingsService (Rust)
    participant Store as SessionLanguageStore

    Learner->>Component: picks a language
    Component->>Atoms: set(code), select disabled while saving
    Atoms->>Service: save({ native_language })
    Service->>Ipc: invoke("save_translation_settings", { settings })
    Ipc->>Command: IPC
    Command->>Rust: save(settings) on a blocking thread
    Rust->>Rust: validate_native_language
    alt unsupported code or database error
        Rust-->>Command: UnsupportedLanguage / Storage
        Command-->>Ipc: IpcError invalid_request / database_error
        Atoms-->>Component: alert with the message, the shown language does not change
    else saved
        Rust->>Store: save(settings)
        Command-->>Atoms: NativeLanguageSettings
        Atoms->>Atoms: reactivity keys refresh nativeLanguageAtom and translationAvailabilityAtom
        Atoms-->>Component: the confirmed language and its availability
    end
```

## Prepare languages

```mermaid
sequenceDiagram
    actor Learner
    participant Component as "Prepare languages" button
    participant Atoms as prepareTranslationLanguagesAtom
    participant Service as TranslationSettingsService
    participant Ipc
    participant Command as prepare_translation_languages
    participant Helper as AppleLanguageAvailability

    Learner->>Component: clicks (offered only when a download is required)
    Component->>Atoms: set(undefined), button and select disabled
    Atoms->>Service: prepare
    Service->>Ipc: invoke("prepare_translation_languages")
    Ipc->>Command: IPC
    Command->>Helper: prepare(saved language), up to five minutes
    alt cancelled, timed out or failed
        Command-->>Ipc: IpcError
        Atoms-->>Component: alert with the message
    else prepared
        Command-->>Atoms: TranslationStatus
        Atoms->>Atoms: reactivity key refreshes translationAvailabilityAtom
        Atoms-->>Component: "ready on this Mac"
    end
```
