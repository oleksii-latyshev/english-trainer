# Microphone settings flow

Settings › Microphone: the input device, a live level and a ten-second check that is recorded and
played back. Everything is on `core/audio`: the remembered device is `preferredMicrophoneAtom`, the
device list is `audioInputsAtom`, the check is `microphoneTestRunAtom` over the `ClipRecorder`
service. The clip is held in memory as an object URL for playback only; it is never saved,
transcribed or sent, and it is released when the learner discards it, records again or leaves
Settings.

## Choose an input device

```mermaid
sequenceDiagram
    actor Learner
    participant Group as MicrophoneSettings
    participant Pref as preferredMicrophoneAtom
    participant Inputs as audioInputsAtom
    participant Devices as navigator.mediaDevices

    Learner->>Group: opens Settings
    Group->>Inputs: reads
    Inputs->>Devices: enumerateDevices (and again on every devicechange)
    Devices-->>Group: the input list
    Learner->>Group: picks a device, or Refresh
    Group->>Pref: set(deviceId), remembered in local storage
    Note over Group,Pref: the device is locked while a practice recording or the check is running
    Note over Group,Pref: Talk's "Choose microphone" opens Settings#microphone and focuses the choice
```

## Record the check and play it back

```mermaid
sequenceDiagram
    actor Learner
    participant Group as TestControls
    participant Run as microphoneTestRunAtom
    participant Clip as ClipRecorder
    participant Mic as Microphone.open
    participant Phase as clipPhaseAtom

    Learner->>Group: Record
    Group->>Run: set(deviceId)
    Run->>Clip: record(deviceId, 10 s)
    Clip->>Phase: requesting
    Clip->>Mic: open, wait until warm (about 3 s)
    Clip->>Phase: recording (elapsed time and level every 100 ms)
    alt Learner presses Stop or 10 s pass
        Group->>Clip: stop
        Clip->>Phase: stopping
        Clip-->>Run: WAV and signal summary
        Run-->>Group: recorded, object URL for playback, device list refreshed
    else the device is lost or cannot be opened
        Clip-->>Group: MicrophoneError, the reason is shown with Dismiss
    end
    Note over Clip,Mic: the microphone scope closes in every case
    Learner->>Group: Play back, Discard, or Record again
    Group->>Run: Reset or a new run revokes the previous object URL
```

## First run check

`MicrophoneCheck` is the compact variant used by the first-run screen. Nothing is requested until the
learner presses Allow Microphone; that starts the same one-shot test as above. While it records, the
list shows the device choice and the live level, and "We can hear you" latches once the level reaches
`HEARD_SPEECH_LEVEL`. Check again starts a new test. Denial or a missing device shows the failure and
keeps the button.
