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

## Join speech that continues an answer

When hands-free ends an answer too early, the learner may keep talking before Eva's reply is
audible. After an automatic end (the pause, not a manual send, Space or a typed answer) in a spoken
conversation with auto-listen on, `sendTurn` opens the join window: `joinWindowAtom` holds the
answer, its sequence and the time. It lasts until the reply's first audio starts, at most
`JOIN_WINDOW_MS` (4 s). The cap is checked by timestamp when a voice onset arrives, not by a timer.

```mermaid
sequenceDiagram
    actor Learner
    participant Onset as speech onset (warm microphone)
    participant Window as joinWindowAtom
    participant Interrupt as interruptReplyAtom
    participant Rust as cancel_practice_reply
    participant Capture as core/answer-capture
    participant Composer as talk-composer submit
    participant Turn as sendTurn

    Learner->>Onset: keeps talking
    Onset->>Window: still open (before first audio, inside the cap)?
    alt open
        Window->>Interrupt: continues = the cut-off answer
        Interrupt->>Rust: cancel the in-flight reply (generation + 1, the half reply leaves the dialogue)
        Interrupt->>Capture: continuationAtom set, listen (auto, pre-roll kept)
        Capture-->>Composer: transcript of the continuation
        Composer->>Turn: withContinuation: previous + " " + continuation, continuesTurn = sequence
        Turn->>Rust: send_practice_turn(continues_turn)
        Rust-->>Turn: one reply for the joined answer, one saved turn
    else closed
        Onset->>Interrupt: normal interruption, a new turn (only with echo cancellation)
    end
    opt the continuation ends without a transcript
        Capture-->>Turn: idle or error, the cut-off answer is sent again as it was
    end
```

If the cut-off turn had already been saved when the cancel arrived, `continues_turn` makes Rust
replace it (and its coaching) instead of adding a turn, and the session's turn count is not
advanced a second time (`committedTurnAtom`). A reply that was cancelled first saved nothing, so
the joined text is a plain new turn.

## Effects that run for the whole app

`practiceTurnEffectsAtom` is mounted by `App`: it keeps the warm microphone on while a spoken stage
can take an answer (device and echo cancellation follow the preferences), resets capture and
speech when the session or stage changes, prewarms the conversation provider and Whisper, starts
auto-listen after a reply, and watches the microphone for the learner talking over Eva.
