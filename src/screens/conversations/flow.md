# Conversations screen

`/conversations` lists every finished conversation (`features/conversation-history`), with a Back
button that returns to where the learner came from. `app/routes/conversations` mounts it and opens a
row at `/conversations/$sessionId`, which renders `screens/wrap-up` for that session.

```mermaid
sequenceDiagram
    actor Learner
    participant Start as TalkStartScreen
    participant Route as app/routes/conversations
    participant Screen as ConversationsScreen
    participant WrapUp as WrapUpScreen

    Learner->>Start: See all
    Start->>Route: onSeeAllConversations
    Route->>Screen: mounts it
    Learner->>Screen: a conversation
    Screen->>Route: onOpen(sessionId)
    Route->>WrapUp: sessionId
    Learner->>WrapUp: Back
    WrapUp->>Route: onLeave
    Route-->>Learner: history back, to the list or the start screen
```
