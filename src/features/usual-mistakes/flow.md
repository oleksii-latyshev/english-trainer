# Usual mistakes flow

The "Your usual mistakes" card on the Talk start screen: the three rules that come back most often
with how many mistakes each holds, and a button that opens Mistakes. It reads `mistakeGroupsAtom`
(`core/mistakes`) and shows nothing until a rule has a mistake.

```mermaid
sequenceDiagram
    actor Learner
    participant Card as UsualMistakesCard
    participant Atoms as mistakeGroupsAtom
    participant App as TalkStartRoute (app layer)

    Card->>Atoms: useAtomValue
    alt no rule yet or unreadable
        Card-->>Learner: card hidden
    else rules
        Card-->>Learner: top rules with counts
        Learner->>Card: Open Mistakes
        Card->>App: onOpen
        App-->>Learner: navigate /mistakes
    end
```
