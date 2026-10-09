# Roadmap: English Trainer

Updated 2026-10-08. Plan after F5: F3 is next, then F8 (with topics), F11, F12 and F13.

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
| Gemini API use (2026-10-08) | The Gemini API free tier is used only for conversation. Coaching and every other AI side task go to Antigravity pinned to a Gemini model (batched) or to on-device Apple / macOS frameworks. Settings > Usage shows locally counted requests and the last limit errors, because neither API reports the remaining quota. |
| Conversation provider | Two streaming adapters behind one interface: **Apple Foundation Models** (on-device, free, private; measured 1.6 s warm / 4.6 s cold for a whole non-streamed reply on 2026-10-06) and the **Gemini API** (Flash / Flash-Lite, API key from Google AI Studio). The default is chosen by measured time to first spoken word. |
| Coaching, planning and wrap-up | Coaching runs through Antigravity CLI with `gemini-3.8-flash-medium`, in batches of up to five answers (decided 2026-10-08 from a measurement on 66 real answers: Apple on-device rewrites whole answers, "corrects" recognition artefacts or finds nothing; one `agy` call per answer exhausted the Antigravity quota after about 54 calls; the Gemini API free quota is reserved for conversation). Planning (F6) stays on the Gemini API. |
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

**F3. Accurate speech recognition** `[ ]` (part 1 built 2026-10-08: tools to choose the model and the glossary; part 2 built 2026-10-09; both await a check in the app on a physical Mac)
- **Part 1 (built, awaiting a check in the app on a physical Mac).** Settings > Speech recognition: the
  speech check (12 fixed sentences read aloud, kept in `<app data>/speech-check/` as the learner's own
  test set, "Delete recordings" removes them), measurement of every `ggml-*.bin` model in
  `<app data>/models/` (term accuracy over the glossary, word error rate, median and slowest time,
  each transcript beside its sentence; optionally also with the glossary as initial prompt), and a
  Model select whose choice is stored and used by transcription (default `ggml-base.en.bin`;
  `ENG_TRAINER_WHISPER_MODEL` still wins). Settings > Personalisation: the editable personal
  glossary, seeded once with 27 words. Settings > Privacy: the "Keep raw audio" switch (off by
  default) with "Delete kept recordings". The glossary does not yet reach the live transcription:
  that is part 2.
- **Part 2 (built 2026-10-09, awaiting a check in the app on a physical Mac).** Decision from the
  measurements below: `small.en` is the default model when installed (base.en otherwise; a model
  the learner chose is never replaced). A `whisper-server` child keeps the model loaded (started
  when a practice session opens, restarted once if it dies, replaced on a model change, stopped on
  exit; falls back to `whisper-cli`, and Setup details say so). Every answer carries an initial
  prompt: the question being answered, names from the last answers, the glossary (500 characters at
  most). A live transcript (dashed bubble, caret, "Live transcript") re-transcribes the audio so
  far every 1.5 s while the learner speaks, only with base/small models and a ready server;
  the final transcription is unchanged. Settings > Speech recognition shows "Kept loaded · ready" /
  "Loading…" / "Not running (using one-off runs)" and a Live transcript switch (on by default).
  Not done: the live bubble for the spoken Memory review answer (it still shows the result after
  the answer).
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
  while the learner answers a situation; today it shows the result only after the answer.
- Acceptance: a fixed list of 30 of the user's technical terms is recognised in at least 90% of
  readings; transcription of a 15 s answer finishes in under 1.5 s.

**F4. Speak while generating + voice visual** `[ ]`
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
- Acceptance: end-of-speech → first AI audio under 2.5 s median over 10 turns.

### Stage 2 — Help to structure spoken answers

**F5. One Talk screen with inline coaching** `[ ]`
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
- Built (still `[ ]` until accepted in the built app on a physical Mac): one Talk mode and route
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

**F6. Answer planner** `[ ]`
- When the AI asks a question, prefetch in the background a short plan for answering it: a
  three-step frame suited to the question type (e.g. point–reason–example, past–present–future,
  situation–action–result), three to five useful phrases, and a model answer kept hidden by default.
- Help is graduated and visible above the composer: Frame → Phrases → Example. Optional 15–30 s
  planning timer before speaking.
- Opening help is recorded so cued answers are not counted as independent evidence. Per-answer help
  use is already recorded (`record_answer_help_used`, shown as "used help" in the dialogue); F6
  should use it to exclude cued answers from independent evidence.
- Design: the help chips are numbered "1 Frame · 2 Phrases · 3 Example"; Frame adds "Plan first:
  15 s / 30 s". Example shows the prefetched model answer at once with "Model answer — try your own
  version after reading", Play and "Hide before speaking" (replacing today's request-then-adapt flow).
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
- Acceptance: three sessions on different topics feel relevant to the user's real life and work.

### Stage 3 — Remember and review

**F9. Session wrap-up** `[ ]`
- At the end of a session, generate (in the background) up to three phrases worth learning and up
  to two recurring mistakes, with examples taken from the user's own answers. Save to Memory in one
  action.
- Local fluency numbers for the session: speaking time, words per minute, average answer length.
  Presented as personal trends, never as CEFR levels.
- Built with the wrap-up screen (design `Wrapup`): the numbers with trends against the last
  session, up to three phrase cards from the session's coaching, recurring mistakes, and
  "Save all to Memory" with Undo. Since F5 the lists fill from the background coaching of every
  answer, and the screen says "Still checking N answers…" while the last batch runs. What is
  still open for F9: F9 generates phrases and recurring mistakes in the background for every session, with
  a short note per phrase ("The word you were looking for: normalise.") instead of the quoted
  original, and may offer the recurring mistakes themselves as savable items.
- Design: the Memory footer reads "Mistakes that come up twice are added for you". Today every
  mistake Eva's notes point out is added on first sight; "twice" needs the recurring detection above.

**F10. Spoken phrase review** `[ ]`
- Due phrases return as short spoken tasks: the AI gives a situation, the user answers using the
  phrase. Optional shadowing: listen to an AI sentence and repeat it.
- Due phrases are also woven into topic questions (existing learning-target context).
- Optional two-minute spoken warm-up with due phrases before a session, chosen on the start
  screen.
- Freeze the existing usage-review/mastery-streak machinery: keep it working, do not extend it
  until the core loop is fast and used daily.
- Design: the start-screen review card offers "A 2-minute spoken warm-up before you start" with a
  Before session / Skip today toggle.
- Design (spoken review, built on the existing recall run): Eva reads the situation and the learner
  answers by voice; the result shows "Used it" or "Not yet" with the wording marked in the answer,
  Try again, Skip, Next and Finish, progress pips and the end summary with each new status. What it
  still lacks for F10: (1) a situation written for the phrase: the cue is the saved note (a
  mistake's cue is the sentence as first said), so Eva reads that; (2) the banner "Use this phrase
  X" shows the wording before the answer: the run keeps the wording hidden until the answer is
  saved, so it is recall, and showing it would make the answer cued; F10 decides whether a cued
  mode exists, and it must not count as independent use; (3) a model answer for "With the phrase":
  today it is the wording itself (for a mistake, the corrected sentence), not a sentence written
  around it; (4) runs of six items ("N of 6", "about 3 minutes"): a run holds three. Decided
  2026-10-07: Try again in the review stays practice only; the first answer is the scored one.

### Stage 4 — Plan of 2026-10-08 (after F3 and F8)

**F11. Write it, then say it** `[ ]` (the learner's idea)
- A text chat with Eva on a topic; also available as a standalone "text chat" mode for social
  practice.
- After writing, the learner first reviews the corrections of what they wrote and repeats them. On
  "Ready to speak" the same conversation runs by voice. Afterwards the corrections of the spoken
  answers are reviewed again, with the aim of fewer mistakes than in writing.
- A mistake that repeats several times goes into the spoken review (F10).
- Coaching goes through Antigravity (Gemini, batched) like F5; the Gemini API is not used for it.

**F12. Practice my usual mistakes** `[ ]`
- From the recurring mistakes in Memory (for example "the most part of" → "most of", "Just I want"
  → "I just want", "in the university" → "at university"), Eva asks about five short spoken
  questions that need the right form. About two minutes.

**F13. Translate a word** `[ ]`
- Select a word in Talk, in notes or in Memory to see its translation into the native language
  chosen in Settings (Russian for this user) next to a simple English explanation.
- The translation uses the on-device macOS Translation framework, never the Gemini API. An approved,
  on-demand exception to "practice content is English only" (see `PRODUCT_SPEC.md`).

### MVP acceptance

The user practises for at least 10 minutes on five different days within two weeks using only
F1–F10, and reports that answers are easier to structure than in the first alpha.

## Architecture and code-quality work

Done as part of the feature that touches the code, not as separate commits.

| Item | When |
| :--- | :--- |
| `src/context` imports features (types only). The `coach ↔ practice` import cycle was removed in F5. | Later |
| Session, database and validation errors are all returned as `ProviderError`; add typed `SessionError` / `PersistenceError` kinds across IPC. | F1 or F5 |
| No pipeline integration test (`src-tauri/tests/`) and no Playwright `e2e/` yet; both are described as targets in `CODE_REQUIREMENTS.md`. | F1 adds the pipeline test against a fake streaming provider; e2e after F5 stabilises the Talk screen |
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
