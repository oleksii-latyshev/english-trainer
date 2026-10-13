# Voice settings flow

Settings › Voice: engine, the ten natural voices, speed. The choice is stored by
`core/voice-preference`; the sample is synthesized by the bundled model through
`synthesize_natural_voice` and played by `core/speech` (`previewNaturalVoiceAtom`). When the local voice is unavailable
the host passes the system voice picker in `systemVoices` (the feature's own `SystemVoices`, fed by the app layer).

## Check the local voice

```mermaid
sequenceDiagram
    actor Learner
    participant Settings as VoiceSettings
    participant Atom as naturalAvailabilityAtom
    participant Service as core/speech Speech
    participant Ipc
    participant Command as prewarm_natural_voice

    Learner->>Settings: opens Settings
    Settings->>Atom: useAtomValue
    Atom->>Service: prewarm
    Service->>Ipc: invoke("prewarm_natural_voice")
    Ipc->>Command: IPC
    alt model present and started
        Command-->>Settings: true, the voice list is shown
    else model missing or start failed
        Command-->>Settings: false or error, a notice and the system voices are shown
    end
```

## Choose a voice

```mermaid
sequenceDiagram
    actor Learner
    participant Settings as VoiceSettings
    participant Pref as naturalVoiceAtom
    participant Preview as previewNaturalVoiceAtom
    participant Service as core/speech Speech
    participant Command as synthesize_natural_voice

    Learner->>Settings: selects a voice (click or arrow keys)
    Settings->>Pref: set({ engine: natural, voiceId }) saved at once
    Settings->>Preview: start(voiceId)
    Note over Preview: a running preview is interrupted first, its audio stops
    Preview->>Service: preview(sample, voiceId, saved speed)
    Service->>Command: IPC, WAV bytes decoded with WaveAudioSchema
    Service-->>Preview: audio
    Preview->>Service: plays until it ends or is interrupted
```

## Replay, stop and leave

```mermaid
sequenceDiagram
    actor Learner
    participant Settings as VoiceSettings
    participant Preview as previewNaturalVoiceAtom

    Learner->>Settings: presses a voice's play button
    Settings->>Preview: start(voiceId), the selection is unchanged
    Learner->>Settings: presses it again while it plays
    Settings->>Preview: Atom.Interrupt, audio stops
    Learner->>Settings: switches to System or leaves Settings
    Settings->>Preview: interrupt, or the atom is released and its scope closes
```

## Sample fails

```mermaid
sequenceDiagram
    participant Preview as previewNaturalVoiceAtom
    participant Availability as naturalAvailabilityAtom
    participant Settings as VoiceSettings

    Preview->>Preview: synthesize or playback fails (IpcError, IpcDecodeError, AudioOutputError)
    Preview->>Availability: refresh, the local voice is checked again in the background
    Preview-->>Settings: failure, an alert says the sample could not play
    alt the check says unavailable
        Availability-->>Settings: system voices replace the list, Retry local voice is offered
    end
```

## Change the speed

```mermaid
sequenceDiagram
    actor Learner
    participant Settings as VoiceSettings
    participant Pref as speechVoiceAtom

    Learner->>Settings: picks 0.9x, 1.0x, 1.1x or 1.2x
    Settings->>Pref: set({ ...pref, rate })
    Note over Pref: Talk speech reads the same atom, the next sample uses it too
```

## First run list

`VoiceList` is the compact variant for first run: the ten natural voices as one grouped list with a
play button per row, and the speed. It shares `useNaturalVoicePicker` with `VoiceSettings`, so
choosing a voice stores it, plays the sample and a second press on the play button stops it. While the
local voice is loading or unavailable a notice replaces the list.
