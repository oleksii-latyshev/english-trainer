# Usage review

After a spoken answer to one of the first two questions, Talk offers a "Learning use review": did
the learner use an earlier saved phrase or avoid an earlier mistake. It sends the saved transcript
and the eligible learning targets to the configured AI provider, and the learner keeps speaking
while it runs.

## When the card shows

`usageReviewTarget` decides from the newest accepted answer (`acceptedAnswerAtom`), the open
session and the saved dialogue. It does not read the capture: sending an answer resets the capture,
so anything keyed to the capture's transcript would never match.

| Rule | Why |
| :--- | :--- |
| the answer belongs to the open session | an answer of an earlier session is never reviewed |
| voice session, not mistake practice | typed and rehearsed answers are not independent use |
| the saved input source is `voice` and no help was used | only unaided speech counts as evidence |
| the first two answers only | the same bound as the Rust command |
| not while Say it again or spoken recall is active | those flows own the microphone |

## Restore, check and show

```mermaid
sequenceDiagram
    actor Learner
    participant Card as UsageReviewCard
    participant Atoms as usageReviewViewAtom
    participant Service as UsageReviewService
    participant Rust as get / review_practice_memory_usage

    Learner->>Card: speaks an answer, the card appears
    Card->>Atoms: useAtomValue
    Atoms->>Service: saved(session, sequence)
    Service->>Rust: get_practice_memory_usage
    alt an earlier result exists
        Rust-->>Card: the result is shown
    else none
        Rust-->>Card: Check learning use
    else IpcError
        Rust-->>Card: "Could not restore this saved review…" with Retry
    end
    Learner->>Card: Check learning use
    Card->>Service: review(session, sequence)
    Service->>Rust: review_practice_memory_usage
    alt assessment
        Rust-->>Card: findings with their outcome; Memory reloads (LEARNING_MEMORY)
    else IpcError or an answer for another turn
        Rust-->>Card: "Could not complete the learning use review. Please retry." with Retry
    end
```

An incorrect use is shown as information in amber, never red. No findings means no eligible target,
and no progress is recorded.
