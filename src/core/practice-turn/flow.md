# Practice turn

The loop that joins the session, the capture and Eva's voice: send the answer, stream the reply
into the dialogue and into speech, then listen again. The conversation never waits for coaching or
help; this module does not know about them.

## Send, stream, speak, listen again

```mermaid
sequenceDiagram
    actor Learner
    participant Composer as talk-composer (submitAtom)
    participant Turn as sendTurn
    participant Service as PracticeTurns
    participant Rust as send_practice_turn
    participant Reply as pendingReplyAtom
    participant Voice as core/speech beginStream
    participant Capture as core/answer-capture

    Composer->>Turn: text, source, recording length
    Turn->>Turn: allowed in this stage, not locked, not recording?
    Turn->>Reply: empty reply, generation + 1, session waiting
    Turn->>Voice: beginStream (audio stages only)
    Turn->>Service: send
    Service->>Rust: invoke with a reply channel
    loop provider deltas
        Rust-->>Reply: text appended (dialogue shows it)
        Rust-->>Voice: append (the first phrase is spoken early)
    end
    Rust-->>Turn: ConversationTurn
    Turn->>Turn: session turn count and prompt advance
    Turn->>Capture: resetCapture
    Turn->>Voice: finish(reply and question)
    Voice-->>Turn: onEnd
    Turn->>Capture: auto-listen when allowed and not planning
    alt IpcError
        Rust-->>Turn: failure
        Turn-->>Composer: failed, the unfinished reply is dropped, the fix is chosen by code
    end
```

## Interrupt Eva

```mermaid
sequenceDiagram
    actor Learner
    participant Trigger as mic, Space, Esc, Speak anyway, voice onset
    participant Interrupt as interruptReplyAtom
    participant Voice as playback
    participant Service as PracticeTurns
    participant Rust as cancel_practice_reply
    participant Capture as core/answer-capture

    Learner->>Trigger: interrupt
    Trigger->>Interrupt: record or just stop
    Interrupt->>Interrupt: generation + 1 (late results are ignored)
    Interrupt->>Voice: cancel and stop
    opt a reply is pending
        Interrupt->>Service: cancel
        Service->>Rust: invoke
    end
    alt record
        Interrupt->>Capture: startListening (pre-roll kept for a voice onset)
    end
```

A committed turn that wins the race with the interruption still advances the session; only its
voice and its text on screen are dropped.

## Effects that run for the whole app

`practiceTurnEffectsAtom` is mounted by `App`: it keeps the warm microphone on while a spoken stage
can take an answer (device and echo cancellation follow the preferences), resets capture and
speech when the session or stage changes, prewarms the conversation provider and Whisper, starts
auto-listen after a reply, and watches the microphone for the learner talking over Eva.
