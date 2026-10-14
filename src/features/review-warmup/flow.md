# Review warm-up flow

The "Say it again today" card: the next due phrase, a choice to warm up with a spoken review before
the conversation, and a shortcut to Memory. The review itself is `features/spoken-review` (F10),
shown by `screens/spoken-review`; this feature only decides whether to start it first.

## Warm up before the conversation

```mermaid
sequenceDiagram
    actor Learner
    participant Card as WarmupCard
    participant Screen as TalkStartScreen
    participant Rule as startsWithWarmup
    participant App as TalkStartRoute (app layer)
    participant Review as SpokenReviewScreen (F10)

    Learner->>Card: Before session
    Card->>Screen: onWarmupFirstChange(true)
    Learner->>Screen: Start talking
    Screen->>Rule: mode, next due phrase, warmupFirst
    alt spoken mode, a phrase is due, warm-up chosen
        Rule-->>Screen: true
        Screen->>App: onStartWarmup(options)
        App->>Review: begin(warmup), shows the review with the options kept
        Learner->>Review: ends or skips the warm-up
        Review->>App: starts the conversation once with the kept options
    else Skip today, a writing mode, or nothing due
        Rule-->>Screen: false
        Screen->>App: onStart(options)
    end
```

## Review now

```mermaid
sequenceDiagram
    actor Learner
    participant Card as WarmupCard
    participant App as TalkStartRoute (app layer)

    Learner->>Card: Review now (shown while something is due)
    Card->>App: onOpenMemory
    App-->>Learner: opens Memory
```
