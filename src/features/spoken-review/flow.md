# Spoken review flow

The spoken review (F10): Eva gives a situation for each due phrase or mistake, the learner answers
aloud, and Rust decides whether the saved wording came up. The same screen is the warm-up before a
conversation. Rust owns the queue, the scoring and the schedule
([TECHNICAL_REQUIREMENTS §9](../../../docs/TECHNICAL_REQUIREMENTS.md)); this feature opens the run,
records the answer with a live transcript, shows the result and the way on.

Two runtimes: `learningMemoryRuntime` (IPC, reactivity key `LEARNING_MEMORY`) and `captureRuntime`
(the microphone and Whisper, sharing the `ClipRecorder` with `core/audio`). Session state is one
writable atom, `sessionAtom`, seeded from the opened run and changed by pure transitions in
`helpers/review-session`.

## Open the review

```mermaid
sequenceDiagram
    actor Learner
    participant Route as routes/memory (or talk-start for the warm-up)
    participant Mode as reviewModeAtom
    participant Opened as openedReviewAtom
    participant Ipc
    participant Rust as ReviewService (Rust)
    participant Session as sessionAtom
    participant Screen as SpokenReviewScreen

    Learner->>Route: Start / Resume spoken review (or Start with warm-up)
    Route->>Mode: begin(review | warmup) or beginItem(item), reset capture state
    Route->>Screen: show
    Screen->>Opened: read
    Opened->>Ipc: start_memory_review(warmup), or start_item_review(item) after Say it now, and get_learning_memory (status chips)
    alt a run is saved or something is due
        Ipc->>Rust: start (returns the saved run when there is one, so this also resumes)
        Rust-->>Session: run, step answering
    else nothing has a safe cue
        Rust-->>Screen: null, "Nothing to review right now"
    else the run cannot start
        Ipc-->>Screen: failure, "Could not start the review", Try again refreshes the atom
    end
    Note over Rust: start_item_review makes a run of that one item even when it is not due, and returns an open run unchanged
    Note over Session: a run whose items are all answered or skipped opens as closing and is finished at once
```

## Situations and Eva's voice

```mermaid
sequenceDiagram
    participant Effects as reviewEffectsAtom (mounted by the screen)
    participant Prep as materialsPreparationAtom
    participant Ipc
    participant Rust as ReviewService (Rust)
    participant Narration as narrationAtom
    participant Speech as core/speech playback

    Effects->>Prep: run id known
    Prep->>Ipc: prepare_review_material(run, retry=false)
    Ipc->>Rust: generate situations, cached per run
    Rust-->>Prep: ready, failed (retry offered) or pending
    Note over Prep: snapshots are merged so a late read never erases a situation, a model answer or a revealed phrase
    Effects->>Narration: spokenPromptAtom changes
    Narration->>Speech: play "Here is a situation. …" (the cue first, the situation once it arrives)
    Note over Narration,Speech: the atom's finalizer stops Eva when the prompt changes, recording starts or the screen closes
```

## Answer, result and shadowing

```mermaid
sequenceDiagram
    actor Learner
    participant Mic as RecordButton / Space (keyboardAtom)
    participant Answer as answerAtom (capture runtime)
    participant Clip as ClipRecorder
    participant Whisper as SpeechRecognition
    participant Submit as submitTranscriptAtom
    participant Rust as ReviewService (Rust)
    participant Session as sessionAtom

    Learner->>Mic: press, or hold Space
    Mic->>Answer: start (freezes the shown prompt, stops Eva)
    Answer->>Clip: record with the preferred microphone
    loop every 1.5 s while speech was heard
        Clip-->>Answer: capture snapshot
        Answer->>Whisper: transcribe_partial, shown as the live transcript
    end
    Learner->>Mic: press again, or let go of Space
    Clip-->>Answer: 16 kHz WAV
    Answer->>Whisper: transcribe_audio
    alt transcript
        Answer->>Submit: final text
        Submit->>Rust: submit_memory_recall(run, item, transcript)
        Rust-->>Session: result: wording observed or not, new status and interval
        Note over Rust: a cued answer (phrase shown first) is still scored for the schedule but never counts as independent use
    else microphone or transcription failed
        Answer-->>Learner: issue with its own fix: record again, retry transcription or open Settings
    end
    Learner->>Session: Shadow it / Try once more
    Session->>Answer: record a practice try
    Answer->>Submit: text (step result, attempt recording)
    Submit-->>Session: attempt tried, shown with the wording marked, nothing saved
```

Esc cancels a recording (the clip scope closes, a late partial is dropped) or stops Eva. Skip and
End review cancel a recording first.

## Skip, next, finish

```mermaid
sequenceDiagram
    actor Learner
    participant Actions as skipAtom / nextAtom / finishAtom / endReviewAtom
    participant Ipc
    participant Rust as ReviewService (Rust)
    participant Session as sessionAtom
    participant Route as routes (talk-start for the warm-up)

    Learner->>Actions: Skip
    Actions->>Ipc: skip_memory_review_item
    Ipc->>Rust: close the next item without scoring it (it stays due)
    Rust-->>Session: run as it stands
    opt every item is answered or skipped
        Actions->>Ipc: finish_memory_review
        Ipc-->>Session: step summary
        Session-->>Route: summaryReachedAtom (the warm-up starts the conversation once)
    end
    Learner->>Actions: End review / Skip and start conversation
    Actions->>Ipc: finish_memory_review
    Actions->>Route: onBackToMemory (the warm-up starts the conversation with its kept options)
    Note over Actions,Session: a failed skip or finish keeps the words and offers "Try skipping again" or "Retry finish"
```
