# Rescue flow

The "Stuck" control beside the microphone: while the learner is recording an answer, one press (or
`S`) asks for a next step, a simpler way to say it, or a missing word. The learner never leaves the
chat and the recording is never ended: rescue only holds the turn open while it works and releases
that hold when it is closed or fails. `screens/talk` decides when rescue is available and
mounts `Rescue` in the composer's rescue slot while the capture is recording.

## Ask for a next step or a simpler wording

```mermaid
sequenceDiagram
    actor Learner
    participant Stuck as Stuck button and S
    participant Commands as openRescue, chooseRescueKind
    participant Hold as core/answer-capture holdForRescue
    participant Request as requestRescueAtom
    participant Capture as rescueTranscriptAtom (core/speech rescueTranscript)
    participant Service as RescueService
    participant Command as rescue_answer
    participant Store as SessionStore rescue_answer
    participant Provider as RescueProvider (agy)
    participant Panel as Rescue

    Learner->>Stuck: presses Stuck or S while recording
    Stuck->>Commands: kind next_step or simpler
    Commands->>Hold: hold the turn open for this recording
    Commands-->>Panel: loading
    Commands->>Request: target, kind, generation
    Request->>Capture: snapshot of the last 15 seconds
    alt no audio or no speech yet
        Capture-->>Request: IpcError no_speech
        Request->>Hold: release
        Request-->>Panel: error with Retry
    else speech found
        Capture-->>Request: partial transcript
        Request->>Service: answer(target, transcript)
        Service->>Command: session_id, sequence, request
        Command->>Store: validates session, phase, sequence and question
        Store->>Store: records the help use for this answer
        Store->>Provider: rescue(request)
        Provider-->>Store: validated suggestion
        Command-->>Service: RescueResponse, decoded with RescueResponseSchema
        alt the recording and question are still current
            Request-->>Panel: the suggestion
        else closed or a newer recording started
            Request-->>Request: the late result is dropped
        end
    end
```

The microphone keeps recording the whole time. Stop and cancel work while rescue is loading, and
the late result is dropped.

## Find a missing word

```mermaid
sequenceDiagram
    actor Learner
    participant Panel as Rescue
    participant Commands as chooseRescueKind, findMissingWord
    participant Request as requestRescueAtom
    participant Service as RescueService
    participant Command as rescue_answer

    Learner->>Panel: Missing word
    Panel->>Commands: missing_word
    Commands-->>Panel: description form, the turn stays held open
    Learner->>Panel: describes the word in English, Find a word
    Panel->>Commands: findMissingWord
    Commands->>Request: description, no snapshot of the answer
    Request->>Service: answer(target, empty transcript)
    Service->>Command: rescue_answer
    alt candidates
        Command-->>Panel: three to five words
        Learner->>Panel: chooses one
        Panel-->>Learner: only the chosen word is shown, the answer is not changed
    else provider failure
        Command-->>Panel: typed IpcError message and Retry
    end
```

## Retry and close

```mermaid
sequenceDiagram
    actor Learner
    participant Panel as Rescue
    participant Commands as retryRescue, closeRescue
    participant Hold as core/answer-capture holdForRescue

    Learner->>Panel: Retry after a failure
    Panel->>Commands: retryRescue
    Commands-->>Panel: the same mode and description, loading again
    Learner->>Panel: Continue speaking
    Panel->>Commands: closeRescue
    Commands->>Hold: release only the rescue hold
    Commands-->>Panel: back to the Stuck button
```

A hold the learner set with "Keep listening" stays in effect. Leaving the recording, unmounting the
panel or starting a new recording drops any pending result and releases only the rescue hold.
