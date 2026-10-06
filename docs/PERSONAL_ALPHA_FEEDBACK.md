# Personal Alpha Feedback Log

Dated observations from real use and the investigations that followed. Current priorities are in
[ROADMAP.md](ROADMAP.md); this file is history.

## First session — 2026-10-02

### Observed by the user

- Written English is stronger than spontaneous speaking. Full Help does not provide enough support to construct a spoken answer.
- Real recording and local transcription work: basic microphone acceptance can be closed. The selected microphone was not the intended device; input selection and an explicit playback check are needed.
- Whisper sometimes changes technical wording into unrelated words. This is recognition uncertainty, not evidence of the learner's pronunciation or knowledge.
- AI replies intermittently fail with `The conversation provider returned an invalid reply twice. Please retry.` Successful replies can feel too slow.
- Coach requires scrolling back to submit an answer. The desired interaction is a chat with a fixed bottom voice/text composer, help above it, and topic/task at the top.

### Investigation

- Current Full Help is a deterministic set of sentence starters, structure, and expressions. It has no complete model answer or model dialogue.
- Current audio flow is record → stop → manually transcribe → manually send. Transcription is read back with TTS before the partner response; a smoother chat should avoid adding that playback delay to every answer.
- The conversation adapter starts an `agy` process for each reply and permits a second complete request on invalid output. Each process has a 45-second outer timeout. No explicit conversation model or effort is selected.
- One synthetic request through the current default CLI path succeeded in 7.8 seconds. An explicit `gemini-3.8-flash-low` / low-effort request with the same synthetic input also succeeded but took 13.1 seconds. These two observations are not a controlled benchmark or proof that intermittent failures are fixed; a nominally faster model alone did not remove the wait.
- The JSON schema specifies character limits, while post-validation also adds word limits and plain-text restrictions. A response can meet the schema and still be rejected. This is a candidate cause, not a confirmed explanation of the user's failed reply; original rejected output is removed with scratch cleanup.
- Apple's Foundation Models framework provides an on-device model on compatible systems. A read-only availability probe on this Mac returned `unavailable(...modelNotReady)`; no Apple provider was installed or enabled. Local generation still needs measured latency, and Apple does not promise zero delay.

Sources: [Apple Foundation Models overview](https://developer.apple.com/videos/play/wwdc2025/286/), [generation and availability](https://developer.apple.com/documentation/FoundationModels/generating-content-and-performing-tasks-with-foundation-models).

### Guided speaking example

Task: say what you are working on. A complete answer is more useful than an isolated starter.

Partner: What are you working on today?

Model answer: I am working on a small app. It helps me practise English. Today I want to make the chat easier to use.

Adaptation: I am working on [a project]. It helps [someone] do [something]. Today I want to [one small goal].

First read the example, then replace one or two details, then speak the adapted answer. Reading/copying is guided practice and must not be counted as independent phrase mastery. Reduce support only when the learner chooses it or demonstrates repeated success.

### Acceptance criteria for implementation

- Provider failures keep the answer recoverable and distinguish unavailable/timeout/invalid output. Synthetic benchmarks record time and error categories, not personal transcripts or provider logs.
- Topic/task is visible at the top; dialogue remains readable; recording, text editing, and send are reachable without scrolling back. Duplicate/stale submissions cannot save or advance another turn.
- Voice auto-send follows only a new successful transcription when enabled. Failed/empty transcription and explicit preview/correction keep control with the learner. Text input and transcript corrections retain truthful provenance and do not become independent spoken mastery evidence.
- Coach submits the first answer into review without automatically skipping Try Again or the explicit Continue step.
- Guided help supplies a complete answer tied to the actual prompt, with clear editable details and optional playback. Showing examples must integrate with existing cue-exposure safeguards.
- Input choice uses the actual selected device; test recording is explicit, can be played back, and is discarded. Missing/disconnected devices produce recoverable errors.

## Follow-up delivery — 2026-10-05

- Chat interaction is implemented in Conversation and Coach: fixed voice/text composer, automatic local transcription after Stop, editable transcript, opt-in auto-send and explicit Coach Continue.
- Full Help can request a complete fictional answer for the exact current prompt. The learner can listen, replace bracketed details and hide the example before speaking. Examples use Agy even with Apple conversation. Requests validate the active session and answer sequence; stale results are rejected. Cue exposure is recorded in SQLite before generation and conservatively excludes subsequent answers in that session from spontaneous mastery, including after restart. A failed example leaves the speaking session usable.
- Settings now lists microphone inputs and stores the selected device ID as a local WebView hardware preference. Explicit devices use exact capture constraints without silent fallback. Settings offers an explicit five-second record/playback/discard check using the practice PCM pipeline, without transcription, AI or retained audio. Capture reports the actual track label. Names may stay hidden until permission is granted; selection is blocked while a practice recording or test is active.
- The actual installed Agy CLI rejects `gemini-3.8-flash-high` combined with `--effort low`. Model IDs already encode effort; the app now sends the selected model without that conflicting override. A regression test exercises both explicit model IDs. Reply schema now declares word/plain-text constraints, and failures identify envelope/schema/content stage without saving provider output. Both conversation attempts share a 45-second budget.
- Synthetic conversation benchmark after fixing the invocation: Default 7257 / 6650 / 6426 ms; Flash Low 31384 / 23669 / 23617 ms; Flash High 25468 / 15839 / 14559 ms. All nine requests succeeded. Default is recommended from this small sample; no latency or reliability guarantee is implied. Full-response timing excludes STT/TTS. A synthetic complete guided answer also passed the real provider check.
- Automatic checks cover contracts, session recovery, cue persistence, stale help, exact-device constraints and output validation. Physical microphone selection, playback, STT, TTS and perceived speaking flow still require the user's next session. No real recording was started automatically.

The benchmark's Default entry used the CLI setting on this Mac: Claude Sonnet 4.6 (Thinking),
not another Gemini tier. Settings labels this option “Use Antigravity setting” and shows the model
read from the local CLI settings file. Changing the CLI model changes this option's behavior;
Recheck files refreshes the displayed setting. Explicit Flash Low/High selections override it.

Verification: 99 frontend tests and 141 Rust tests passed, with the two live-provider checks opted out
of routine runs and run explicitly on synthetic input. TypeScript, Biome (existing complexity warnings
only), rustfmt and clippy passed. The microphone worker read AGENTS.md, CODE_REQUIREMENTS.md,
PRODUCT_SPEC.md, ROADMAP.md, ARCHITECTURE.md and TECHNICAL_REQUIREMENTS.md; its full changed-file list
and diff were reviewed, with parent fixes for cleanup, architecture boundaries and test compatibility.

The final macOS app and DMG were built successfully and the installed `/Applications/English Trainer.app`
was updated after backing up the previous bundle. Installed and built executable hashes match; code
signature verification passed. In the installed app, Settings shows the detected Sonnet default,
input selector and explicit microphone check. The synthetic AI response test returned successfully
in 7661 ms. Personal Learning Memory remained available; no real microphone test was started.

## Microphone dropout investigation — 2026-10-05

The learner reported intermittent roughly one-second silence during the Settings microphone check.
The capture path explicitly enabled WebRTC echo cancellation and noise suppression and left automatic
gain to the browser default. The shared capture request now asks for all three to be disabled, avoiding
voice filtering in both the check and practice. Playback/TTS is stopped before capture. Exact input
selection remains unchanged. Constraints are preferences: unsupported browser or hardware processing
may remain active, and macOS microphone modes are outside this app's control.

The constraints regression checks failed against the prior implementation and passed after the fix;
all 99 frontend tests, TypeScript and Biome passed (the seven existing complexity warnings remain).
The filtering hypothesis is not a reproduced physical-device diagnosis. The learner must repeat the
record/playback check to establish whether this change removes the reported silence.

The learner confirmed the silence is audible in playback midway through a phrase, with System default
selected. The installed app reported MacBook Pro Microphone as the actual captured input.

The microphone fix was built and installed successfully. The installed executable matched the built
one and signature verification passed. The app was reopened at Settings with Start test available;
no microphone capture was started by the agent. Physical dropout acceptance remains pending.

### Gain-only follow-up

After disabling all three processing requests, the learner reported that the mid-phrase silence seemed
gone, but the beginning was very quiet and the end sounded normal. This is a tentative physical result,
not final acceptance. The next build requests automatic gain control alone, keeping echo cancellation
and noise suppression disabled. Constraint tests cover both default and explicit inputs. Whether the
browser honors independent processing flags, and whether the beginning becomes audible without
reintroducing silence, still requires the learner's record/playback comparison.

The gain-only follow-up passed all 99 frontend tests, TypeScript and Biome (existing warnings only),
was built and installed with matching executable hashes and verified signature, then reopened at
Settings. No physical recording was started by the agent; learner acceptance remains pending.

### Input readiness and measured diagnostics

The gain-only change did not improve the learner's recording and may have worsened it. All voice
processing requests were returned to false. Investigation found that AudioContext.resume completion
was being used as Recording readiness, before any input frames necessarily arrived. Recording now
waits for 750 ms of real input frames (not speech detection) and uses an eight-second startup timeout.
The startup frames are discarded while the UI says Starting, before the Recording interval begins.
Settings checks now last ten seconds, include a live level meter and show captured duration versus
recording wall time, per-second amplitude windows and browser-reported processing settings.
Diagnostics do not alter audio, infer speech presence or preserve any data beyond this test view.

The Agy worker read all six named policies and produced only the bounded pure signal module and its
tests. Parent review replaced its full raw-audio copy with streaming aggregation; chunk-boundary,
silence, final partial-window and invalid-number tests remained valid. Parent implemented startup and
UI integration. All 116 frontend tests, TypeScript and Biome passed with existing warnings only.
Hardware input quality and the actual cause of the level ramp remain unresolved until measured use.

The readiness/diagnostics app was built and installed, executable hashes matched and code signature
verification passed. The installed Settings UI shows a ten-second check. No microphone recording was
started by the agent. The saved explicit input appeared unavailable during pre-permission enumeration
with device names hidden; next physical comparison should explicitly choose System default rather than
silently falling back. Dropout and quiet-start hardware acceptance remains open.

### Measured quiet startup — 2026-10-05

With System default / MacBook Pro Microphone, the learner reported no audible dropout but a very quiet
first 1–2 seconds. Ephemeral Settings measurements showed 9.6 seconds of captured samples during
10.0 seconds of wall time. The first two recorded one-second windows were -60 / -61 dB, then -45 dB,
followed mostly by -40 to -44 dB. Echo cancellation was reported off; noise suppression and automatic
gain were not reported. This establishes that the low level is present in captured PCM, not only
playback; it does not prove whether the system ramp is time-based or reacts to speech.

The shared input warmup is extended from 750 ms to three seconds before Recording, with the existing
eight-second startup timeout. Settings explains the preparation delay. No audio normalization, speech
detection or microphone settings changes are introduced. This targets the observed startup interval;
physical confirmation is still required, especially if the gain changes only after speech begins.

The three-second preparation build passed all 116 frontend tests, type checking and focused Biome
checks. It was built and installed successfully with matching executable hashes and verified signature,
then reopened at Settings / System default. No recording was started by the agent; physical acceptance
of the first recorded second remains pending.

## Refocus review — 2026-10-06

### Observed by the user

- The core problem is structuring a spoken answer in real time, not knowing what to say.
- AI replies are still too slow, and technical terms are still sometimes misrecognised.
- Apple Intelligence now works on the user's Mac.
- Practice stays English-only; the interface may later be Russian. The standard system voice is
  acceptable.

### Investigation

- Code review found the main latency sources: an `agy` process per turn (agent CLI, schema,
  sandbox, no streaming), whole-reply generation before speech, strict reply validation, a
  `whisper-cli` process with `base.en` and no initial prompt per answer, and a three-second
  microphone warm-up per recording.
- Apple helper, synthetic input, three runs: 4,644 ms cold, then 1,598 and 1,663 ms for a whole
  non-streamed structured reply. One reply described the assistant instead of acknowledging the
  learner, so on-device quality must be checked in real sessions.
- Gemini API free-tier limits are shown per project in Google AI Studio; free-tier content may be
  used to improve Google products and read by human reviewers.

### Decisions

Recorded in [ROADMAP.md](ROADMAP.md#decisions-2026-10-06): streaming Apple and Gemini API
providers, `agy` out of the real-time path, English-only practice, frozen usage-review subsystem,
system voices until an avatar needs neural TTS. The documentation set was reduced to the MVP.
