# Mistake practice screen

Layout for `/mistakes/practice/:runId`. Logic lives in `features/mistake-run`; the route
(`src/app/routes/mistakes`) passes the run id, the reason the microphone is unavailable and the way
back.

```text
MistakeRunScreen   RunHeader (progress, rule, End practice) + RunBody (exercise or summary)
```

```mermaid
sequenceDiagram
    actor Learner
    participant Route as MistakeRunRoute
    participant Screen as MistakeRunScreen
    participant Feature as mistake-run

    Learner->>Route: Practise (list, card or rule group)
    Route->>Screen: runId, micBlockedReason, onLeave
    Screen->>Feature: composes header and body
    Learner->>Feature: Back to Mistakes
    Feature->>Route: onLeave, navigate /mistakes
```
