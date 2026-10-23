# Talk composer

Everything the learner does to give an answer: Eva's stage and status, the microphone control, the
draft, the auto-send countdown, Space and Esc. Recording is `core/answer-capture`, sending and
interrupting is `core/practice-turn`; this feature derives what the learner sees from them
(`TurnState`) and decides what each press means.

## A spoken answer

```mermaid
sequenceDiagram
    actor Learner
    participant Keys as keyboardAtom and MicRow
    participant Commands as commands
    participant Capture as core/answer-capture
    participant Sync as transcriptSyncAtom
    participant Draft as draftAtom
    participant Submit as submitAtom and countdownAtom
    participant Turn as core/practice-turn sendTurn

    Learner->>Keys: press the mic or hold Space
    Keys->>Commands: startAnswer (the countdown stops, Eva is interrupted)
    Commands->>Capture: startListening
    Learner->>Keys: stop, release Space, or pause long enough
    Capture-->>Sync: transcript with a new request id
    Sync->>Draft: text, recognized text, isNewVoice
    alt send voice answers is on, fully hands-free
        Sync->>Submit: send now as voice
    else send voice answers is on
        Sync->>Submit: countdown with a label (editing, Esc or a new press cancels it)
    else off
        Sync-->>Learner: review state, the learner presses Send
    end
    Submit->>Turn: text, source (voice, edited or text), recording length
    alt reply
        Turn-->>Draft: cleared
    else failure
        Turn-->>Learner: the draft stays; the fix is Retry, Switch to Apple on-device or Open Settings
    end
```

## What the stage shows

`turnStateAtom` orders what the learner can act on above what is merely pending: paused, listening
(manual or auto, live or still opening), transcribing, Eva speaking, thinking, an issue with its
fixes, a transcript to review, idle. The presentation (Eva's mood, title, hint, the microphone
name) comes from `helpers/turn-state`, so the picture, the status line and the control always
agree. Releasing Space before the microphone is live abandons the start, even when the start waits
for a pending reply to be cancelled.
