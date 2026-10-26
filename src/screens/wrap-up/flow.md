# Wrap-up screen

`screens/wrap-up` is the focused full page after Finish (the shell hides the sidebar). It composes
`features/wrap-up` (numbers, phrases, saves) with `features/coaching-note` (Your conversation) and
passes the first into the second as a slot, because features never import each other.
`app/routes/wrap-up` only mounts it and navigates; the screen reads `practiceStateAtom` and renders nothing
unless the session is completed.

```mermaid
sequenceDiagram
    actor Learner
    participant Route as app/routes/wrap-up
    participant Screen as WrapUpScreen
    participant WrapUp as features/wrap-up
    participant Review as features/coaching-note

    Learner->>Route: Finish on Talk
    Route->>Screen: mounts it with onLeave
    Screen->>WrapUp: useLiveWrapup keeps it current
    Screen-->>Learner: heading, Talk more, Done
    Screen->>WrapUp: WrapUpStats (speaking time, words per minute, average answer)
    Screen->>Review: ConversationReview with renderAnswerActions
    Review-->>Learner: every turn with its review, Hear it, Say it again
    Review->>WrapUp: renderAnswerActions gives SaveAnswerPhrase the session, answer and feedback
    Screen->>WrapUp: PhraseSection (phrases worth learning, Save all, retry)
    Learner->>Screen: Done or Talk more
    Screen->>Screen: dismissSummary
    Screen->>Route: onLeave goes to Start
```

Order: header and actions, three numbers, Your conversation (only when the session had answers),
Phrases worth learning. The conversation and the phrases fill in while the learner reads; nothing
on this screen blocks on coaching.
