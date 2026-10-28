# Core audio

The microphone for practice and for one-off recordings: the warm session that stays open between
turns, PCM capture with pre-roll, turn detection and the remembered input device. Raw audio lives
in memory only; it is released when a capture's scope closes or after transcription. Whisper and
the live transcript are not here (they move with `core/speech`, #49).

Services (all in `services/`): `Microphone` opens one stream as a scoped resource, `WarmMicrophone`
owns the warm session between turns, `AudioInputsService` lists devices. `ClipRecorder` records one-off clips for Settings and
first run. `core/answer-capture` is the practice-side user of the warm session.

## Warm session for practice

```mermaid
sequenceDiagram
    actor Learner
    participant Talk as practice-turn effects and answer-capture
    participant Warm as WarmMicrophone
    participant Mic as Microphone.open
    participant Device as getUserMedia, AudioContext, worklet

    Talk->>Warm: setActive(true) when a spoken stage can take an answer
    Warm->>Mic: open in a new Scope (preferred device, echo cancellation)
    Mic->>Device: acquireRelease stream, context, worklet
    Device-->>Mic: frames (PubSub)
    Mic-->>Warm: session, status warming
    Note over Mic,Device: about 3 s of input must pass once
    Mic-->>Warm: warmed, status ready
    Learner->>Talk: speaks
    Talk->>Warm: ensure()
    Talk->>Mic: capture (scoped, copies the pre-roll)
    Talk->>Mic: turns stream (settle span, hold, end pause)
    Mic-->>Talk: SpeechStarted, TurnEnded
    Talk->>Mic: capture.stop
    Mic-->>Talk: 16 kHz WAV and signal summary
    Note over Warm: the session stays open for the next turn
```

The end pause is `endPauseMs` plus an extra pause the caller sets while the live text ends in an
unfinished clause. Once speech is confirmed the noise floor can only fall, and a frame counts as
silence only below a lower keep threshold (floor x 2, at least 0.004) than the start threshold
(floor x 3, at least 0.006), so soft word endings and breaths do not accumulate into a pause.

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

## One-off recording (Settings check, speech check, first run)

```mermaid
sequenceDiagram
    participant Caller as microphoneTestRunAtom, recordSentenceAtom
    participant Clip as ClipRecorder.record
    participant Mic as Microphone.open
    participant Phase as clipPhaseAtom

    Caller->>Clip: record(device from Settings, maximum length, optional work while recording)
    Clip->>Phase: requesting
    Clip->>Mic: open in its own Scope, wait for warm-up, capture without pre-roll
    Clip->>Phase: recording (elapsed time and level every 100 ms)
    Note over Clip,Caller: whileRecording(capture) runs beside the recording (the spoken review samples the level and the live transcript there) and stops with its scope
    alt Caller stops, or the maximum length passes
        Caller->>Clip: stop
        Clip->>Phase: stopping
        Clip-->>Caller: WAV, signal summary, actual input
    else device lost while recording
        Mic-->>Caller: MicrophoneError (disconnected)
    else the caller is interrupted (Reset, unmount)
        Caller-->>Clip: interrupt
    end
    Clip->>Mic: the Scope closes: the device is released
    Clip->>Phase: idle
    Note over Caller,Clip: one clip at a time; a second record fails with a busy MicrophoneError
```

## Remembered device

```mermaid
sequenceDiagram
    actor Learner
    participant Select as the device choice (Settings, first run)
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

## Reading a capture while it records

```mermaid
sequenceDiagram
    participant Caller as live transcript, rescue
    participant Cap as Capture
    participant Buf as active chunks (memory only)

    Caller->>Cap: window(fromMs)
    Cap->>Buf: samples after fromMs, at most the last 30 s
    Cap-->>Caller: WAV (16 kHz) and endMs, or null when nothing is there yet
    Caller->>Cap: snapshot({ tailMs })
    Cap-->>Caller: WAV of the last tailMs (rescue uses 15 s)
    Note over Cap,Buf: snapshot() without options returns null once the capture is over 30 s, the live transcript uses window instead. Nothing is stored, stop returns the full clip
```
