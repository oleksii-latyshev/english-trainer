# Speech recognition settings flow

Settings › Speech recognition: which Whisper model transcribes the learner's answers, the speech
check that measures the installed models on the learner's own voice, the state of the model kept in
memory and the live transcript switch. The commands live in `core/speech`
(`SpeechRecognitionSettings`, `SpeechRecognition`); the sentence recordings use the `ClipRecorder`
of `core/audio`, so a recording is released as soon as it ends. The recordings of the speech check
are kept on the Mac only because the learner made them, until they are deleted. A test clip made in
Settings › Microphone is never saved.

## Open Settings

```mermaid
sequenceDiagram
    actor Learner
    participant Group as SpeechRecognitionSettings
    participant Atoms as speechSettingsAtom, speechModelsAtom, speechCheckAtom
    participant Engine as engineStatusAtom
    participant Rust as get_speech_settings, list_speech_models, get_speech_check, get_speech_engine_status

    Learner->>Group: opens Settings
    Group->>Atoms: reads
    Atoms->>Rust: three commands
    alt all three answer
        Rust-->>Group: model, engine and speech check rows
    else one fails
        Rust-->>Group: "Speech recognition settings could not be read."
    end
    loop every 1.5 s while the group is open and after every setting change
        Engine->>Rust: get_speech_engine_status
        Rust-->>Group: "Model in memory" row and the live transcript advice
    end
    Note over Engine: a failed poll keeps the last known state
```

## Choose the model and the live transcript

```mermaid
sequenceDiagram
    actor Learner
    participant Group as ModelRow, EngineRows
    participant Atoms as saveSpeechModelAtom, saveLiveTranscriptAtom
    participant Rust as save_speech_model, save_live_transcript

    Learner->>Group: picks a model or flips Live transcript
    Group->>Atoms: set(value)
    Atoms->>Rust: command
    alt saved
        Rust-->>Atoms: reactivity key refreshes speechSettingsAtom and the engine status
    else rejected
        Rust-->>Group: "The model choice could not be saved." or the live transcript equivalent
    end
```

## Record the speech check

```mermaid
sequenceDiagram
    actor Learner
    participant Card as SpeechCheck
    participant Atom as recordSentenceAtom
    participant Clip as ClipRecorder (core/audio)
    participant Rust as save_speech_check_recording

    Learner->>Card: presses the microphone on a sentence
    Card->>Atom: set(index, preferred device)
    Atom->>Clip: record(device, 30 s)
    Clip-->>Card: requesting, recording (level), stopping
    Learner->>Card: presses stop
    alt shorter than 0.8 s
        Atom-->>Card: SentenceTooShort, "That was too short. Read the whole sentence."
    else long enough
        Atom->>Rust: WAV bytes with the sentence index
        Rust-->>Atom: new speech check, reactivity key refreshes speechCheckAtom
        Atom-->>Card: moves to the next sentence still to record
    else device lost or save rejected
        Atom-->>Card: the reason is shown under the sentence
    end
    Learner->>Card: Delete recordings
    Card->>Rust: delete_speech_check_recordings, back to sentence 1
```

## Measure the models

```mermaid
sequenceDiagram
    actor Learner
    participant Rows as MeasureModels
    participant Atom as measureModelsAtom
    participant Rust as run_speech_check
    participant Progress as measurementProgressAtom

    Learner->>Rows: Measure (one model or all, with or without the glossary prompt)
    Rows->>Atom: set(modelFiles, includePrompt)
    Atom->>Rust: run_speech_check with a progress channel
    Rust-->>Progress: model, recordings done of total
    Progress-->>Rows: progress bar and text
    alt finished
        Rust-->>Atom: results saved, reactivity key refreshes speechCheckAtom
        Atom-->>Rows: results table, transcripts per run, "in use" next to the chosen model
    else failed
        Rust-->>Rows: "The measurement could not be completed. Try again."
    end
```
