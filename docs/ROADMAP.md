# Roadmap: English Trainer

Updated 2026-10-10. The learner checked the new Whisper model in the app and reported that it
works well. F4–F13 are built and awaiting the learner’s check in the app.
The learner deferred that check; the remaining core MVP work is listed below.

## Goal

A voice-first chat that lets the user practise **spoken** English every day. Reading and listening
are already strong; the bottleneck is producing structured spoken answers in real time. The MVP is
done when the user can open the app, pick a topic, and hold a natural spoken conversation in which:

1. the AI starts answering within about two seconds of the user finishing a sentence;
2. technical and personal vocabulary is transcribed correctly most of the time;
3. help for *structuring* an answer is available before and during speaking, without leaving the chat;
4. corrections arrive inline and never delay the next AI reply;
5. useful phrases from the session are kept and come back later for spoken review.

Everything not needed for these five outcomes is deferred.

## Decisions (2026-10-06)

| Topic | Decision |
| :--- | :--- |
| Conversation language | English only. The interface may later be localised (e.g. Russian); practice content never is. Whisper stays English-only. One approved on-demand exception: F13 translates a selected word into the native language chosen in Settings, on this Mac. |
| Gemini API use (2026-10-08) | The Gemini API free tier is used for conversation and the question-only F6 answer planner. Coaching and other AI side tasks go to Antigravity pinned to a Gemini model (batched) or to on-device Apple / macOS frameworks. Settings > Usage shows locally counted requests and the last limit errors, because neither API reports the remaining quota. |
| Conversation provider | Two streaming adapters behind one interface: **Apple Foundation Models** (on-device, free, private; measured 1.6 s warm / 4.6 s cold for a whole non-streamed reply on 2026-10-06) and the **Gemini API** (Flash / Flash-Lite, API key from Google AI Studio). The default is chosen by measured time to first spoken word. |
| Coaching, planning and wrap-up | Coaching runs through Antigravity CLI with `gemini-3.8-flash-medium`, in batches of up to five answers (decided 2026-10-08 from a measurement on 66 real answers: Apple on-device rewrites whole answers, "corrects" recognition artefacts or finds nothing; one `agy` call per answer exhausted the Antigravity quota after about 54 calls; the Gemini API free quota is reserved for conversation). Planning (F6) stays on the Gemini API. F9 prepares session phrases in one background `gemini-3.8-flash-high` call. |
| Antigravity CLI (`agy`) | Leaves the real-time path: an agent CLI adds process start, agent loop and schema enforcement (6–30 s measured; 14–136 s for a batch of five) and cannot stream. It stays as the slow background tier (coaching, answer examples, usage review), always with an explicit Gemini model. |
| TTS | macOS system voices (the standard voice is acceptable). Neural TTS only together with the avatar. |
| Usage-review / mastery-streak subsystem | Frozen: keeps working, is not extended. F10 reuses its data; simplifying it is reconsidered after the MVP with real usage data. |
| Gemini API key | Only the API key is needed (no client secret). Pasted in Settings and stored in an encrypted, owner-only file in the app data folder, bound to this computer (no system Keychain prompt, which looked alarming in the alpha). Developer override: environment variable `ENG_TRAINER_GEMINI_API_KEY` (not inherited by a Finder launch). Never in SQLite, logs or the repository. |
| Portability | macOS stays the only MVP target, but new core code must not block a later Windows build: providers behind traits, cross-platform key file, no macOS-only APIs outside adapters. |
| Gemini free tier | Prompts and responses on the free tier may be used by Google to improve products and may be read by human reviewers. Only practice transcripts are sent; Settings states this next to the key field. Billing can be enabled later to opt out. |

## Delivery rules

- **One feature = one commit.** A feature is a user-visible vertical slice, sized so that it can be
  tested by speaking into the app. Refactors ride along with the feature that needs them; no
  commits that only move a few lines.
- A feature is done when its acceptance checks pass in the built app on a physical Mac, not when
  code or an interface exists. `bun run verify` covers typed contracts, state machines,
  persistence and browser flows; CI keeps failure traces and screenshots. Physical audio checks
  can be grouped and performed later, as the learner requested on 2026-10-09.
- Measure before and after any latency or STT change and record the numbers in the commit body.

## Diagnosis of the alpha (2026-10-06)

| Problem the user reported | Root cause in the current code |
| :--- | :--- |
| AI replies are slow (7–30 s) and sometimes fail | Every turn spawns the `agy` agent CLI with a JSON schema, a sandbox, and a full process start. The reply is generated whole, then spoken. Strict regex/word-count validation rejects otherwise usable replies. |
| Technical terms are misrecognised | `ggml-base.en` (smallest useful model); `whisper-cli` reloads the model on every answer; no initial prompt with the question or a personal glossary. |
| Each answer feels slow to start (~2 s before speaking is possible, then a quiet first second) | Every recording opens a new microphone stream, audio graph and worklet, then discards three seconds of input while the Mac input level ramps up. Apps that keep the microphone open (e.g. Google Meet) never hit this ramp. |
| Hard to structure a spoken answer | Help is a deterministic list of starters chosen by keywords, or a full example that must be requested and waited for. Nothing helps in the middle of an answer when the learner gets stuck or misses a word. |
| Conversation and Coach feel like separate tools | Two session modes with different flows; Coach requires an explicit Continue step; feedback is a separate panel. |

## MVP features

Status legend: `[ ]` not started, `[~]` in progress, `[x]` accepted on a physical Mac.

### Stage 1 — Fast voice conversation

**F1. Streaming conversation providers** `[x]`
- Make `ConversationEngine` streaming: the reply is plain text delivered in chunks to the UI over a
  Tauri `Channel` and rendered as it arrives.
- Apple adapter: one long-lived helper process per app run (JSON lines over stdin/stdout),
  `prewarm()` when a session opens, `streamResponse` for output.
- Gemini API adapter: HTTPS streaming (`streamGenerateContent`); key entered in Settings and stored
  encrypted (see Decisions), never in SQLite or logs. When Gemini stalls for 2 s or is
  overloaded, the on-device Apple model answers instead.
- Replace the regex-heavy JSON schema with plain text plus light Rust checks (length cap, strip
  markdown). A long or imperfect reply is trimmed, not rejected.
- Settings: provider choice, key field with the data-use notice, "Test AI response" reporting
  time to first token and total time.
- Acceptance: median time to first token under 1 s for the chosen default; no "invalid reply"
  failures in a 20-turn session.

**F2. Instant microphone and hands-free turns** `[x]`
- Open the microphone once when a session starts and keep one warm stream until the session is
  paused or finished, so recording starts the moment it is requested; remove the per-answer
  three-second warm-up. Keep a short pre-roll buffer (~300 ms) so the first syllable is never cut.
  The macOS microphone indicator stays on during an active session; pausing releases the device.
- Auto-listen (on by default, toggle in Settings): when the AI finishes speaking, listening starts
  automatically and is shown clearly; one key or click cancels it. Push-to-talk remains available.
- End of turn by voice activity after a configurable pause (default ~1.5 s), with a "keep
  listening" control for thinking pauses.
- After transcription the answer is sent after a short visible edit window (~2 s); editing the
  text stops the countdown.
- Live microphone level while listening (the first piece of the voice visual).
- Microphone check in Settings and first run: device picker, live level, 10-second record and
  playback.
- Acceptance: the first word of an answer is captured and transcribed in 10 of 10 tries;
  listening starts within 200 ms of the request or of the end of AI speech; a 10-minute
  conversation without touching the keyboard or mouse.

**F3. Accurate speech recognition** `[~]` (parts 1 and 2 built; the learner checked the new model in the app on 2026-10-09 and reported that it works well; the formal 30-term / 15-second acceptance measurements remain open)
- **Part 1 (built, awaiting a check in the app on a physical Mac).** Settings > Speech recognition: the
  speech check (12 fixed sentences read aloud, kept in `<app data>/speech-check/` as the learner's own
  test set, "Delete recordings" removes them), measurement of every `ggml-*.bin` model in
  `<app data>/models/` (term accuracy over the glossary, word error rate, median and slowest time,
  each transcript beside its sentence; optionally also with the glossary as initial prompt), and a
  Model select whose choice is stored and used by transcription (default `ggml-base.en.bin`;
  `ENG_TRAINER_WHISPER_MODEL` still wins). Settings > Personalisation: the editable personal
  glossary, seeded once with 27 words. Settings > Privacy: the "Keep raw audio" switch (off by
  default) with "Delete kept recordings". The glossary reaches live transcription through part 2 below.
- **Part 2 (built 2026-10-09; the learner checked the new model in the app and reported that it works well).** Decision from the
  measurements below: `small.en` is the default model when installed (base.en otherwise; a model
  the learner chose is never replaced). A `whisper-server` child keeps the model loaded (started
  when a practice session opens, restarted once if it dies, replaced on a model change, stopped on
  exit; falls back to `whisper-cli`, and Setup details say so). Every answer carries an initial
  prompt: the question being answered, names from the last answers, the glossary (500 characters at
  most). A live transcript (dashed bubble, caret, "Live transcript") re-transcribes the audio so
  far every 1.5 s while the learner speaks, only with base/small models and a ready server;
  the final transcription is unchanged. Settings > Speech recognition shows "Kept loaded · ready" /
  "Loading…" / "Not running (using one-off runs)" and a Live transcript switch (on by default).
  Memory review, pre-session warm-up and unscored shadowing use the same live local transcription
  during one-shot capture. A dashed bubble with a caret shows provisional words; it disappears on
  stop or cancellation, and only final transcription can be scored. Disabled or unavailable live
  recognition and missed updates leave the final answer path usable. No additional microphone or
  cloud request is opened.
- **Measured on the learner's 12 speech-check recordings (2026-10-09).** Glossary terms recognised
  (of 23), without / with the glossary prompt, whisper-cli including model load: base.en 13 / 19
  (0.4 s); small.en 17 / **21 (91%)** (1.0 s); medium.en 17 / 20 (3.3 s, deleted);
  large-v3-turbo-q5_0 17 / 19 (1.7 s; better word error rate overall, 7% against 11%). With the
  model kept loaded in `whisper-server`: small.en loads in 0.7 s and answers in 0.32 s (median);
  large-v3-turbo loads in 0.4 s and answers in 1.15 s, too slow to follow speech live. Through the
  new code (ignored test `the_real_server_transcribes_a_speech_check_recording_quickly`): first
  answer 0.99 s including the load, then 0.28 to 0.30 s. This meets the acceptance (at least 90%
  of terms; a 15 s answer in under 1.5 s) with small.en, the prompt and the warm server; the
  30-term list and a spoken 15 s answer still need the check in the app.
- Design (Settings > Personalisation): the row "Personal glossary" ("Words speech recognition
  should know: Tauri, Kubernetes, idempotent, Oleksii…") with an "Edit · 18" button that opens an
  editable word list; the list feeds the initial prompt above. Built in part 1 (the list is stored
  and edited) and part 2 (it reaches every transcription). "About you" stays hidden until F8.
- Design (Settings > Privacy): the "Keep raw audio" switch (off by default; "Off: audio is deleted
  right after transcription"). Built in part 1: a stored setting, answers kept under
  `<app data>/recordings/<session>/<sequence>.wav` only when it is on, and "Delete kept recordings".
- Design: a live transcript bubble (dashed, with a caret, "Live transcript") grows while the learner
  speaks; needs partial results from the loaded model. The spoken Memory review has the same bubble
  while the learner answers a situation, including practice-only retries.
- Live Memory transcript regression checks (2026-10-10): seven browser scenarios exercise the real
  PCM recorder with synthetic audio and typed local STT edges. They cover provisional vs final
  wording, one-score-only shadowing, unavailable/failed live recognition, cancellation and late
  responses, silence, warm-up completion while a partial request is pending, and background model
  prewarming for a first review after launch. The main scenario
  failed on the prior implementation because the live bubble was missing, then passed after the
  change. Run `bun run test:e2e e2e/liveReview.e2e.ts --workers=1`. Actual recognition quality,
  microphone permissions and the formal timing/term measurements below remain physical checks.
  Full regression: 403 frontend tests and 68 serial browser scenarios pass; both TypeScript
  checks and Biome pass. The updated macOS app and DMG are built and their signature verified.
- Acceptance: a fixed list of 30 of the user's technical terms is recognised in at least 90% of
  readings; transcription of a 15 s answer finishes in under 1.5 s.

**F4. Speak while generating + voice visual** `[~]` (built; physical Mac acceptance deferred by the learner)
- Split the streamed reply into sentences and speak the first sentence while the rest arrives.
- Barge-in: starting to speak (or pressing record) stops AI speech immediately. Needs echo
  cancellation on the warm stream, or listening paused while the AI speaks.
- The Talk screen voice visual from the design brief ([`ui/DESIGN_BRIEF.md`](ui/DESIGN_BRIEF.md)):
  listening, thinking and speaking states driven by real audio levels.
- The visual is Eva, the mascot (brief §8.1): eye expressions per turn state and emotion, a small
  face on Eva's messages, the app icon, the "Reduce motion" fallback. Settings → Eva: sphere and
  eye colour, animation level (full / gentle / still), the explanation of every face.
- Instrument end-of-speech → first AI audio and show it in a debug panel.
- Design: while Eva is thinking the mic control reads "Speak anyway" (sub "You can speak anyway") and
  pressing it cancels the pending reply and starts listening. (Stopping Eva while she speaks, by the
  mic or Esc, already exists; barge-in by voice is the item above.)
- Built 2026-10-10: completed sentences start speaking before provider completion; the final
  question is queued once. Mic, Space, "Speak anyway" and Esc cancel speech and the pending reply;
  late chunks cannot resume playback or save an interrupted answer. Auto-listening waits for both
  provider completion and the last natural speech end.
- Settings → Conversation flow: "Interrupt Eva by voice" is opt-in and requests echo cancellation.
  Voice onset is enabled only when the acquired track confirms echo cancellation; otherwise mic
  and Esc remain available. Listening visuals follow microphone level; speaking follows native
  TTS events (system voices do not expose their output amplitude). Reduced motion stays static.
- Automated checks cover sentence boundaries, canonical tail deduplication, cancellation races,
  helper restart, late events, released-Space cancellation and the speech queue. Checks pass:
  384 TypeScript tests, 354 Rust tests plus the SQLite integration test, and 32 browser scenarios.
  The timing panel measures first text, full provider completion, send → first audio and actual
  speech-end → first audio when available.
- On-device synthetic benchmark (10 Apple helper turns, 2026-10-09): full-reply readiness before
  sentence streaming p50/p95 2981/5304 ms; first-sentence readiness after p50/p95 1455/4036 ms;
  10 successes, 0 errors. These are provider text readiness measurements, excluding Whisper and
  actual TTS output. Default microphone processing and STT remain unchanged; opted-in echo
  cancellation still needs a physical-Mac recognition/feedback check.
- Acceptance: end-of-speech → first AI audio under 2.5 s median over 10 real spoken turns.
  Check audible sentence joins, interruption with speakers/headphones, microphone permissions,
  recognition with optional echo cancellation and actual timing in the built app.

### Stage 2 — Help to structure spoken answers

**F5. One Talk screen with inline coaching** `[~]`
- Built to the design brief ([`ui/DESIGN_BRIEF.md`](ui/DESIGN_BRIEF.md)).
- Merge Conversation and Coach into a single chat. Deep feedback runs in the background, off the
  turn path, and appears under the message when ready: one natural rephrasing of what the user
  meant plus at most one focus point. It never blocks the next AI turn.
- "Say it again" on any message records a second attempt and shows the comparison inline.
- Remove the separate Coach session mode and the explicit Continue step; existing sessions stay
  readable. This also removes the `coach ↔ practice` feature dependency cycle.
- Design details of the inline note: it appears by itself under its own message (Conversation
  included), collapses when the next turn starts, and "Say it again" shows the second try inside the
  note (dashed teal box, "✓ You used …") instead of the separate comparison panel. The focus point
  is one sentence. The "Coach" chip and step name in the header go away.
- Batch decision (measured 2026-10-08 on 66 real answers): coaching goes through `agy` with
  `gemini-3.8-flash-medium`, up to five answers per call. It found as many real mistakes as one call
  per answer (83 against 81 on 50 answers) in 14 calls instead of 66, with a median of about 40 s per
  batch (14–136 s); one call per answer exhausted the Antigravity quota after about 54 calls. Apple
  on-device was rejected (rewrites whole answers, "corrects" recognition artefacts, or finds nothing)
  and the Gemini API is not used (its free quota is kept for conversation).
- Built (`[~]`; acceptance in the built app on a physical Mac is deferred): one Talk mode and route
  (`/coach`, "Get feedback in Coach", the Coach chip and the Continue step are gone; older Coach
  sessions are read as Talk sessions); a Rust coaching queue (a batch at 5 waiting answers, at
  finish, and after 60 s of quiet; one batch at a time; one retry; a calm "couldn't check this
  answer" with a manual Retry; a quota error pauses coaching with a notice); the inline note
  (loading, "More natural" with changed words highlighted, one focus sentence, Say it again inside
  the note, Save phrase with Undo, collapsed under older answers and when the next turn starts); the
  wrap-up flushes the queue and shows "Still checking N answers…" until the last batch lands; every
  `agy` call pins a Gemini model. See `TECHNICAL_REQUIREMENTS.md` §6.
- Acceptance: a 10-turn session where feedback appears for every answer and the AI reply is never
  delayed by it.

**F6. Answer planner** `[~]`
- When the AI asks a question, prefetch in the background a short plan for answering it: a
  three-step frame suited to the question type (e.g. point–reason–example, past–present–future,
  situation–action–result), three to five useful phrases, and a model answer kept hidden by default.
- Help is graduated and visible above the composer: Frame → Phrases → Example. Optional 15–30 s
  planning timer before speaking.
- Opening help is recorded so cued answers are not counted as independent evidence. Per-answer help
  use is recorded (`record_answer_help_used`, shown as "used help" in the dialogue); cued
  answers are excluded from independent spoken memory evidence, including after restart.
- Design: the help chips are numbered "1 Frame · 2 Phrases · 3 Example"; Frame adds "Plan first:
  15 s / 30 s". Example shows the prefetched model answer at once with "Model answer — try your own
  version after reading", Play and "Hide before speaking" (replacing today's request-then-adapt flow).
- Built: Gemini prepares the current question's validated English plan in the background, without
  the conversation transcript or Apple helper queue. One question is cached, including failures;
  only explicit Retry requests another failed preparation. Stale results are rejected. Prefetch
  records no cue; a help level opens only after its per-answer cue is saved. Example has Play and
  Hide before speaking, and closes before microphone capture. Frame offers 15/30-second planning;
  expiry never starts capture, and planning suppresses automatic listening while keeping the mic warm.
- Automated coverage includes cache reuse, failure/retry, stale questions, slow planning alongside
  replies, cue persistence and independent-evidence exclusion, plus browser help and timer flows.
  Deterministic provider fixtures do not establish real Gemini latency or answer quality.
- Validation: 387 TypeScript tests, 367 Rust unit tests plus one SQLite integration test, and
  40 browser scenarios pass; Biome, Clippy and both TypeScript checks pass. The macOS app and DMG
  are built. Eight live/provider tests remain opt-in.
- Built-app acceptance and the live Gemini check are deferred to the user's physical Mac.
- Acceptance: help is shown instantly (already prefetched) for at least 9 of 10 questions.

**F7. Stuck rescue** `[~]` (built; physical Mac acceptance deferred by the learner)
- "Stuck" button (and keyboard shortcut) while speaking: transcribes what has been said so far and
  suggests the next step in English — a connector, a sentence start, or a simpler way to say the
  idea ("say it simpler") — without ending the turn.
- "Missing word": the user describes the word in English ("the thing that stores data
  temporarily…") and gets candidate words to choose from. Practice stays in English.
- Rescue use is recorded as a cue, like guided help.
- Built: Stuck / S during recording, Next step and Say it simpler from a local snapshot of the
  newest 15 seconds, and 3–5 Missing word candidates from an English description. The full answer
  stays intact; Stop, Cancel and retry remain available. Opening help suspends hands-free turn end
  and silent auto-listen expiry; closure restores only its own hold. Recording/question identity
  discards late results. Rust saves a per-answer cue before generation, including failed attempts,
  and excludes that answer from independent memory evidence.
- Rescue is explicitly pinned to `agy` / `gemini-3.8-flash-high`, with one call and a 20-second
  process bound. A real synthetic request returned validated next-step JSON in 9.1 seconds.
  The installed CLI returned empty results with `--json-schema`; F7 instead requests JSON in the
  prompt and strictly validates the ordinary response locally. This measurement covers generation
  only, so the under-10-second end-to-end target still needs real Whisper and built-app acceptance.
- Automated validation covers audio-tail preservation, strict request/output contracts, model
  pinning and CLI compatibility, per-answer cues, concurrency and late responses, and seven browser
  scenarios running the real PCM recorder and turn detector against audio/provider edges.
  394 TypeScript tests, 379 Rust unit tests, one SQLite integration test and 47 browser scenarios
  pass; Biome, Clippy and both TypeScript checks pass. The app and DMG are built; nine live tests
  stay opt-in in the normal regression suite.
  Run `bun run verify`; physical microphone, relevance and total recovery time remain manual.
- Acceptance: a stuck moment can be resolved in under 10 s without leaving the chat.

**F8. Topics, profile, and time-based sessions** `[~]`
- Topic picker: work and technology, daily life, opinions and debates, plans and stories, job
  interview (HR, behavioural, technical). Free topic is also possible.
- A short personal profile (role, stack, interests, goals) feeds topic questions and the STT
  glossary.
- Design (Settings > Personalisation, hidden until the data exists): the row "About you" with the
  profile as one line ("Backend engineer · Rust, TypeScript · climbing, sci-fi · goal: speak up in
  stand-ups") and an "Edit" button; the group returns to the Settings sub-navigation with it.
- Session goal by time (e.g. 10 minutes) instead of a fixed number of answers; the AI varies
  question types: describe, explain, compare, give an opinion, tell a story, disagree politely.
- An unfinished session can be continued from the start screen ("Continue: Work & technology,
  4 min left").
- Design: Memory rows name where a phrase came from with the topic and when ("Work & technology ·
  Today"); today the source line is the saved note, or "From a conversation", and when.
- Design: start screen heading "What shall we talk about?", topic grid, length segment, the summary
  line under Start ("Work & technology · 10 min · warm-up first"), and a Continue card naming the
  topic, when it was paused and the minutes left; the Talk header shows the topic and "6:12 of
  10:00". The wrap-up header's subtitle gains the topic ("Work & technology · 10 min 24 s"); today
  it shows only the session length.
- Added 2026-10-08: choose a topic for a conversation or get a random one, and the opening question
  varies with the topic instead of always asking "What is something interesting that happened to
  you recently?".
- Built 2026-10-09 (awaiting acceptance in the built app): topic and random-topic selection,
  topic-specific opening questions, optional local profile, a suggested 5 / 10 / 15 minute goal,
  an active-time clock that excludes pauses and time while closed, saved topic/time on Continue,
  and topic provenance in Memory and wrap-up. The existing spoken review remains separate;
  the optional pre-session warm-up belongs to F10.
- Acceptance: three sessions on different topics feel relevant to the user's real life and work.

### Stage 3 — Remember and review

**F9. Session wrap-up** `[~]` (built; physical Mac acceptance deferred by the learner)
- At the end of a session, prepare up to three reusable English phrases with a short usage note
  and an exact quote from the learner's numbered answers. Up to two recurring mistakes come from
  the session's background coaching. Save the selected phrases to Memory in one action.
- Speaking time, words per minute and average answer length appear immediately, as local personal
  trends against the previous comparable session; no CEFR or mastery claims.
- Built: one durable SQLite job is committed with session finish. A separate worker prepares phrases
  without holding the conversation lock, resumes pending jobs after restart and saves a stable
  snapshot. Empty sessions need no provider. Failures show a typed message and explicit Retry;
  finished sessions from older versions retain their coaching phrases and can opt into preparation.
- The adapter pins `agy` to `gemini-3.8-flash-high`, sends at most 24 bounded answer excerpts and
  strictly checks the ordinary JSON response, including exact quote provenance. One synthetic live
  request succeeded in 10.44 seconds; this does not establish real-session quality or latency.
- Save all is a single transaction. Undo removes only newly created cards, preserving existing
  duplicates. Cards keep their note and quote after coaching refresh or Save/Undo.
- Memory, due conversation targets and spoken Memory review now require two distinct observations
  of a mistake. First observations stay stored and inline; repeat delivery of one answer does not
  count twice, and replacement feedback reprojects eligibility. Existing single observations are
  preserved and become visible after another occurrence. The frozen mastery subsystem is unchanged.
- Automatic validation covers durable jobs, restart, nonblocking generation, provider contracts,
  transactional rollback, duplicate-safe Undo, recurring eligibility and browser flows.
- Validation: 397 TypeScript tests, 401 Rust unit tests plus one SQLite integration test, and
  53 browser scenarios (`--workers=1`) pass; Biome, Clippy and both TypeScript checks pass.
  The macOS app and DMG are built. Ten live/provider tests remain opt-in; the F9 synthetic
  live check was explicitly run and passed. An existing F6 auto-capture scenario intermittently
  failed in a parallel browser run during packaging, then passed in the complete serial run;
  this does not establish that the parallel-run timing issue is fixed.
- Built-app acceptance remains deferred: finish a real spoken session, inspect the phrases and
  notes, save/undo them, and confirm later spoken review on the physical Mac.

**F10. Spoken phrase review** `[~]` (built; physical Mac acceptance deferred by the learner)
- Due phrases return as short spoken tasks: the AI gives a situation, the user answers using the
  phrase. Optional shadowing: listen to an AI sentence and repeat it.
- Due phrases are also woven into topic questions (existing learning-target context).
- Optional two-minute spoken warm-up with due phrases before a session, chosen on the start
  screen.
- Freeze the existing usage-review/mastery-streak machinery: keep it working, do not extend it
  until the core loop is fast and used daily.
- Design: the start-screen review card offers "A 2-minute spoken warm-up before you start" with a
  Before session / Skip today toggle.
- Built: a normal run snapshots up to six safe due phrases or recurring mistakes; a fresh
  pre-session warm-up selects up to three phrases. Either route resumes an unfinished run
  unchanged. Skip and End keep unanswered items due. The selected topic, custom text, mode and
  suggested length survive the warm-up handoff; resume, Text chat and Write it, then say it
  bypass warm-up. It is optional and Skip today is the default.
- Built: `ReviewMaterialEngine` prepares a situation and a complete model sentence for each
  snapshot item using one background `agy` Flash 3.8 request. SQLite caches pending/ready/failed
  work across restarts; failures require explicit retry. Late results cannot revive ended runs.
  Safe saved cues and recording remain usable during preparation, and a situation freezes for
  the answer once capture begins. Empty or revealing saved notes remain ineligible for recall.
- Built: the target is hidden before the first scored answer. Show phrase persists cue exposure
  before returning wording and labels the answer as practice with a hint. The model sentence is
  exposed only after the first score, with Play example and optional shadowing. All retries and
  shadowing are practice only; reviews never establish independent mastery. The existing
  usage-review/mastery subsystem is unchanged.
- Automatic verification includes strict generated-output/IPC boundaries, six-item selection,
  three-phrase warm-up, migration from SQLite v19, restart recovery, cue-write failure, cached
  provider failure and explicit retry, and generation outside the session lock. A synthetic live
  Flash 3.8 batch succeeded in 16.52 s; microphone/STT/TTS feel still needs physical Mac acceptance.
- Verification: 403 frontend tests, 419 Rust unit tests plus the SQLite integration test, and all
  61 browser scenarios passed serially. Biome, both TypeScript checks, Rust format and Clippy
  passed. Browser coverage includes real test PCM capture, late preparation during recording,
  one-score-only shadowing, failed hint writes, Text chat bypass, selected-options handoff and a
  resumed fully answered warm-up whose finish write fails before an explicit successful retry.
- Built-app acceptance: complete a real six-item review, listen and shadow a generated example,
  use Show phrase, and choose or skip the pre-session warm-up on a physical Mac. Automatic
  tests verify state and persistence; microphone permissions and perceived speech quality remain
  deferred.

### Stage 4 — Plan of 2026-10-08 (after F3 and F8)

**F11. Write it, then say it** `[~]` (built; physical Mac acceptance deferred by the learner)
- A text chat with Eva on a topic; also available as a standalone "text chat" mode for social
  practice.
- After writing, the learner first reviews the corrections of what they wrote and repeats them. On
  "Ready to speak" the same conversation runs by voice. Afterwards the corrections of the spoken
  answers are reviewed again, with the aim of fewer mistakes than in writing.
- A mistake that repeats several times goes into the spoken review (F10).
- Coaching goes through Antigravity (Gemini, batched) like F5; the Gemini API is not used for it.
- Built: Speak, standalone Text chat, and Write, then speak choices; writing → written review →
  replay of the exact original questions → spoken review, all saved in one session. Restore
  preserves the phase and counts. Writing and review do not automatically open audio; Ready to
  speak enables it. Feedback remains asynchronous and shows pending, paused and failed states.
  Rehearsal is recorded as cued practice rather than independent mastery evidence.
- Automated checks cover phase/source guards, migration, atomic cue exposure, question provenance,
  reopening a real SQLite session, stale clock snapshots, navigation, send/transition retries,
  and browser audio boundaries. Run `bun run verify`; browser failure reports include traces and
  screenshots. Acceptance still needs a built-app run with real microphone, Whisper and TTS.

**F12. Practice my usual mistakes** `[~]` (built; physical Mac acceptance deferred by the learner)
- From the recurring mistakes in Memory (for example "the most part of" → "most of", "Just I want"
  → "I just want", "in the university" → "at university"), Eva asks about five short spoken
  questions that need the right form. About two minutes.
- Built: Memory launch card, eligibility from non-archived mistakes seen at least twice (not
  limited to due items), one background Gemini-pinned Antigravity call for five questions,
  saved question snapshots and exact resume. Answers advance locally without a conversation
  provider call; coaching remains asynchronous. Voice/edited speech only; the fifth answer
  locks further input and automatic listening. Finish remains available throughout.
- Practice is recorded as cued evidence and does not advance independent-use mastery.
- Automated checks cover target selection, output validation/model pinning, preparation errors
  and concurrency, atomic persistence/migration, voice-only progression, coaching provenance,
  restore, browser launch/retry/audio boundaries and completion. Run `bun run verify`.
  Acceptance still needs the built app with a real microphone, Whisper, TTS and question relevance.

**F13. Translate a word** `[~]` (built; physical Mac acceptance deferred by the learner)
- Select a word in Talk, in notes or in Memory to see its translation into the native language
  chosen in Settings (Russian for this user) next to a simple English explanation.
- The translation uses the on-device macOS Translation framework, never the Gemini API. An approved,
  on-demand exception to "practice content is English only" (see `PRODUCT_SPEC.md`).
- Built: explicit selected-word lookup in Talk, coaching notes and Memory, a keyboard word field,
  a persisted native-language preference (Russian default), status and explicit preparation for
  native language models, retry and stale-result protection. Original practice text stays English.
- The separately bundled Swift helper uses macOS Translation (macOS 26+) and local Apple
  Intelligence for a simple English explanation. Translation stays visible when the explanation
  is unavailable; the conversation does not wait for lookup and no cloud request is made.
- Automated checks cover word/output validation, migration and preference persistence, cue
  exposure, native process errors/timeouts/concurrency, selection, keyboard/retry/preparation,
  language changes and late results. The real helper was checked on this Mac with a synthetic
  English-to-Russian word and English explanation. Built-app selection, translation relevance
  and the native missing-model download consent still await physical acceptance.

### MVP acceptance

The user practises for at least 10 minutes on five different days within two weeks using only
F1–F10, and reports that answers are easier to structure than in the first alpha.

## Architecture and code-quality work

Done as part of the feature that touches the code, not as separate commits.

| Item | When |
| :--- | :--- |
| `src/context` imports features (types only). The `coach ↔ practice` import cycle was removed in F5. | Later |
| Session, database and validation errors are all returned as `ProviderError`; add typed `SessionError` / `PersistenceError` kinds across IPC. | F1 or F5 |
| Pipeline integration and browser regression tests are implemented with F11: temporary SQLite plus a fake provider, and real React flows with typed IPC/audio edge fixtures. | Extend alongside affected features; `bun run verify` and CI |
| Conversation and STT processes poll `try_wait` every 50 ms and restart on every turn; long-lived workers and HTTP streaming remove this. | F1, F3 |
| Seven Biome complexity warnings (e.g. `buildDialogueMessages`). | Whichever feature edits the file |

## After MVP

Ordered by expected value; revisit with real usage data before starting any of them.

1. **Avatar.** A 2D character with state animation driven by real audio amplitude, then a 3D
   avatar (e.g. VRM with viseme lip-sync). Real lip-sync needs TTS audio the app can analyse, so it
   likely comes with a neural local TTS (e.g. Kokoro) instead of the Web Speech API.
   Includes the experimental upload of an own character (Rive or Lottie with Eva's states;
   missing states fall back to Eva). Design: Settings > Eva has the card "Your own
   character" (Experimental badge, drop area "Drop a Rive (.riv) or Lottie (.lottie) file", the
   ten states idle, listening, processing, thinking, speaking, happy, encouraging, curious,
   concerned, asleep, "Choose file" and "Get template"); hidden until this item.
2. **Natural voice.** Neural TTS (local or API) with a voice the user enjoys listening to.
   Design: first run's voice step describes each voice with a character ("warm, clear", "calm",
   "lively"). macOS gives only the name, accent and quality tier, so first run shows those
   ("American English · Premium"); the character words need curated voice metadata, which comes with
   this item.
3. **Interview packs.** Structured mock interviews with the same Talk screen.
4. **Progress view.** Weekly trends of speaking time, words per minute, pauses and saved phrases,
   with examples from real answers.
5. **Eva check-ins and menu-bar quick practice.** Opt-in (off by default). A small floating panel
   with Eva appears during the day and asks one short spontaneous question ("What are you working
   on right now?", "Describe what is on your desk"); the app never sees the screen. The learner
   answers aloud for 30–90 s and gets one rephrasing with Save phrase, or continues in the main
   window. Frequency in Settings (Off / Rarely ~2 a day / Sometimes ~4 / Often ~8) with working and
   quiet hours, and in the panel itself: Less often, More often, Not now (snooze 1 h); several
   ignored check-ins in a row lower the frequency automatically. No streaks or guilt. The panel
   never takes keyboard focus until clicked (non-activating panel), does not appear in Focus / Do
   Not Disturb, over a full-screen app or while another app uses the microphone, and opens the
   microphone only for the answer. The same panel opens on demand from a menu-bar icon.
6. **Windows build.** Tauri, whisper.cpp, WebView2 speech synthesis, the Gemini API and the encrypted
   key file all work on Windows; Apple Foundation Models does not, so Gemini is
   the conversation provider there. Needs a Windows CI job and installer.
7. **4/3/2 retelling drill.** Tell the same story in four, three and two minutes.
8. **Pronunciation.** Shadowing feedback and, later, phoneme-level scoring. WidgetKit and
   gamification only if they increase how often the user speaks.

## Removed from the plan

The previous phase plan (Phases 0–9), the duplicated screen inventory, the dated pass logs, the
Interview/Drills/Progress prototype screens as near-term work, the ambient scheduler, companion XP,
the five-dimension benchmark, and WidgetKit as MVP requirements. History stays in git and in
[`PERSONAL_ALPHA_FEEDBACK.md`](PERSONAL_ALPHA_FEEDBACK.md).
