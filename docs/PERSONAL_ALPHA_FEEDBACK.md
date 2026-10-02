# First Personal Alpha Feedback — 2026-10-02

## Observed by the user

- Written English is stronger than spontaneous speaking. Full Help does not provide enough support to construct a spoken answer.
- Real recording and local transcription work: basic microphone acceptance can be closed. The selected microphone was not the intended device; input selection and an explicit playback check are needed.
- Whisper sometimes changes technical wording into unrelated words. This is recognition uncertainty, not evidence of the learner's pronunciation or knowledge.
- AI replies intermittently fail with `The conversation provider returned an invalid reply twice. Please retry.` Successful replies can feel too slow.
- Coach requires scrolling back to submit an answer. The desired interaction is a chat with a fixed bottom voice/text composer, help above it, and topic/task at the top.

## Investigation

- Current Full Help is a deterministic set of sentence starters, structure, and expressions. It has no complete model answer or model dialogue.
- Current audio flow is record → stop → manually transcribe → manually send. Transcription is read back with TTS before the partner response; a smoother chat should avoid adding that playback delay to every answer.
- The conversation adapter starts an `agy` process for each reply and permits a second complete request on invalid output. Each process has a 45-second outer timeout. No explicit conversation model or effort is selected.
- One synthetic request through the current default CLI path succeeded in 7.8 seconds. An explicit `gemini-3.8-flash-low` / low-effort request with the same synthetic input also succeeded but took 13.1 seconds. These two observations are not a controlled benchmark or proof that intermittent failures are fixed; a nominally faster model alone did not remove the wait.
- The JSON schema specifies character limits, while post-validation also adds word limits and plain-text restrictions. A response can meet the schema and still be rejected. This is a candidate cause, not a confirmed explanation of the user's failed reply; original rejected output is removed with scratch cleanup.
- Apple's Foundation Models framework provides an on-device model on compatible systems. A read-only availability probe on this Mac returned `unavailable(...modelNotReady)`; no Apple provider was installed or enabled. Local generation still needs measured latency, and Apple does not promise zero delay.

Sources: [Apple Foundation Models overview](https://developer.apple.com/videos/play/wwdc2025/286/), [generation and availability](https://developer.apple.com/documentation/FoundationModels/generating-content-and-performing-tasks-with-foundation-models).

## Guided speaking example

Task: say what you are working on. A complete answer is more useful than an isolated starter.

Partner: What are you working on today?

Model answer: I am working on a small app. It helps me practise English. Today I want to make the chat easier to use.

Adaptation: I am working on [a project]. It helps [someone] do [something]. Today I want to [one small goal].

First read the example, then replace one or two details, then speak the adapted answer. Reading/copying is guided practice and must not be counted as independent phrase mastery. Reduce support only when the learner chooses it or demonstrates repeated success.

## Acceptance criteria for implementation

- Provider failures keep the answer recoverable and distinguish unavailable/timeout/invalid output. Synthetic benchmarks record time and error categories, not personal transcripts or provider logs.
- Topic/task is visible at the top; dialogue remains readable; recording, text editing, and send are reachable without scrolling back. Duplicate/stale submissions cannot save or advance another turn.
- Voice auto-send follows only a new successful transcription when enabled. Failed/empty transcription and explicit preview/correction keep control with the learner. Text input and transcript corrections retain truthful provenance and do not become independent spoken mastery evidence.
- Coach submits the first answer into review without automatically skipping Try Again or the explicit Continue step.
- Guided help supplies a complete answer tied to the actual prompt, with clear editable details and optional playback. Showing examples must integrate with existing cue-exposure safeguards.
- Input choice uses the actual selected device; test recording is explicit, can be played back, and is discarded. Missing/disconnected devices produce recoverable errors.

Only investigation and the roadmap update are complete in this feedback pass. These interaction changes and an alternate provider are not yet implemented.
