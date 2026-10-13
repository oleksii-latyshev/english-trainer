# Gemini key flow

Used by Settings › Conversation AI (`GeminiKeyField`) and first run (`GeminiKeyList`). The key goes
from the learner to an encrypted file; only its status ever comes back to the UI.

## Show the status

```mermaid
sequenceDiagram
    actor Learner
    participant Field as GeminiKeyField
    participant Atoms as geminiKeyStatusAtom
    participant Service as GeminiKeyService
    participant Ipc
    participant Command as get_gemini_key_status
    participant KeyService
    participant Store as EncryptedFileStore

    Learner->>Field: opens Settings
    Field->>Atoms: useAtomValue
    Atoms->>Service: status
    Service->>Ipc: invoke("get_gemini_key_status")
    Ipc->>Command: IPC
    Command->>KeyService: status() on a blocking thread
    alt ENG_TRAINER_GEMINI_API_KEY is set
        KeyService-->>Command: configured, source environment
    else
        KeyService->>Store: exists()
        Store-->>KeyService: true / false
        KeyService-->>Command: configured + settings, or not configured
    end
    Command-->>Ipc: GeminiKeyStatus
    Ipc-->>Service: decoded with GeminiKeyStatusSchema
    Service-->>Atoms: AsyncResult.Success
    Atoms-->>Field: status line and enabled buttons
```

## Save a key

```mermaid
sequenceDiagram
    actor Learner
    participant Field as GeminiKeyField
    participant Atoms as saveGeminiKeyAtom
    participant Service as GeminiKeyService
    participant Ipc
    participant Command as save_gemini_api_key
    participant KeyService
    participant Store as EncryptedFileStore

    Learner->>Field: pastes the key, presses Save
    Field->>Atoms: save(draft)
    Atoms->>Service: save(key)
    Service->>Ipc: invoke("save_gemini_api_key", { key })
    Ipc->>Command: IPC
    Command->>KeyService: save(key) on a blocking thread
    KeyService->>KeyService: validate_key
    alt implausible key
        KeyService-->>Command: GeminiKeyError::Implausible
        Command-->>Ipc: IpcError invalid_request
        Ipc-->>Atoms: failure
        Atoms-->>Field: "That does not look like a Gemini API key…"
    else plausible key
        KeyService->>Store: write(key), encrypted with the device secret
        alt file cannot be written or encrypted
            Store-->>KeyService: GeminiKeyError::Storage / Encryption
            Command-->>Ipc: IpcError unavailable
            Atoms-->>Field: "Could not access the saved Gemini API key…"
        else written
            KeyService->>KeyService: cache the key in memory
            Command-->>Ipc: null
            Ipc-->>Atoms: success, draft cleared
            Atoms->>Atoms: reactivity key "gemini-key" refreshes geminiKeyStatusAtom
            Atoms-->>Field: "Saved, encrypted on this Mac"
        end
    end
```

## Remove the key

```mermaid
sequenceDiagram
    actor Learner
    participant Field as GeminiKeyField
    participant Atoms as removeGeminiKeyAtom
    participant Service as GeminiKeyService
    participant Ipc
    participant Command as delete_gemini_api_key
    participant KeyService
    participant Store as EncryptedFileStore

    Learner->>Field: presses Remove (only for a key saved in Settings)
    Field->>Atoms: remove()
    Atoms->>Service: remove
    Service->>Ipc: invoke("delete_gemini_api_key")
    Ipc->>Command: IPC
    Command->>KeyService: remove() on a blocking thread
    KeyService->>KeyService: forget the cached key
    KeyService->>Store: remove() (a missing file is success)
    alt file cannot be removed
        Command-->>Ipc: IpcError unavailable
        Atoms-->>Field: error block, status unchanged
    else removed
        Command-->>Ipc: null
        Atoms->>Atoms: reactivity key "gemini-key" refreshes geminiKeyStatusAtom
        Atoms-->>Field: "No API key saved."
    end
```

## A provider needs the key

```mermaid
sequenceDiagram
    participant Gemini as Gemini provider
    participant KeyService
    participant Store as EncryptedFileStore

    Gemini->>KeyService: gemini_key::resolve_key()
    alt environment override
        KeyService-->>Gemini: key from ENG_TRAINER_GEMINI_API_KEY
    else cached
        KeyService-->>Gemini: key from memory
    else
        KeyService->>Store: read() and decrypt
        KeyService-->>Gemini: key, now cached, or Missing → ProviderError unauthorized
    end
    Gemini->>KeyService: forget_cached_key() when Gemini rejects the key
```

## First run list

`GeminiKeyList` is the same save flow as `GeminiKeyField` in the grouped-list layout: an API key row
with a Saved mark, a save row, and the free-key link opened through `core/external-link`.
