# Conversation flow settings

Settings › Conversation flow edits the preference that Talk and the microphone read. The
preference itself (schema, atom, rules) lives in `core/conversation-flow`; this feature is the group
of controls.

## Change a setting

```mermaid
sequenceDiagram
    actor Learner
    participant Group as ConversationFlowSettings
    participant Flow as conversationFlowAtom (core/conversation-flow)
    participant Store as localStorage

    Learner->>Group: flips hands-free, listen after Eva or interrupt by voice
    Group->>Flow: set({ ...flow, field })
    Flow->>Store: write
    Learner->>Group: picks an end-of-turn pause or an auto-send delay
    Group->>Flow: set({ ...flow, endPauseMs }) or set({ ...flow, ...autoSendPatch(choice) })
    Flow->>Store: write
    Note over Group: the pause control is disabled while hands-free is off
    Note over Group: an auto-send delay Settings does not offer leaves no choice selected
```
