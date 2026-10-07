# Roadmap: English Trainer

Updated 2026-10-06 after the first personal-alpha sessions.

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
| Conversation language | English only. The interface may later be localised (e.g. Russian); practice content never is. Whisper stays English-only. |
| Conversation provider | Two streaming adapters behind one interface: **Apple Foundation Models** (on-device, free, private; measured 1.6 s warm / 4.6 s cold for a whole non-streamed reply on 2026-10-06) and the **Gemini API** (Flash / Flash-Lite, API key from Google AI Studio). The default is chosen by measured time to first spoken word. |
| Coaching, planning and wrap-up | Gemini API (better quality than the on-device model). Apple is the offline fallback where its quality is acceptable. |
| Antigravity CLI (`agy`) | Leaves the real-time path: an agent CLI adds process start, agent loop and schema enforcement (6–30 s measured) and cannot stream. Kept only as an optional slow-tier fallback until the Gemini API adapter covers coaching; then removed. |
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
  code or an interface exists. Automated tests cover parsers, state machines, and persistence.
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
  encrypted (see Decisions), never in SQLite or logs. When Gemini stalls for 1.2 s or is
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
- Acceptance: the first word of an answer is captured and transcribed in 10 of 10 tries;
  listening starts within 200 ms of the request or of the end of AI speech; a 10-minute
  conversation without touching the keyboard or mouse.

**F3. Accurate speech recognition** `[ ]`
- Keep the Whisper model loaded between answers (in-process `whisper-rs` with Metal, or a bundled
  `whisper-server` sidecar) and upgrade the default English model (e.g. `small.en`, `medium.en`,
  or a quantised `large-v3-turbo`); decide by a measured accuracy/latency comparison on the user's
  recordings.
- Pass an initial prompt built from the current question, recent turns, and a personal glossary
  (editable in Settings: employer stack, tools, names).
- Acceptance: a fixed list of 30 of the user's technical terms is recognised in at least 90% of
  readings; transcription of a 15 s answer finishes in under 1.5 s.

**F4. Speak while generating + voice visual** `[ ]`
- Split the streamed reply into sentences and speak the first sentence while the rest arrives.
- Barge-in: starting to speak (or pressing record) stops AI speech immediately. Needs echo
  cancellation on the warm stream, or listening paused while the AI speaks.
- The Talk screen voice visual from the design brief ([`ui/DESIGN_BRIEF.md`](ui/DESIGN_BRIEF.md)):
  listening, thinking and speaking states driven by real audio levels.
- Instrument end-of-speech → first AI audio and show it in a debug panel.
- Acceptance: end-of-speech → first AI audio under 2.5 s median over 10 turns.

### Stage 2 — Help to structure spoken answers

**F5. One Talk screen with inline coaching** `[ ]`
- Built to the design brief ([`ui/DESIGN_BRIEF.md`](ui/DESIGN_BRIEF.md)).
- Merge Conversation and Coach into a single chat. After each user message, deep feedback runs in
  parallel with the AI reply and appears under the message when ready: one natural rephrasing of
  what the user meant plus at most one focus point. It never blocks the next AI turn.
- "Say it again" on any message records a second attempt and shows the comparison inline.
- Remove the separate Coach session mode and the explicit Continue step; existing sessions stay
  readable. This also removes the `coach ↔ practice` feature dependency cycle.
- Acceptance: a 10-turn session where feedback appears for every answer and the AI reply is never
  delayed by it.

**F6. Answer planner** `[ ]`
- When the AI asks a question, prefetch in the background a short plan for answering it: a
  three-step frame suited to the question type (e.g. point–reason–example, past–present–future,
  situation–action–result), three to five useful phrases, and a model answer kept hidden by default.
- Help is graduated and visible above the composer: Frame → Phrases → Example. Optional 15–30 s
  planning timer before speaking.
- Opening help is recorded so cued answers are not counted as independent evidence.
- Acceptance: help is shown instantly (already prefetched) for at least 9 of 10 questions.

**F7. Stuck rescue** `[ ]`
- "Stuck" button (and keyboard shortcut) while speaking: transcribes what has been said so far and
  suggests the next step in English — a connector, a sentence start, or a simpler way to say the
  idea ("say it simpler") — without ending the turn.
- "Missing word": the user describes the word in English ("the thing that stores data
  temporarily…") and gets candidate words to choose from. Practice stays in English.
- Rescue use is recorded as a cue, like guided help.
- Acceptance: a stuck moment can be resolved in under 10 s without leaving the chat.

**F8. Topics, profile, and time-based sessions** `[ ]`
- Topic picker: work and technology, daily life, opinions and debates, plans and stories, job
  interview (HR, behavioural, technical). Free topic is also possible.
- A short personal profile (role, stack, interests, goals) feeds topic questions and the STT
  glossary.
- Session goal by time (e.g. 10 minutes) instead of a fixed number of answers; the AI varies
  question types: describe, explain, compare, give an opinion, tell a story, disagree politely.
- Acceptance: three sessions on different topics feel relevant to the user's real life and work.

### Stage 3 — Remember and review

**F9. Session wrap-up** `[ ]`
- At the end of a session, generate (in the background) up to three phrases worth learning and up
  to two recurring mistakes, with examples taken from the user's own answers. Save to Memory in one
  action.
- Local fluency numbers for the session: speaking time, words per minute, average answer length.
  Presented as personal trends, never as CEFR levels.

**F10. Spoken phrase review** `[ ]`
- Due phrases return as short spoken tasks: the AI gives a situation, the user answers using the
  phrase. Optional shadowing: listen to an AI sentence and repeat it.
- Due phrases are also woven into topic questions (existing learning-target context).
- Freeze the existing usage-review/mastery-streak machinery: keep it working, do not extend it
  until the core loop is fast and used daily.

### MVP acceptance

The user practises for at least 10 minutes on five different days within two weeks using only
F1–F10, and reports that answers are easier to structure than in the first alpha.

## Architecture and code-quality work

Done as part of the feature that touches the code, not as separate commits.

| Item | When |
| :--- | :--- |
| Features `coach` and `practice` import each other (violates the one-way rule in `CODE_REQUIREMENTS.md`); `src/context` imports features. | F5 |
| Session, database and validation errors are all returned as `ProviderError`; add typed `SessionError` / `PersistenceError` kinds across IPC. | F1 or F5 |
| No pipeline integration test (`src-tauri/tests/`) and no Playwright `e2e/` yet; both are described as targets in `CODE_REQUIREMENTS.md`. | F1 adds the pipeline test against a fake streaming provider; e2e after F5 stabilises the Talk screen |
| Conversation and STT processes poll `try_wait` every 50 ms and restart on every turn; long-lived workers and HTTP streaming remove this. | F1, F3 |
| Seven Biome complexity warnings (e.g. `buildDialogueMessages`). | Whichever feature edits the file |

## After MVP

Ordered by expected value; revisit with real usage data before starting any of them.

1. **Avatar.** A 2D character with state animation driven by real audio amplitude, then a 3D
   avatar (e.g. VRM with viseme lip-sync). Real lip-sync needs TTS audio the app can analyse, so it
   likely comes with a neural local TTS (e.g. Kokoro) instead of the Web Speech API.
2. **Natural voice.** Neural TTS (local or API) with a voice the user enjoys listening to.
3. **Interview packs.** Structured mock interviews with the same Talk screen.
4. **Progress view.** Weekly trends of speaking time, words per minute, pauses and saved phrases,
   with examples from real answers.
5. **Quick practice from the menu bar** and opt-in reminders with quiet hours.
6. **Windows build.** Tauri, whisper.cpp, WebView2 speech synthesis, the Gemini API and the encrypted
   key file all work on Windows; Apple Foundation Models does not, so Gemini is
   the conversation provider there. Needs a Windows CI job and installer.
7. **Pronunciation.** Shadowing feedback and, later, phoneme-level scoring. WidgetKit and
   gamification only if they increase how often the user speaks.

## Removed from the plan

The previous phase plan (Phases 0–9), the duplicated screen inventory, the dated pass logs, the
Interview/Drills/Progress prototype screens as near-term work, the ambient scheduler, companion XP,
the five-dimension benchmark, and WidgetKit as MVP requirements. History stays in git and in
[`PERSONAL_ALPHA_FEEDBACK.md`](PERSONAL_ALPHA_FEEDBACK.md).
