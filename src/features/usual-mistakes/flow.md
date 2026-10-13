# Usual mistakes flow

The "Your usual mistakes" card on the Talk start screen: up to three repeated mistakes and a button
for the five-question practice (F12). The card appears only when a repeated, non-archived mistake
exists; choosing and preparing the questions is the existing mistake practice.

```mermaid
sequenceDiagram
    actor Learner
    participant Card as UsualMistakesCard
    participant App as TalkStartRoute (app layer)
    participant Rust as start_mistake_practice

    Learner->>Card: Practice 5 questions
    alt a conversation is open or audio is busy
        Card-->>Learner: button disabled with the reason
    else free
        Card->>App: onPractice
        App->>Rust: start_mistake_practice
        alt preparation fails
            Rust-->>App: error text
            App-->>Learner: StartError on the Start screen, Memory and this card stay available
        else prepared
            App-->>Learner: opens the question session
        end
    end
```
