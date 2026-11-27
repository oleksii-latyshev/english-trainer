# Coaching note

The review of one answer, and the Debrief of the whole conversation on the wrap-up. Talk never
shows it; Talk only marks an answer (`features/talk-dialogue`). The wrap-up screen
(`screens/wrap-up`) renders `Debrief`, and the write-then-speak review stage renders `AnswerReview`
per answer. `Debrief` takes `renderTake` (the Take button of `features/wrap-up`) and `isTaken`, so
this feature never imports that one.

## Step through the Debrief

One card per spoken answer, in order, with "3 / 8" and Back / Next. A card shows Eva's question,
what was said, the better version with changed words marked, one line of why, the findings grouped
as Fix, Better and Missing word, and the words to take. Only words in `debrief_words` (at most five
per session, chosen in Rust) get a Take button. After the last card, Finish opens a summary of the
words taken. A taken word the usage review saw the learner use on their own in that answer shows
"✓ Used on your own: <phrase>" under the answer, and the summary lists those words too
(`debrief_wins`, read from Rust; With help never appears). Below them "Your habits" lists the
plain words Rust counted across recent conversations (`habits`, at most three) as
"very 3.4 → 1.2 per 100 words"; the block is absent while Rust sends none. A pending, paused or failed answer shows the same status line and retry as
`AnswerReview`.

```mermaid
sequenceDiagram
    actor Learner
    participant Debrief as Debrief
    participant Step as debriefStepAtom
    participant Card as DebriefCardView
    participant Take as renderTake slot

    Learner->>Debrief: opens the wrap-up
    Debrief->>Step: step 0
    Debrief->>Card: card 1 of N
    alt ready
        Card-->>Learner: better version, why, findings, words to take
        Card->>Take: each word Rust offered for this answer
    else pending, paused or failed
        Card-->>Learner: "Checking your answer…" or Retry
    end
    Learner->>Debrief: Next
    Debrief->>Step: step + 1
    Learner->>Debrief: Finish on the last card
    Debrief->>Step: step N
    Debrief-->>Learner: summary of the words taken, "N of M taken"
    Learner->>Debrief: Back
    Debrief->>Step: step - 1
```


## Read the conversation and fill in pending answers

```mermaid
sequenceDiagram
    actor Learner
    participant View as Debrief
    participant Atoms as conversationAtom
    participant Service as CoachingNoteService
    participant Ipc as Ipc and IpcEvents
    participant Rust as get_practice_dialogue

    Learner->>View: opens the wrap-up
    View->>Atoms: useAtomValue and mount the update stream
    Atoms->>Service: readConversation(sessionId)
    Service->>Ipc: get_practice_dialogue
    Ipc->>Rust: invoke (works for a finished session)
    alt turns and coaching
        Rust-->>View: every turn, each answer pending, ready, failed or paused, and debrief_words
    else IpcError or decode failure
        Rust-->>View: notice with Retry (an earlier read stays visible)
    end
    Note over View: a pending answer shows "Checking your answer…"
    Rust-->>Ipc: coaching-updated for this session
    Ipc-->>Atoms: refresh (no polling), answers fill in where they stand
```

The stream is the same `coaching-updated` signal the wrap-up already listens to; Rust also emits it
when a usage review lands, so a win fills in without a reload. It is read here
too because a retried answer that gave up earlier is not counted as pending, so the wrap-up
summary would not refresh for it.

## Check an answer again

```mermaid
sequenceDiagram
    actor Learner
    participant Review as AnswerReview
    participant Retry as retryCoachingAtom
    participant Service as CoachingNoteService
    participant Rust as retry_answer_coaching

    Learner->>Review: Retry (failed) or Try again (paused)
    Review->>Retry: target (session, sequence)
    Retry->>Service: retryCoaching
    Service->>Rust: invoke, which also resumes a paused queue
    alt accepted
        Rust-->>Retry: ok
        Retry->>Review: conversation read again, the answer is pending
    else IpcError
        Rust-->>Review: "Could not ask again. Please retry."
    end
```

## Say it again

Capture is `core/answer-capture` (one microphone path for the whole app). The feature only decides
which answer is being re-spoken (`sayAgainTargetAtom`) and reacts to the transcript.

```mermaid
sequenceDiagram
    actor Learner
    participant UI as SayAgain
    participant Controls as startSayAgain
    participant Capture as core/answer-capture
    participant Effects as sayAgainEffectsAtom
    participant Service as CoachingNoteService
    participant Rust as retry_practice_turn

    Learner->>UI: Say it again
    UI->>Controls: target
    Controls->>Capture: reset, startListening (manual)
    Capture-->>UI: requesting, then recording (Stop is enabled once it records)
    Learner->>UI: Stop recording
    Capture->>Capture: transcribe locally
    alt transcript
        Capture-->>Effects: transcript text
        Effects->>Service: compareSecondTry(session, sequence, transcript)
        Service->>Rust: invoke
        alt comparison
            Rust-->>Effects: AttemptComparison (words_to_take, corrections: phrase and said)
            Effects-->>UI: "Second try" with the transcript and two short lists of ✓ said or ✗ not said yet
        else IpcError
            Rust-->>UI: message, capture reset, the learner can record again
        end
    else transcription failed
        Capture-->>UI: message, Retry transcription when the recording was kept
    end
    Learner->>UI: Cancel
    UI->>Controls: cancelSayAgain (drops the target, resets capture, interrupts a comparison)
```

The target is the whole better version (`b2_rewrite`), the same text Hear it plays. Rust checks the
local transcript phrase by phrase with `learning::contains_phrase` (`conversation/domain/retry_check.rs`):
each of the card's words to take, and each corrected fragment (a finding's `improved`, an upgrade's
`improved`, a gap word). There is no score. A retry is cued practice: it changes no Memory status or
evidence.

Only one answer is re-spoken at a time: the other answers' buttons are disabled while one is active.
`sayAgainActiveAtom` lets the route lock the turn composer while the write-then-speak review stage
is open. A comparison lasts for the life of the screen; Rust also saves it (`attempt_comparisons`).
