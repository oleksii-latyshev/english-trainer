# Core audio

The microphone for practice and for one-off recordings: the warm session that stays open between
turns, PCM capture with pre-roll, turn detection and the remembered input device. Raw audio lives
in memory only; it is released when a capture's scope closes or after transcription. Whisper and
the live transcript are not here (they move with `core/speech`, #49).

Services (all in `services/`): `Microphone` opens one stream as a scoped resource, `WarmMicrophone`
owns the warm session between turns, `AudioInputsService` lists devices. `src/app/microphone` is the
Promise/callback bridge for legacy callers that have not been migrated yet.

## Warm session for practice

```mermaid
sequenceDiagram
    actor Learner
    participant Talk as Talk (legacy useSpeechCapture)
    participant Bridge as app/microphone
    participant Warm as WarmMicrophone
    participant Mic as Microphone.open
    participant Device as getUserMedia, AudioContext, worklet

    Talk->>Bridge: setActive(true) when practice starts
    Bridge->>Warm: setActive(true)
    Warm->>Mic: open in a new Scope (preferred device, echo cancellation)
    Mic->>Device: acquireRelease stream, context, worklet
    Device-->>Mic: frames (PubSub)
    Mic-->>Warm: session, status warming
    Note over Mic,Device: about 3 s of input must pass once
    Mic-->>Warm: warmed, status ready
    Learner->>Talk: speaks
    Talk->>Bridge: ensure(), beginCapture(pre-roll)
    Bridge->>Mic: capture (scoped, copies the pre-roll)
    Talk->>Bridge: listenForTurn
    Bridge->>Mic: turns stream (settle span, hold, end pause)
    Mic-->>Talk: SpeechStarted, TurnEnded
    Talk->>Bridge: capture.stop
    Mic-->>Talk: 16 kHz WAV and signal summary
    Note over Warm: the session stays open for the next turn
```

## Pause, device change, failure

```mermaid
sequenceDiagram
    participant UI as Talk, Settings
    participant Warm as WarmMicrophone
    participant Slot as session Scope
    participant Status as microphoneSnapshotAtom

    UI->>Warm: pause
    Warm->>Slot: close (tracks stopped first, context closed, worklet unloaded)
    Warm-->>Status: paused
    UI->>Warm: ensure
    Warm->>Slot: new Scope, reopen
    UI->>Warm: setDeviceId or setEchoCancellation
    Warm->>Slot: close the open session, reopen with the new setting
    alt open fails, input never warms within 8 s, track ends, worklet errors
        Slot-->>Warm: MicrophoneError
        Warm->>Slot: close
        Warm-->>Status: error with the message, no retry until resume or ensure
    end
    Note over Warm: signals from a replaced session are ignored
```

## One-off recording (Settings test, speech check, recall)

```mermaid
sequenceDiagram
    participant Caller as useMicrophoneTest, useSentenceRecorder
    participant Bridge as startPcmRecording
    participant Mic as Microphone.open

    Caller->>Bridge: start (device from Settings, else the remembered one)
    Bridge->>Mic: open in its own Scope, wait for warm-up, capture without pre-roll
    alt device lost while recording
        Mic-->>Caller: onDeviceLost
    end
    Caller->>Bridge: stop or cancel
    Bridge->>Mic: close the Scope: the device is released
```

## Remembered device

```mermaid
sequenceDiagram
    actor Learner
    participant Select as MicrophoneDeviceSelect
    participant Atom as preferredMicrophoneAtom (Atom.kvs)
    participant Store as localStorage english_trainer_preferred_microphone_id
    participant Warm as WarmMicrophone

    Learner->>Select: picks a device
    Select->>Atom: set(parsed id, "default" and blank mean the system default)
    Atom->>Store: JSON string
    Atom-->>Warm: new value through the Talk hook
    Warm->>Warm: reopen on the new device if a session is open
    Note over Store: ids saved by earlier versions are plain strings and are read as such
```
