# Privacy flow

Settings › Privacy tells the learner what stays on the Mac and what is sent to the AI, lets them keep
raw audio after transcription, and deletes kept recordings. The commands belong to the audio context
in Rust, which has no generated bindings yet; the schemas in `schemas.ts` decode only the fields this
feature reads, and move to `core/ipc` when that context migrates.

## Open Settings

```mermaid
sequenceDiagram
    actor Learner
    participant Group as PrivacySettings
    participant Atoms as retentionAtom
    participant Service as PrivacyService
    participant Ipc as Ipc
    participant Rust as get_speech_settings, get_kept_recordings

    Learner->>Group: opens Settings
    Group->>Atoms: reads
    Atoms->>Service: retention
    Service->>Ipc: invokeCommand (both commands)
    Ipc->>Rust: get_speech_settings, get_kept_recordings
    alt both answer
        Rust-->>Group: keep raw audio switch and the kept recordings row
    else a command fails or answers an unexpected shape
        Ipc-->>Group: failure, "The audio setting could not be read."
    end
```

## Keep raw audio

```mermaid
sequenceDiagram
    actor Learner
    participant Group as PrivacySettings
    participant Atoms as setKeepRawAudioAtom
    participant Service as PrivacyService
    participant Ipc as Ipc
    participant Rust as save_keep_raw_audio

    Learner->>Group: flips Keep raw audio
    Group->>Atoms: set(keepsAudio)
    Atoms->>Service: setKeepRawAudio
    Service->>Ipc: invokeCommand
    Ipc->>Rust: save_keep_raw_audio
    alt saved
        Rust-->>Atoms: settings
        Atoms-->>Group: reactivity key "privacy" refreshes retentionAtom
    else rejected
        Ipc-->>Group: privacyProblemAtom = save, "The setting could not be saved. Try again."
    end
```

## Delete kept recordings

```mermaid
sequenceDiagram
    actor Learner
    participant Group as PrivacySettings
    participant Atoms as deleteKeptRecordingsAtom
    participant Service as PrivacyService
    participant Ipc as Ipc
    participant Rust as delete_kept_recordings

    Learner->>Group: Delete kept recordings
    Group->>Atoms: run
    Atoms->>Service: deleteKeptRecordings
    Service->>Ipc: invokeCommand
    Ipc->>Rust: delete_kept_recordings
    alt deleted
        Rust-->>Atoms: empty list
        Atoms-->>Group: reactivity key "privacy" refreshes retentionAtom
    else rejected
        Ipc-->>Group: privacyProblemAtom = delete, "The recordings could not be deleted. Try again."
    end
```
