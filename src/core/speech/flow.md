# Speech output flow

Eva's voice: the reply text goes in, audio comes out. The natural voice is the bundled Supertonic
model behind the `voice` Rust context; system voices (`speechSynthesis`) cover everything else.
`useSpeech` is the facade legacy screens call; it writes the reply into `replyLogAtom` and starts
`speakAtom`, whose Effect owns the whole stream. Interrupting is closing that Effect's scope.

## Speak a streamed reply

```mermaid
sequenceDiagram
    actor Learner
    participant Talk as Talk (legacy)
    participant Hook as useSpeech
    participant Log as replyLogAtom
    participant Speak as speakAtom (Speech.speak)
    participant Render as render loop
    participant Rust as synthesize_natural_voice
    participant Audio as AudioOutput session
    participant Play as play loop

    Talk->>Hook: beginStream(callbacks)
    Hook->>Log: startReplyLog(streamId)
    Hook->>Speak: start(engine, rate, callbacks)
    loop provider deltas
        Talk->>Log: append(delta)
        Log-->>Speak: new events (Delta), whole sentences are released
    end
    Render->>Render: cut the first phrase (at most 40 characters, clause boundary preferred)
    Render->>Rust: text, voice id, speed (800 ms guard)
    Rust-->>Render: trimmed WAV
    Render->>Audio: enqueue(wave, pause 0)
    Audio-->>Play: start time on the audio clock
    Play-->>Talk: onStart(latency), state speaking
    Render->>Render: lead = audio queued but not yet played
    Render->>Rust: next phrase, sized by lead and measured speed, started at once
    Render->>Audio: enqueue(wave, 0 inside a sentence, 150 ms between sentences)
    Talk->>Log: finish(finalText)
    Play-->>Talk: onEnd after the last clip ends, state idle
```

## Why there is no gap inside a sentence

```mermaid
sequenceDiagram
    participant Render as render loop
    participant Audio as AudioOutput session
    participant Clock as audio clock

    Render->>Audio: leadMs
    Audio-->>Render: queued audio, for example 2.4 s
    Note over Render: synthesis of the next phrase starts as soon as it is available, not when the current phrase starts playing
    Render->>Audio: enqueue(next, 0)
    Note over Audio: source.start(end of the queued audio): sample accurate, no element swap
    Audio->>Clock: the next clip starts exactly where the previous ends
    Note over Render: more than 6 s queued: wait until the lead drops below the target
```

Rust trims model padding to 40 ms before and 50 ms after the speech, so the silence that remains at
a join is about 90 ms. Between sentences the pause is the 90 ms plus 150 ms of explicit pause.

## Fallback to system speech

```mermaid
sequenceDiagram
    participant Render as render loop
    participant Rust as synthesize_natural_voice
    participant Play as play loop
    participant System as SystemVoice
    participant Avail as naturalAvailabilityAtom

    Render->>Rust: phrase
    alt busy
        Rust-->>Render: IpcError busy
        Render->>Rust: retry every 40 ms inside the guard
    end
    alt slow (guard: 800 ms for the first phrase, queued audio plus 400 ms later), unavailable, process failed, decode failed
        Render->>Play: Utterance(phrase), the rest of the reply goes to the system voice
        Render->>Avail: refresh, a background re-warm (not after busy)
        Play->>Play: wait until the queued natural audio has ended
        Play->>System: speak(sentence) one by one
    end
```

## Interrupt

```mermaid
sequenceDiagram
    actor Learner
    participant Hook as useSpeech
    participant Speak as speakAtom
    participant Scope as Effect scope

    Learner->>Hook: mic, Space, Esc or a new answer
    Hook->>Speak: Atom.Interrupt
    Speak->>Scope: close
    Note over Scope: scheduled sources are stopped, speechSynthesis is cancelled, an in-flight synthesis result is dropped when it returns
    Hook->>Hook: state idle
```

`useSpeech` is a thin hook over `createPlayback(registry)`. Atoms that need Eva's voice without a
component (the spoken review reads its situation from an atom and stops on its finalizer) call
`createPlayback(get.registry)` and read `speechStateAtom`; both paths share one playback.

## Sample in Settings and first run

```mermaid
sequenceDiagram
    actor Learner
    participant Settings as VoiceSettings
    participant Preview as previewNaturalVoiceAtom
    participant Rust as synthesize_natural_voice
    participant Audio as AudioOutput session
    participant Avail as naturalAvailabilityAtom

    Learner->>Settings: picks a voice or presses play
    Settings->>Preview: { text, voiceId, rate }
    Preview->>Rust: synthesize
    Rust-->>Preview: WAV
    Preview->>Audio: enqueue, play until idle or interrupted
    alt the sample fails
        Preview->>Avail: refresh
        Preview-->>Settings: failure, an alert is shown
    end
```

# Speech recognition flow

The Whisper client lives in `SpeechRecognition` (and `SpeechRecognitionSettings` for Settings). Both
call the `speech_recognition` Rust context through `Ipc` and `IpcBinary` (raw WAV body plus headers)
and decode every answer with the schemas in `core/ipc`. Talk records and transcribes through `core/answer-capture`, the spoken review through its own
capture service; both call these services.

## Transcribe an answer

```mermaid
sequenceDiagram
    actor Learner
    participant Hook as core/answer-capture
    participant Rec as SpeechRecognition.transcribe
    participant Rust as transcribe_audio
    participant Whisper as whisper-server

    Learner->>Hook: stops speaking (turn ended)
    Hook->>Rec: WAV from the capture
    Rec->>Rust: bytes (timed)
    Rust->>Whisper: audio, prompt (question, names, glossary)
    Whisper-->>Rust: text
    Rust-->>Rec: Transcript (raw audio dropped unless kept)
    Rec-->>Hook: text and sttMs
    Hook-->>Learner: transcript, or a recovery (record again, set up, retry)
    Note over Rust,Hook: failures arrive as IpcError codes: no_speech and invalid_audio ask to record again, model_missing and engine_missing send to setup, anything else can be retried
```

## Live transcript while recording

```mermaid
sequenceDiagram
    participant Live as liveTranscript (Stream)
    participant Status as engineStatus
    participant Cap as Capture.snapshot
    participant Rec as SpeechRecognition.transcribePartial
    participant UI as Talk bubble

    Live->>Status: model ready and live transcript available?
    alt not available
        Status-->>Live: no, the stream ends empty
    else available
        loop every 1.5 s, one at a time
            Live->>Live: speech heard yet? (otherwise skip)
            Live->>Cap: audio so far
            Live->>Rec: WAV
            Rec-->>Live: words so far, or nothing
            Live-->>UI: text
        end
    end
    Note over Live: a tick that finds the previous update running is skipped, a failed update is dropped, interrupting the stream stops it
```

## Stuck (rescue) snapshot

```mermaid
sequenceDiagram
    participant Hook as rescueTranscriptAtom (core/answer-capture)
    participant Rescue as rescueTranscript
    participant Cap as Capture.snapshot
    participant Rust as transcribe_rescue

    Hook->>Rescue: session id and answer sequence
    Rescue->>Cap: last 15 s
    alt nothing recorded yet
        Cap-->>Rescue: null
        Rescue-->>Hook: no_speech "No audio is ready yet"
    else audio
        Rescue->>Rust: bytes, x-session-id, x-answer-sequence
        Rust-->>Rescue: text (empty becomes no_speech)
        Rescue-->>Hook: the last 1500 characters
    end
```
