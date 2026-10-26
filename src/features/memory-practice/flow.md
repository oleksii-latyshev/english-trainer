# Memory practice cards flow

The two cards at the top of Memory that start spoken practice: the spoken review and "Practice my
usual mistakes". The cards only offer and start; the review screen and the practice session are
`features/spoken-review` and, for the five questions, `screens/talk`, so what
the practice session needs from the app arrives through props.

```mermaid
sequenceDiagram
    actor Learner
    participant Route as routes/memory
    participant Screen as MemoryScreen
    participant Review as ReviewCard
    participant Practice as MistakePracticeCard
    participant Atom as practiceTargetsAtom
    participant Core as openedLearningMemoryAtom

    Route->>Screen: isAudioBusy, isSessionOpen, isStarting, error
    Screen->>Review: onStart
    Screen->>Practice: flags, onStart
    Review->>Atom: due count and activeReviewAtom (the saved run, from core/learning-memory)
    Practice->>Atom: practicable mistakes
    Atom->>Core: reads the opened library
    Learner->>Review: Start spoken review (or Resume review)
    Review->>Route: onStart, which sets the review mode and opens /memory/review
    Learner->>Practice: Practice · 2 min
    Practice->>Route: onStart, which starts five questions
```

- Review offers "Resume review" for a saved run, "Start spoken review" when something is due and
  nothing otherwise ("All caught up").
- Practice is blocked while Memory loads or failed, while a conversation is open, while the
  microphone is busy and while no mistake has been seen at least twice
  (`isPracticableMistake`, the same bounds Rust applies).
