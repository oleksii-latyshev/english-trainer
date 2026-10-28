# Answer capture

One spoken answer, from the learner pressing the microphone (or Space, or Eva finishing) to a
transcript. It composes `core/audio` (the warm microphone, the capture, the turn detector) and
`core/speech` (Whisper and the live transcript); it knows nothing about sessions or replies.

## Record, stop, transcribe

```mermaid
sequenceDiagram
    actor Learner
    participant Controls as startListening / stopListening
    participant State as captureStateAtom
    participant Listen as listenAtom
    participant Recorder as AnswerRecorder
    participant Warm as WarmMicrophone (core/audio)
    participant Whisper as SpeechRecognition (core/speech)

    Learner->>Controls: press, hold Space or Eva's reply ended
    Controls->>State: requesting (Eva's voice stops, pre-roll chosen)
    Controls->>Listen: run
    Listen->>Recorder: open
    Recorder->>Warm: ensure the warm session (or open a one-off one)
    Warm-->>Recorder: session, capture with pre-roll
    Listen->>State: recording (level and elapsed time every 100 ms)
    par while recording
        Listen->>Whisper: live transcript every 1.5 s once speech was heard (only the audio after the last committed point, so each call stays short)
    and hands-free turn detection
        Warm-->>Listen: SpeechStarted, TurnEnded after the pause
        Listen->>Listen: live text ending in a comma or an open word (and, the, to, is...) adds 1.2 s to the end pause
        Listen->>Listen: TurnEnded stops the recording when hands-free is on
    and silence in auto-listen
        Listen->>Listen: 20 s without speech and without a hold cancels
    end
    Learner->>Controls: stop (a stop before any speech is a cancel)
    Listen->>State: stopping, the capture is read and released
    Listen->>State: transcribing
    Listen->>Whisper: transcribe(wav)
    alt text
        Whisper-->>State: transcript (request id, duration, speech end time)
    else no speech
        Whisper-->>State: error with a record-again recovery
    else engine failure
        Whisper-->>State: ready with the recording kept and a retry or setup recovery
    end
```

## Cancel, reset, rescue

`cancelListening` interrupts `listenAtom`, which closes the capture scope and releases the
microphone. `resetCapture` does the same and forgets a kept recording. `holdForRescue` keeps the
turn open while the Stuck panel is working (`turnHeldOpenAtom` feeds the detector's hold), and
`rescueTranscriptAtom` transcribes the last 15 seconds of the live capture for it. A device lost
during a recording ends it with a microphone error.
