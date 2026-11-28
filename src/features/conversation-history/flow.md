# Conversation history

The "Recent conversations" card on the Talk start screen (the last 5 finished conversations) and the
paged list of all of them. A row shows the topic (or the first question of an open conversation),
the day, the number of answers and the rule to practise when there is one. Opening a row is the
app layer's job: the feature only reports the session id.

Rust (`list_finished_sessions`, `conversation/service/history.rs`) lists finished sessions that have at
least one answer, newest first, and returns `has_more` so the list needs no total.

```mermaid
sequenceDiagram
    actor Learner
    participant Card as RecentConversations
    participant List as ConversationList
    participant Atoms as recentConversationsAtom / conversationPageAtom
    participant Service as ConversationHistoryService
    participant Rust as list_finished_sessions
    participant App as route (app layer)

    Card->>Atoms: read 5 rows
    Atoms->>Service: page(5, 0)
    Service->>Rust: invoke
    alt no finished conversation or unreadable
        Card-->>Learner: card hidden
    else rows
        Card-->>Learner: rows and See all
    end
    Learner->>Card: See all
    Card->>App: onSeeAll
    App-->>List: /conversations
    List->>Atoms: page(20, 0)
    Learner->>List: Show more
    List->>Atoms: page(20, 20) while has_more
    Learner->>List: a row
    List->>App: onOpen(sessionId)
    App-->>Learner: /conversations/:sessionId
```

Pages are atoms that are not kept alive, so the list reads again each time the screen opens and shows
a conversation finished a moment ago.
