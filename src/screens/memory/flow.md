# Memory screen

Composes the Memory features for the `/memory` route. It owns layout only; what touches the router,
the open session or the microphone is passed in by `src/app/routes/memory`, which keeps the legacy Talk
and review state out of the screen.

```text
MemoryScreen
  header    title, subtitle, MemorySearch
  cards     ReviewCard                spoken review: items waiting, Start / Resume
            MistakePracticeCard       five questions built on the usual mistakes
            StatusSummary             where the saved items are
  list      LibraryList               tabs, Show archived, expandable rows
  dialog    DeleteMemoryDialog
```

Below the `narrow` breakpoint the cards stack. The data flows are in
`core/learning-memory/flow.md`, `features/memory-library/flow.md` and
`features/memory-practice/flow.md`.

## Open Memory

```mermaid
sequenceDiagram
    actor Learner
    participant Shell as AppShell
    participant Route as MemoryRoute
    participant Screen as MemoryScreen
    participant Features as memory-library / memory-practice

    Learner->>Shell: Memory
    Shell->>Route: /memory
    Route->>Route: useTrainer (microphone, open session, practice state)
    Route->>Screen: props and callbacks (the saved run is read by the review card itself)
    Screen->>Features: composes the cards, the list and the dialog
    Features-->>Learner: Memory
    Learner->>Features: Start spoken review
    Features->>Route: onStartReview
    Route->>Shell: begin the review, navigate /memory/review
```

## Say it now

An opened row's Say it now reaches the route as `onSayNow(item)` through `LibraryList`'s `sayNow`
prop. The route begins a one-item review (`review.beginItem`) and navigates to `/memory/review`; the
summary there returns to Memory.
