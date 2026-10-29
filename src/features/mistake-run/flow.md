# Mistake practice run

A run is up to six exercises, one per mistake, planned by Rust (`PracticeService`). The frontend
shows the current exercise, sends answers and follows the results. `runAtom` reads the run and
reloads on the `MISTAKES` reactivity key, so a background result (`mistakes-updated`) fills in
without blocking the run. Which exercise is on screen is `cursorAtom`; without a cursor the run
resumes at the first exercise that has no answer.

## Start and resume

```mermaid
sequenceDiagram
    actor Learner
    participant Lib as Mistakes list or card
    participant Route as MistakesRoute
    participant Start as startMistakeRunAtom
    participant Service as MistakesService
    participant Rust as start_mistake_run

    Learner->>Lib: Practise N, Practise this rule or Practise this
    Lib->>Route: onPractise(target)
    Route->>Start: target, onStarted
    Start->>Service: startRun
    Service->>Rust: kind, id or rule_key
    alt an open run exists
        Rust-->>Service: the open run, answers intact
    else new run
        Rust-->>Service: up to six exercises
    else nothing due or unreadable
        Rust-->>Start: IpcError, toast with the message
    end
    Start->>Route: onStarted(runId)
    Route-->>Learner: /mistakes/practice/:runId
```

## Typed exercises (Fill the gaps, Fix it)

```mermaid
sequenceDiagram
    actor Learner
    participant Stage as ExerciseStage
    participant Submit as submitAnswerAtom
    participant Service as MistakesService
    participant Run as runAtom

    Learner->>Stage: type the gap words or the rewritten sentence, Submit
    Stage->>Submit: runId, position, answer, typed
    Submit->>Submit: pin the cursor on this exercise
    Submit->>Service: answer_mistake_step
    Submit->>Run: reload
    Run-->>Stage: result with note, version to keep, lesson
    alt pass
        Stage-->>Learner: Right. and Next
    else miss
        Stage-->>Learner: Not quite, version to keep, lesson
        opt Fix it and the AI has not looked yet
            Learner->>Stage: Check it
            Stage->>Service: check_mistake_answer
            Service-->>Stage: checking, result arrives with mistakes-updated
        end
        opt first miss
            Learner->>Stage: Try once more
            Stage-->>Learner: inputs again, practice only
        end
    end
    Learner->>Stage: Next
```

## Spoken exercises (Say it, Use it)

Recording, the live transcript and the local transcription are `core/answer-capture`, the same
path as Say it again on the wrap-up. The microphone button is disabled while a Talk conversation is
open or Eva is busy (`micBlockedReason` in the route). `spokenGuardAtom` cancels an unfinished
recording when the run screen closes.

```mermaid
sequenceDiagram
    actor Learner
    participant Stage as SpokenAnswer
    participant Capture as core/answer-capture
    participant Effects as spokenEffectsAtom
    participant Service as MistakesService

    Learner->>Stage: Record answer
    Stage->>Capture: startListening (manual)
    Capture-->>Stage: live transcript while recording
    Learner->>Stage: Stop recording
    Capture-->>Effects: transcript
    Effects->>Service: answer_mistake_step (spoken)
    Effects->>Capture: reset
    alt Say it
        Service-->>Stage: pass or miss at once (local match)
    else Use it
        Service-->>Stage: checking, Eva checks in the background
        Note over Stage: Next works while it checks
    end
    alt unreadable audio or engine failure
        Capture-->>Stage: failed with a record-again or retry recovery
    end
```

## Checking results and the summary

```mermaid
sequenceDiagram
    participant Rust as background check
    participant Events as mistakesUpdatesAtom
    participant Run as runAtom
    participant UI as ExerciseStage or RunSummary
    actor Learner

    Rust-->>Events: mistakes-updated
    Events->>Run: invalidate MISTAKES, reload
    Run-->>UI: pass or miss replaces checking, no spinner
    alt the check failed (check_failed)
        UI-->>Learner: We could not check this answer, Retry
        Learner->>UI: Retry
        UI->>Rust: retry_mistake_check
    end
    Learner->>UI: Finish or End practice
    UI->>Run: cursor past the last exercise
    Run-->>UI: summary
    UI->>Rust: finish_mistake_run (finishEffectAtom, once)
```
