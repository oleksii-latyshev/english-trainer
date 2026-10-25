# Answer help flow

The "Need help?" planner above the composer: Frame (three steps), Phrases and Example (a model
answer), with an optional 15 or 30 second planning timer on the Frame. Help never blocks the
conversation: the plan is prepared in the background, the learner can speak at any time, and a
failure only offers a retry. The route (`routes/talk`) decides when help is available and mounts
`AnswerHelp`; `useAnswerHelpEffects` keeps the Example guard and the commands alive.

## Prepare the plan

```mermaid
sequenceDiagram
    actor Learner
    participant Help as AnswerHelp
    participant Prefetch as planPrefetchAtom
    participant Load as loadPlanAtom
    participant Service as AnswerHelpService
    participant Command as prefetch_answer_plan
    participant Store as SessionStore answer_plan
    participant Planner as AnswerPlanner (Gemini)

    Learner->>Help: a spoken question appears
    Help->>Prefetch: mounted, or the question changed
    Prefetch->>Load: target, retry false
    Load->>Service: plan(target, false)
    Service->>Command: session_id, sequence, question, retry
    Command->>Store: checks session, phase, sequence and question
    alt cached for this question
        Store-->>Command: the cached plan or its cached failure
    else
        Store->>Planner: plan(question)
        Planner-->>Store: validated AnswerPlan
    end
    Command-->>Service: AnswerPlan, decoded with AnswerPlanSchema
    alt the question is still current
        Load-->>Help: planAtom ready
    else a newer request started
        Load-->>Load: the late result is dropped
    end
```

Nothing is shown and no use is recorded while the plan is only prepared.

## Open a level

```mermaid
sequenceDiagram
    actor Learner
    participant Keys as Frame, Phrases, Example buttons and H, 1, 2, 3
    participant Level as changeHelpLevel
    participant Open as openHelpAtom
    participant Service as AnswerHelpService
    participant Command as record_answer_help_used
    participant Panel as PlanPanel

    Learner->>Keys: opens a level
    Keys->>Level: level
    alt Example while an answer is being captured
        Level-->>Learner: nothing happens
    else
        Level->>Open: level, target, request, capture epoch
        Open->>Service: recordUsed(target)
        Service->>Command: sessionId, sequence
        alt recorded
            Open-->>Panel: the level appears from the prepared plan, instantly
        else not recorded
            Open-->>Learner: "Help could not be marked", the level stays closed
        end
    end
```

Help is recorded once per answer (`help_used` feeds the dialogue and the usage review), and a level
only appears after that. A newer choice, another question or a capture that started in between
makes the answer to an old request stale, and it is dropped.

## Retry

```mermaid
sequenceDiagram
    actor Learner
    participant Status as PlanStatus
    participant Load as loadPlanAtom
    participant Service as AnswerHelpService

    Learner->>Status: Retry help (after a typed failure message)
    Status->>Load: target, retry true
    Load->>Service: plan(target, true)
    Service-->>Status: the plan, or the failure again
```

Only an explicit retry asks the provider again after a failure.

## Example and the microphone

```mermaid
sequenceDiagram
    actor Learner
    participant Guard as exampleGuardAtom
    participant Capture as core/answer-capture
    participant Panel as ModelAnswer

    Learner->>Panel: Play (disabled while recording) or Hide before speaking
    Learner->>Capture: starts talking, or automatic listening starts
    Capture-->>Guard: requesting or recording
    Guard-->>Panel: Example is hidden, playback stops, a pending Example open is cancelled
```

## Planning timer

```mermaid
sequenceDiagram
    actor Learner
    participant Timer as PlanningTimer
    participant Planning as startPlanning, planningTickAtom
    participant Turn as core/practice-turn planningAtom

    Learner->>Timer: 15 seconds or 30 seconds (Frame open, not recording)
    Timer->>Planning: start
    Planning->>Turn: planning on, listening is cancelled and automatic listening waits
    loop every 250 ms
        Planning-->>Timer: remaining seconds
    end
    alt the time runs out, Cancel planning, another level, a recording, a new question
        Planning->>Turn: planning off
        Note over Planning: the microphone is never started by the timer
    end
```
