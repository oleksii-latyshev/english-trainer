# Technical Requirements

Contracts the code must keep. Product behaviour: [PRODUCT_SPEC.md](PRODUCT_SPEC.md). Structure:
[ARCHITECTURE.md](ARCHITECTURE.md). Coding conventions: [CODE_REQUIREMENTS.md](../CODE_REQUIREMENTS.md).

## 1. Platform and stack

| Area | Choice |
| :--- | :--- |
| OS | macOS 14+, Apple Silicon. Apple Foundation Models and `apple-translation` need macOS 26+ (Apple Intelligence for the model). |
| Desktop | Tauri v2, Rust stable, SQLite via `rusqlite` (bundled). |
| Frontend | React 19, TypeScript (strict), Vite, Bun, Tailwind CSS v4, Base UI (own kit in `src/shared/ui`), TanStack Router, Lucide. |
| Quality | Biome, `tsc --noEmit`, `bun test`, rustfmt, Clippy with warnings as errors, `cargo test`; run by Lefthook pre-commit and GitHub Actions CI. |
| Packaging | `bun run build:desktop` → ad-hoc signed `.app` and DMG; the Apple helpers are compiled at build time and bundled. |

## 2. Audio capture

- Web Audio / AudioWorklet: mono, 16-bit PCM, normalised to 16 kHz, WAV in memory. Never rely on
  `MediaRecorder` formats.
- `echoCancellation`, `noiseSuppression`, `autoGainControl` default to `false` (best effort).
  Opt-in voice interruption requests `echoCancellation: { ideal: true }` on the warm practice stream
  only; changing the preference reopens that stream. Voice interruption requires actual
  `track.getSettings().echoCancellation === true` and 300 ms sustained voice onset; otherwise only
  manual interruption. Playback and TTS stop before capture.
- An explicit device uses `deviceId: { exact: id }`; a missing device is a recoverable error, never a
  silent fallback. The device ID is a local WebView preference; the actual label is read from the
  acquired track. Enumerating devices never starts capture.
- **Microphone session:** one open stream, `AudioContext` and worklet. Warm-up once at open (three
  seconds of frames); the session times out after 8 s without readiness and releases the device.
  Frames keep feeding a 300 ms pre-roll ring buffer, a live level and a noise-floor estimate. A
  capture may start before warm-up finished and returns 16 kHz mono WAV plus a signal summary.
- Practice keeps one warm session while a session is active; it is released on finish, unmount,
  device loss or "Pause mic" and reopened when the preferred device changes. Without a session
  (recall drill, Settings test) one is opened, warmed, used and released on the same code path.
- Pre-roll is 300 ms for a manual press, 0 when the assistant was speaking at the press and 0 for
  auto-listening, so the assistant's voice is not captured. Request-to-capture latency is shown as
  "Mic Start".
- **Turn detection** is energy based with an adaptive noise floor. A turn needs about 300 ms of
  speech and ends after the configured pause (default 1.5 s, range 1.0-3.0 s). Auto-listening with no
  speech for 20 s cancels to idle. Esc cancels without sending. "Keep listening" holds the turn open.
- **Flow preferences** (localStorage): auto-listen (on), hands-free turn end (on), end-of-turn pause
  (1500 ms), auto-send of voice answers (on), edit window before sending (2000 ms, 0-5000 ms).
  Editing the draft stops the countdown; an unedited auto-sent transcript is still `voice`. Auto-listen
  runs only after the AI reply finished speaking, on the Conversation screen.
- **Settings microphone check:** same recorder, stops after 10 s, local playback and discard only,
  shows per-second amplitude, captured vs elapsed duration and reported processing flags. It never
  transcribes, calls a provider or saves audio. Device changes and checks are blocked while practice
  capture is active.

## 3. Speech recognition

- `transcribe_audio` receives raw WAV bytes; Rust validates RIFF/WAVE, mono, 16-bit, 16 kHz, at most
  60 MB.
- **Model:** `<app data>/models/<model_file>`, chosen in Settings (any plain `ggml-*.bin` name,
  never a path). With no choice stored (`speech_settings.model_file` empty) Rust resolves
  `ggml-small.en.bin` if installed, else `ggml-base.en.bin` (`SpeechSettings::resolved`).
  `ENG_TRAINER_WHISPER_MODEL` overrides the choice and Settings says so. `small.en` is the default
  by measurement (91% of glossary terms recognised vs 74% for base.en; `large-v3-turbo-q5_0` has
  lower word error but 1.15 s vs 0.32 s median per answer).
- **Loaded server (`speech_recognition/infra/whisper_server.rs`):** one `whisper-server` child per app run. Resolved like
  `whisper-cli` (`ENG_TRAINER_WHISPER_SERVER_BIN`, `PATH`, Homebrew paths); started with
  `-m <model> --host 127.0.0.1 --port <free port>` on session open, unfinished spoken Memory review
  open (`warm_speech_engine`, never opens the microphone or blocks recording), model change or first
  transcription. Transcription is multipart `POST /inference` (`file`, `prompt`, `language=en`,
  `response_format=json`) with the blocking `reqwest` client (no proxy). A dead server is restarted
  once; after two deaths with no answer in between, or if it cannot start, it is not started again
  for that model until the model changes or the next session opens, and calls fall back to
  `whisper-cli`. The child is stopped on `RunEvent::Exit` and drop; its pid is noted in
  `<app data>/whisper-server.pid` so a server from a crashed run is stopped first.
  `get_speech_engine_status` feeds Settings ("Kept loaded · ready", "Loading…", "Not running (using
  one-off runs)") and a Whisper server line in setup details.
- **Fallback:** `whisper-cli` (`ENG_TRAINER_WHISPER_BIN`, `PATH`, Homebrew paths) in a private temp
  dir, 120 s timeout. Typed `TranscriptionError` codes: `model_missing`, `engine_missing`,
  `engine_failed`, `timeout`, `invalid_audio`, `invalid_output`, `no_speech`, `io_failure`, `busy`.
  A silent recording is `no_speech` on either path and is not retried on the other.
- **Initial prompt (`audio/prompt.rs`):** `<question> Vocabulary: <names from the last three
  answers>, <glossary>.`, at most 500 characters (question cut at a word after 160; session names
  first). Names are words with a capital inside a sentence or inside the word (`CS2`, `TypeScript`)
  not in the glossary. Outside a session it is the glossary alone.
- **Live transcript:** while a Talk or spoken Memory review answer is recorded, the UI calls
  `transcribe_partial` every 1.5 s with a WAV of the audio so far (at most 30 s; capture is not
  interrupted). Rust runs it only if the setting is on, the model is tiny, base or small, and the
  server is ready; it never starts a server, handles one update at a time, gives up after 5 s and
  returns nothing otherwise. Partial audio is not kept. Live text never submits an answer or changes a
  schedule; stop, cancel, skip, end, device loss and unmount dispose updates and late replies cannot
  enter a newer capture. Failures never block the final transcription, which is authoritative.
- **Speech check** (`speech_recognition/domain/speech_check.rs`): 12 fixed sentences read in Settings, stored as `NN.wav`
  (16 kHz mono) and `NN.txt` in `<app data>/speech-check/` (owner-only; "Delete recordings" removes
  the folder and measurements). Measuring runs the app's `whisper-cli` call per chosen model (and
  optionally with `--prompt "Vocabulary: <glossary>."`, at most 500 characters), off the UI thread,
  one at a time. It stores term accuracy (glossary terms as whole words, ignoring case, tolerant of
  spacing and small number words), pooled word error rate on normalised words, median and slowest
  time (whole process) and every transcript, in `speech-check/results.json`. Scoring: `audio/scoring.rs`.
- Recognition uncertainty is never presented as a pronunciation or knowledge error.

## 4. Speech output

- **Natural voice (default):** local Supertonic 3 INT8 in one persistent bundled helper, prewarmed
  outside conversation turns. `prewarm_natural_voice() -> bool`; `synthesize_natural_voice(text,
  voice_id, speed) -> binary PCM WAV` accepts nonempty text ≤ 4096 bytes, voice IDs 0–9 and a finite
  rate 0.85–1.2. Failures are `IpcError` with `unavailable | busy | invalid_request | timeout |
  process_failed`. WAV frames ≤ 60 s. The inference deadline is 750 ms plus 25 ms per character
  (cap 6 s), after which the helper is killed and recovered. A busy engine never queues. Generated
  audio is never retained or sent anywhere.
- Each stream freezes voice and rate and plays phrases back to back. Sentences are the unit; a
  sentence is cut only when it is longer than the budget, at a clause boundary (`, ; :` or before
  `and but because so which when`), never leaving a trailing fragment under 16 characters. The first
  phrase of a reply is at most 40 characters so that first audio does not wait for a long
  synthesis. Every later phrase is rendered as soon as it is available, without waiting for the
  current phrase to start, and is sized from the audio already queued (the lead) and the measured
  synthesis speed so that it is ready before the lead runs out (at most 120 characters, up to 24
  more to reach a clause boundary). Rendering pauses while more than 6 s of audio is queued. Rust
  trims model padding in 10 ms RMS windows at 0.003 (−50 dBFS), keeping 40 ms before and 15 ms
  after speech (the model's tail after the last word is a low-level creak, so it is not kept), with
  equal-power fades of 20 ms in and 30 ms out, so a join inside a sentence leaves about 60 ms of silence and no clip ends on a hard
  edge; between sentences the frontend adds a 150 ms pause. Phrases are scheduled on one audio clock (Web Audio) created at the
  model's 44.1 kHz so WebKit never resamples; a phrase starts exactly where the previous one ends.
- **Fallback:** `whisper-cli` (`ENG_TRAINER_WHISPER_BIN`, `PATH`, Homebrew paths) in a private temp
  dir, 120 s timeout. Typed `TranscriptionError` codes: `model_missing`, `engine_missing`,
  `engine_failed`, `timeout`, `invalid_audio`, `invalid_output`, `no_speech`, `io_failure`, `busy`.
  A silent recording is `no_speech` on either path and is not retried on the other.
- **Initial prompt (`audio/prompt.rs`):** `<question> Vocabulary: <names from the last three
  answers>, <glossary>.`, at most 500 characters (question cut at a word after 160; session names
  first). Names are words with a capital inside a sentence or inside the word (`CS2`, `TypeScript`)
  not in the glossary. Outside a session it is the glossary alone.
- **Live transcript:** while a Talk or spoken Memory review answer is recorded, the UI calls
  `transcribe_partial` every 1.5 s with a WAV of the audio so far (at most 30 s; capture is not
  interrupted). Rust runs it only if the setting is on, the model is tiny, base or small, and the
  server is ready; it never starts a server, handles one update at a time, gives up after 5 s and
  returns nothing otherwise. Partial audio is not kept. Live text never submits an answer or changes a
  schedule; stop, cancel, skip, end, device loss and unmount dispose updates and late replies cannot
  enter a newer capture. Failures never block the final transcription, which is authoritative.
- **Speech check** (`speech_recognition/domain/speech_check.rs`): 12 fixed sentences read in Settings, stored as `NN.wav`
  (16 kHz mono) and `NN.txt` in `<app data>/speech-check/` (owner-only; "Delete recordings" removes
  the folder and measurements). Measuring runs the app's `whisper-cli` call per chosen model (and
  optionally with `--prompt "Vocabulary: <glossary>."`, at most 500 characters), off the UI thread,
  one at a time. It stores term accuracy (glossary terms as whole words, ignoring case, tolerant of
  spacing and small number words), pooled word error rate on normalised words, median and slowest
  time (whole process) and every transcript, in `speech-check/results.json`. Scoring: `audio/scoring.rs`.
- Recognition uncertainty is never presented as a pronunciation or knowledge error.

## 4. Speech output

- **Natural voice (default):** local Supertonic 3 INT8 in one persistent bundled helper, prewarmed
  outside conversation turns. `prewarm_natural_voice() -> bool`; `synthesize_natural_voice(text,
  voice_id, speed) -> binary PCM WAV` accepts nonempty text ≤ 4096 bytes, voice IDs 0–9 and a finite
  rate 0.85–1.2. `VoiceError.code`: `unavailable | busy | invalid_input | timeout | process_failed`.
  WAV frames ≤ 60 s; inference deadline 750 ms, after which the helper is killed and recovered. A
  busy engine never queues. Generated audio is never retained or sent anywhere.
- Each stream freezes voice and rate, splits phrases at clause/word boundaries to ≤ 48 characters
  (a single oversized token stays whole), renders one phrase ahead and plays serially. Rust trims
  model padding in 10 ms RMS windows at 0.0002, keeping 50 ms before and 120 ms after speech;
  mid-phrase pauses stay.
- **Fallback:** an unavailable or loading engine uses system speech. A busy engine is retried every
  40 ms inside the guard. A phrase that is not rendered within its guard (800 ms for the first
  phrase; the audio already queued plus 400 ms for later ones), or fails, switches the rest of the
  stream to system speech, which starts after the queued natural audio has ended. One background
  warm-up retries for later turns; if it fails, Settings offers Retry. Late audio after cancel or
  unmount never plays. First audio = media `playing`; completion = final `ended`.
- **System voices** (`speechSynthesis`) stay selectable: non-novelty English voices first, Premium →
  Enhanced → standard, US → UK → other English, stable order; an explicit saved choice wins.
  Adjustable rate; pause, resume, stop, replay. Engine choice and natural voice ID are UI
  preferences, separate from the system voice URI and rate.
- A new recording or AI turn cancels speech.
- Streaming: `beginStream` queues completed English sentences serially, buffering partial words,
  abbreviations, decimals and quotation marks. `finish` adds the unspoken tail once; providers
  without deltas speak the final reply once. Cancel, replacement and unmount invalidate playback
  callbacks. Auto-listening starts only after provider finish and the final speech end, never
  between sentences or after playback failure.
- `cancel_practice_reply(session_id) -> bool` atomically invalidates the pending turn before
  persistence. `ProviderError.code = cancelled` is recoverable; committed turns stay saved. Apple
  cancellation kills/restarts the helper; Gemini cancellation releases the caller promptly and drops
  the stream receiver; legacy CLI calls stay bounded and cancelled results cannot commit.
- Mic/Space, "Speak anyway" while thinking, and Esc interrupt playback and pending generation. Manual
  interruption excludes assistant audio from pre-roll; echo-cancellation-gated voice interruption
  keeps 300 ms. Delayed cancellation cannot restart capture after navigation.
- The timing panel records first text, provider completion, send → utterance start, speech-end →
  utterance start (voice answers) and TTS start. Eva's listening visual follows microphone level;
  speaking follows TTS events. Reduced-motion keeps visuals static.

## 5. Conversation providers

### 5.1 Contract

- `ConversationContext`: `opening_question`; up to 20 `recent_turns` (learner, assistant reply,
  assistant question); `latest_transcript` (1-4,000 characters); up to 2 `learning_targets`;
  `earlier_answers` (older learner answers, each cut to about 160 characters at a word boundary);
  `asked_questions` (40 most recent, each at most 200 characters; the prompt forbids repeating
  them). One builder serves every turn. Total at most 24,000 characters; over budget, drop condensed
  answers first (oldest first), then oldest turns, then oldest asked questions. Latest transcript,
  opening question and targets are always kept. Each provider compacts its own copy
  (`ConversationContext::compact`): Apple gets the last 6 turns, at most 3,500 characters, 10
  asked questions and no condensed answers; legacy `agy` gets 8 turns and 8,000 characters.
- `ConversationTurn`: `spoken_reply`, `question` (nullable), `provider_latency_ms`, `first_token_ms`,
  `answered_by` (`{ provider: gemini | apple | agy, model, is_backup }`). `agy` returns a
  schema-validated pair (reply ≤ 30 words, question ≤ 20 words; the reply limit depends on style);
  Gemini and Apple return plain text.
- **Settings** (`ai_settings`): provider `gemini | apple | agy` (default `gemini`); `agy_model`
  `default | gemini-3.8-flash-low | gemini-3.8-flash-high`; `eva_style` `short_and_simple | natural`
  (default `natural`; older rows read as `natural`). Model IDs already encode effort; never also pass
  `--effort`.
- **Eva's style** (`ConversationContext.eva_style`, set from saved settings, never serialised into
  model data): `short_and_simple` is one or two short sentences of simple English; `natural` is two
  to four sentences of B2 everyday English with varied reactions, light humour, a short opinion and
  sometimes a deeper follow-up. Both end with exactly one question and give no corrections. Gemini
  `maxOutputTokens` 220, reply cap 520 characters; `agy` `natural` allows 400 characters / 70 words.
- **Streaming:** `send_practice_turn` and `generate_follow_up` take a Tauri `Channel` receiving
  `{ kind: "delta", text }` chunks and still return the final `ConversationTurn`. `agy` sends its
  whole reply as one delta at the end.
- **Plain-text shaping** (`providers/reply_text.rs`, Gemini and Apple): strip markdown, collapse
  whitespace, cap at about 350 characters at a sentence boundary, split off the final sentence ending
  in `?` as `question`. Without one, the whole text is `spoken_reply`, `question` is `null`, and that
  reply is the prompt the learner answers next. Only empty output is an error.
- The answer is saved only after a complete reply; on failure nothing is saved, the session leaves
  `in_flight` and the answer stays editable. Generation runs outside the session mutex. At most one
  in-flight provider request per session; duplicate or stale submissions are rejected.
- **`agy` conversation:** `--print --json-schema --sandbox --disable-slash-commands`, a log file, a
  private temp dir. Two attempts share one 45 s budget. Invalid output returns a typed error with
  `reply_stage` (`envelope`, `schema`, `content`); invalid output is never stored.
- **Apple helper:** one bundled process per app run, started lazily or by
  `prewarm_conversation_provider`; JSON lines (`{id, instructions, prompt}` in; `delta`, `done`,
  `error` out), `streamResponse`. One request at a time, 20 s timeout, restarted once if it died
  before replying. Unavailability maps to typed `unavailable` errors. Apple as the selected provider
  never falls back to another provider.
- **Gemini API:** `streamGenerateContent?alt=sse` over HTTPS (blocking `reqwest` in
  `spawn_blocking`, shared client), 5 s connect / 20 s total timeout, thinking level `minimal`,
  conversation model `gemini-3.5-flash-lite` (tier constant in the adapter). `gemini-3.5-flash` is
  not a fallback (free tier: 20 requests a day). Errors: `unauthorized` (401, 403, 400
  `API_KEY_INVALID`), `rate_limited` (429), `unavailable` (5xx, network), `timeout`, `invalid_output`
  (empty text, blocked prompt).
- **Backup race** (`providers/race.rs`): the Apple model starts when Gemini fails with 429, 5xx or a
  network error, ends with no text, or has produced no text after 2 s. The first stream with text
  wins and the other is dropped; if both fail the Gemini error is reported. Configuration errors
  (`unauthorized`, invalid request) get no backup reply. The origin is stored per turn
  (`turns.answered_by_provider`, `answered_by_model`, `answered_by_backup`; older turns null), returned
  on each `PracticeDialogue` turn and shown under Eva's messages and in "Test AI response".
- **Gemini key:** stored in `<app data>/gemini-api-key.enc` (mode 0600, written via temp file and
  rename): version byte, 12-byte nonce, ChaCha20-Poly1305 ciphertext; key = SHA-256 of a fixed
  context string and the OS machine ID (`machine-uid`). This protects against backups, synced
  folders and copied data folders, not against software running as the user. No OS credential
  prompt. The format, file name and secret derivation are frozen: files written by earlier
  releases must keep decrypting. A file that does not decrypt is `unauthorized` with a request to paste the key again.
  `ENG_TRAINER_GEMINI_API_KEY` overrides it. Read once per run, kept in memory, sent only in the
  `x-goog-api-key` header, never returned to the UI, logged, put in a URL or in an error. Commands:
  `get_gemini_key_status` (`{ configured, source: settings | environment | null }`),
  `save_gemini_api_key`, `delete_gemini_api_key`.
- Call sites choose tiers: `conversation` (fast) and `coaching` (background, batched, `agy`
  `gemini-3.8-flash-medium`; the Gemini API is never used for coaching).

## 6. Coaching, help and review providers

All `agy` calls below pin a Gemini model, run in a private scratch directory and count against API
usage (§10). Where the CLI `--json-schema` flag is omitted, the schema is sent in the prompt because
installed CLI schema output can be empty, and the JSON in `response` is validated locally.

### 6.1 Coaching

- **Queue** (`conversation/coaching_queue.rs`): derived from SQLite: answers without a
  `turn_feedback` row and with fewer than 2 failed attempts (`coaching_failures`), so a restart
  resumes it. One worker, one batch at a time. A batch of the oldest waiting answers (at most 5)
  starts when 5 wait, on session finish (`flush`), after 60 s of quiet with anything waiting
  (`IDLE_FLUSH`, restarted by every saved answer), or at once for an answer that failed once. A
  failed, empty or invalid batch counts one failed attempt for each answer it missed; an answer with
  2 failed attempts shows "Couldn't check this answer" with manual Retry (`retry_answer_coaching`,
  which also resumes a paused queue).
- **Quota pause:** `RESOURCE_EXHAUSTED` or 429 (agy stderr, stdout or envelope,
  `ProviderErrorCode::RateLimited`) pauses coaching without spending attempts for 30 minutes
  (`QUOTA_PAUSE`, in memory only); then one batch probes, and a limited probe pauses another 30
  minutes. Retry resumes at once. Talking is never blocked.
- Results go through `SessionStore::save_feedback`: the learning engine records one mistake per
  answer (deduplicated by normalised key); typed or edited answers keep their evidence rules. Saving
  works after the session finished. After each batch Rust emits `coaching-updated { session_id }`.
- **Batch call** (`providers/agy/coaching.rs`): one `agy` call, `--model gemini-3.8-flash-medium`,
  170 s process budget. Batches of 5 were chosen by measurement (median about 40 s per batch; one
  answer per call exhausted the quota after about 54 calls). The prompt ("do not use any tools or
  commands") gets `{ n: sequence, question, transcript }` per answer; the schema returns
  `answers[{ n, mistakes[0..2]{ original, improved, explanation, category }, rewrite }]`, read from
  `structured_output` (object or text; `response` text is the fallback). Each answer is validated
  alone: rewrite is plain text of at most 600 characters; the first mistake whose quote occurs in the
  transcript, with texts in bounds and a different `improved`, becomes the single focus point
  (`TurnFeedback.focus_feedback` has at most one). A bad entry costs only its own answer.
- `get_practice_dialogue` returns `coaching[]` per turn: `{ state: pending | paused | failed }` or
  `{ state: ready, feedback }`. `get_session_wrapup(session_id)` rebuilds a finished session's
  wrap-up; `FinishedPracticeSession` has `pending_coaching` and `is_coaching_paused`.
  `retry_practice_turn` saves a second attempt and returns a local `AttemptComparison`
  (`target_evidence`: `already_present_in_both | newly_observed_in_retry | partially_observed |
  not_observed | uncertain`, word-count change).

### 6.2 Session wrap-up (F9)

- `FinishedPracticeSession.wrapup_preparation` is `{ state: legacy | pending | ready }` or
  `{ state: failed, error: ProviderError }`. Finish atomically creates a `session_wrapups` row; empty
  sessions are ready with no phrases. A worker resumes pending jobs at startup and snapshots up to 24
  answers (1,500 characters each, 12,000 total) with their original questions. No session lock is
  held during generation.
- `SessionWrapupEngine` returns zero to three English phrases: `gemini-3.8-flash-high`, 85 s CLI /
  90 s process bound, one call, no automatic retry, schema in the prompt. Strict validation: sequence
  provenance, exact quote substrings, unique normalised phrases, English plain text, bounded
  phrases/notes/quotes; a note cannot simply copy the quote.
- Results or typed failures persist before `wrapup-updated { session_id }`. The UI subscribes before
  re-reading. `retry_session_wrapup(sessionId)` starts only failed or legacy finished sessions.
  `get_session_wrapup` keeps the cached snapshot; already saved phrases are excluded at completion.
- `save_wrapup_phrases(sessionId, phrases)` takes one to three exact cached suggestions, saves all
  transactionally and returns `{ cards, created_ids }`. Undo uses only the new IDs; existing
  duplicate cards and notes are preserved.

### 6.3 Answer help (F6)

- `get_guided_answer(session_id, sequence, question)` → `{ model_answer, adaptation }` for the active
  unanswered prompt only; Rust checks session, sequence and exact question. The cue exposure is saved
  **before** generation; a stale result cannot help another turn; failure does not change the session.
- `prefetch_answer_plan(session_id, sequence, question, retry?)` (snake-case arguments) returns
  `{ frame[3], phrases[3..5], model_answer, adaptation }` for the active unanswered spoken question.
  Gemini receives only that question, uses JSON-schema output and the usage tracker. Every field is
  validated: plain English, bounded, at most 60 words per field, complete model answer, bracketed
  adaptation slots. Response bounded to 16 KB; invalid output is a recoverable typed error.
- One in-memory question cache (including failures) behind its own mutex. Concurrent prefetches
  coalesce; a failed plan is regenerated only on explicit Retry. Session, phase, sequence and exact
  question are checked before and after preparation. No session lock during generation.
- Prefetch writes no help exposure. Opening Frame, Phrases or Example first awaits the per-answer cue
  write; if it fails, help stays hidden with a recovery notice. The cue persists in SQLite and
  excludes only that answer from independent spoken usage review.
- H opens Frame; 1/2/3 select Frame/Phrases/Example. Example supports Play and Hide and closes on
  capture. The optional Frame timer uses a 15 or 30 s deadline, cancels on capture, closure or
  question change, suppresses auto-listening without releasing the microphone and never starts
  capture. Missing keys, quotas and invalid plans leave answering usable.

### 6.4 Stuck rescue (F7)

- `transcribe_rescue` receives a raw WAV snapshot (React copies the newest 15 s) and positive
  `x-session-id` / `x-answer-sequence` headers. Rust validates the active unanswered spoken question
  before and after local STT. The loaded server has a 3 s attempt bound including waiting for a live
  update; no server restart, final-transcription fallback, audio retention or live-setting change.
  Busy, unready and no-speech states offer recovery while recording continues.
- `rescue_answer(session_id, sequence, request)` (snake-case) with request
  `{ kind: next_step | simpler | missing_word, question, partial_transcript, description }`, bounds
  500 / 1500 / 300 characters. Next step and simpler use a fresh snapshot; missing word uses the
  English description alone and works without recognised speech. Rust validates session, phase,
  sequence and exact question, saves the per-answer cue before the provider call and revalidates
  after. A separate concurrency guard never holds the session mutex across generation.
- `RescueEngine`: one `agy` call, `gemini-3.8-flash-high`, 20 s process bound, no automatic retry,
  schema in the prompt. Response is either one plain English suggestion (at most 160 characters / 30
  words) or 3-5 distinct terms of 1-3 words. Unknown fields, wrong variants, translations and markup
  are typed errors. The 20 s bound does not guarantee the under-10-second target; latency is checked
  live, separately from deterministic tests.
- Stuck / S works only during a spoken recording; it ignores text fields, focused controls, IME,
  repeats and modifiers. An open panel suspends hands-free end-of-turn and auto-listen idle expiry;
  dismissal and failure release only its own hold. Stop and Cancel stay usable. Selecting a word
  neither edits nor sends the answer. Late results are discarded by recording identity and question
  scope. Help never plays TTS over the microphone. Cued answers are excluded from independent
  evidence.

## 7. Sessions and input provenance

- One Talk mode with a suggested 5, 10 or 15 minute goal (default 10). Reaching it never finishes the
  session or blocks answers. The eight-answer field remains only for the daily-recall gate. New
  sessions are stored with mode `conversation`; sessions saved as `coach` by older versions read the
  same way. The database mode stays internal; practice modes (§7.1) cross IPC separately.
- `get_practice_dialogue(session_id)` returns `{ session_id, opening_question, turns, input_sources,
  reply_times_ms, answer_durations_ms, help_used, coaching }` for the active session. The three lists
  after `input_sources` align with `turns`: time to Eva's first words (falls back to total provider
  latency; `null` for older turns), spoken answer length (`null` for typed or older answers), and
  whether help was opened. Stored in `turns.reply_ms`, `turns.answer_duration_ms` and
  `answer_help_uses(session_id, sequence)`.
- `send_practice_turn` takes optional `answer_duration_ms` (voice and edited only) and optional
  `input_source` (`voice | edited | text`; omitted means `text`), saved atomically with the answer in
  `turn_input_sources`. Failed provider calls save nothing.
- `record_answer_help_used(session_id, sequence)` is idempotent, rejects other sessions and any
  sequence but the pending answer, and changes no learning or mastery rule.
- Voice auto-send applies only to a new successful transcription and only when enabled. Drafts stay in
  memory; answers are not persisted in the browser.
- **Metadata:** `topic_id`, `topic_label`, nullable `topic_custom`, `duration_goal_seconds`,
  `active_duration_ms`, `started_at`, `is_clock_running`. `start_practice_session` takes optional
  topic/time options validated in Rust; an open session is resumed with its saved options. Topic
  openings are local and vary. `set_practice_clock(session_id, running)` checkpoints a monotonic
  active clock and returns the snapshot. The UI checkpoints every 15 s while Talk is open, pauses on
  leaving Talk or pausing the mic, and extrapolates for display. App exit checkpoints; startup
  restores the clock paused; a crash may lose up to one interval. `FinishedPracticeSession.duration_ms`
  is active time, returned with topic and goal.
- `get_personal_profile` / `save_personal_profile`: optional `role`, `stack`, `interests`, `goals`
  (each at most 150 characters). Profile and topic are delimited data in provider instructions and
  count toward context limits. Profile terms supplement the effective STT glossary without changing
  the editable list.
- Memory phrase records carry optional `session_topic`; the source line shows topic and date when
  provenance exists.

### 7.1 Write, then speak (F11)

- `start_practice_session` also takes `practice_mode`: `voice` (default), `text_chat`,
  `write_then_speak`. Mode, phase and the frozen written-answer count are persisted.
- `PracticeSession` and `FinishedPracticeSession` add `practice_mode`, `practice_phase`,
  `written_turn_count`, `spoken_turn_count`. Phases: `writing`, `writing_review`, `speaking`,
  `speaking_review`; ordinary voice sessions start in `speaking`.
- `transition_practice_phase(session_id, phase)` returns the session. Writing needs at least one
  answer before review; write-then-speak goes writing review → speaking → speaking review after every
  original question was answered aloud. Other transitions, transitions during a pending answer and
  answers during review are rejected.
- Writing uses text input and the conversation provider, with no microphone, auto-listening or TTS.
  Entering review flushes the coaching queue; pending, failed and paused corrections stay visible and
  do not block the transition.
- The spoken stage rehearses the exact original questions in order. Rust derives them from the saved
  conversation and returns a neutral acknowledgement plus the next question with no provider call, and
  asks nothing after the final answer. Rehearsal is cued, not independent mastery evidence.
- Both stages keep absolute answer sequences and input provenance. Review shows written and spoken
  corrections separately; unfinished coaching is never a clean answer or proof of improvement.
  Reviews stop the active clock and release the warm microphone; "Say it again" stays available.
  Restoring a session keeps its phase and next question.

### 7.2 Practice my usual mistakes (F12)

- `start_mistake_practice()` returns a voice/speaking `PracticeSession` with `is_mistake_practice:
  true`, topic label `Usual mistakes` and five target answers. Other sessions return false (frontend
  legacy payloads default to false).
- Targets: non-archived mistakes with `times_seen >= 2`, regardless of due date, in deterministic
  frequency/recency order. An empty pool returns an actionable error without a provider call or
  session.
- One bounded background-tier `agy` call (pinned Gemini model; the Gemini conversation API is not
  used) prepares five distinct English questions. Output must reference known targets, stay bounded
  and not reveal the target wording.
- Generation runs outside the database/session mutex. Concurrent starts are guarded, failure permits
  retry, target identity/status is rechecked before commit. An open ordinary session must be finished
  first; an open mistake practice resumes its saved plan.
- Session, question snapshots and cue exposure commit atomically. Each accepted spoken or edited
  answer advances to the next saved question with no conversation-provider call. Typed answers and a
  sixth answer are rejected; coaching stays asynchronous and Finish works at any point. Practice never
  advances independent-use mastery.

### 7.3 On-demand word translation (F13)

- English is the source. A locally persisted native language defaults to `ru`; choices: `ru`, `uk`,
  `de`, `fr`, `es`, `it`, `pt`, `ja`, `ko`, `zh-Hans`, `ar`. Pair support and installed-model status
  come from macOS, not from this list.
- Commands: `get_translation_settings`, `save_translation_settings(settings)`,
  `get_translation_status`, `prepare_translation_languages`, `translate_word(request)`. The first four
  fail with `IpcError`; `translate_word` keeps its own typed error until the word-translation step.
- `translate_word` takes one English word (up to 64 characters, internal apostrophes/hyphens) and
  optional surrounding English text (up to 500). Sentences, empty words, non-English letters and unsafe
  controls are rejected. The selected word and returned language must match the request snapshot.
- Response: `word`, `native_language`, `translation` (nonblank, up to 300 characters), and either
  `english_explanation` or `explanation_error` (up to 500). A missing explanation does not discard a
  translation. Errors are typed with recovery text. Translated text never replaces practice content or
  enters conversation history.
- `apple-translation` is compiled and signed with the app, separate from `apple-conversation`;
  TranslationSession needs macOS 26+ (earlier: actionable unavailable result); English explanations
  need Apple Intelligence. No Gemini or `agy` call, no API-usage count.
- One child per operation, bounded input/output and concurrency. Timeouts: status 15 s, lookup 45 s,
  language preparation 300 s. Failed or timed-out children are reaped. No session/database lock is held
  during native work.
- Preparing missing models needs an explicit action (a native SwiftUI window lets macOS ask for
  consent); settings changes never download silently.
- A valid lookup records cue exposure for the active session before native work (existing help/mastery
  exclusion) and never changes learning rules or scores an answer.
- Selection alone does no lookup. Talk, notes and Memory share one panel and keyboard path; multiword,
  editable and unmarked selections are excluded. Requests are invalidated when the word changes, the
  panel closes or the route changes. Practice audio stays usable.

## 8. Persistence

SQLite at `<app data>/english-trainer.sqlite3`. Tables:

| Group | Tables |
| :--- | :--- |
| Sessions | `sessions`, `turns`, `turn_input_sources`, `answer_help_uses`, `turn_feedback`, `attempt_comparisons`, `session_cue_exposures`, `session_phrase_recalls`, `mistake_practice_questions`, `session_wrapups`, `coaching_failures` |
| Memory | `mistakes`, `mistake_occurrences`, `phrase_cards`, `review_events`, `memory_review_runs`, `memory_review_items` (with `is_cued`), `review_material_preparations` |
| Usage evidence | `turn_usage_assessments`, `learning_usage_events`, `learning_usage_counter_baselines` |
| Settings | `ai_settings`; `speech_settings` (`model_file`, empty until chosen; `keep_raw_audio`, default off; `live_transcript`, default on); `glossary_terms` (ordered, seeded once with 27 words); `personal_profile`; `translation_settings` |
| API usage | `api_usage_days` (requests per Pacific day, source and model), `api_usage_last_limit` (last limit error per source) |

Session rows also carry the practice mode/phase columns and `is_mistake_practice` (default false).

- Migrations are additive and idempotent; tests cover upgrade from older schemas. The schema version
  is defined in the persistence schema module.
- Writes that change learning state (answer + source, review + schedule, assessment + evidence +
  projection) are single transactions.
- Raw audio is discarded after transcription unless "Keep raw audio" is on; then each answer is kept
  at `<app data>/recordings/<session>/<sequence>.wav` (owner-only; answers outside a session in
  `recordings/review/`), never uploaded, removed by "Delete kept recordings". Speech check recordings
  are kept on purpose in `<app data>/speech-check/` (§3). API keys are never stored in SQLite.

## 9. Learning rules

### 9.1 Scheduling

- Mistake observations are stored from the first occurrence, but Memory listing, due count,
  conversation targets and spoken Memory review selection require `times_seen >= 2`. Distinct answers
  (including across sessions) count; identical feedback delivery is idempotent. Replacing feedback can
  reduce eligibility. Inline coaching is unaffected.
- **Schedule** (spoken recall only; there is no self-reported review): a miss ("need practice") →
  interval 1 day, status `learning`; a wording match ("remembered") → interval 2 → 4 → previous ×
  ease (4-365 days), ease +0.1 up to 3.0. `new → learning`; `learning → improving` once the interval
  reaches 4 days; a review never sets `stable`.
- Spoken recall (daily recall, Memory review) saves transcript wording evidence and the schedule change
  atomically. A match is transcript evidence, not mastery. The saved wording must appear as whole
  words in order; a phrase with "…" gaps matches when its pieces are said in order with at most 8 of
  the learner's own words per gap (`conversation/recall.rs`).
- **Memory review run:** up to six due items, answered in order. `start_memory_review` takes optional
  `warmup: true` to select up to three due phrases for a new run; either route resumes an existing run
  intact. Safe nonempty saved cues are required for eligibility. A skipped item closes without a
  score, keeps its schedule, stays due, and its wording stays hidden. The first answer to an item is
  the one saved; later tries are practice only. A restored run with all items answered or skipped
  enters a closing state; warm-up cannot start the conversation until the finish write succeeds
  (failure offers Retry finish).
- **Review material (F10):** `prepare_review_material(run_id, retry?)` prepares one batch outside the
  session lock with `ReviewMaterialEngine`: `gemini-3.8-flash-high`, 90 s process / 85 s CLI bound,
  one request, no automatic retry, schema in the prompt. Only snapshot positions, target wording and
  usage notes are sent. SQLite caches `pending | ready | failed`; ready and failed survive restart,
  retry retries a failure, an interrupted pending job restarts, late results cannot revive an ended
  run. Cues, recording, Skip and End stay usable meanwhile.
- Generated JSON has exactly one situation and model sentence per requested position, no unknown
  fields. Situations: plain English, at most 500 characters / 60 words, must not contain the target.
  Examples: at most 600 characters / 80 words, must contain the target as wording evidence in a
  sentence. An invalid batch fails wholly with a recoverable typed error.
- `get_review_material(run_id)` is read-only: situations when ready, model answers only after the first
  answer is saved. `reveal_review_phrase(run_id, position)` persists `is_cued` for the current
  unanswered item before returning its hint; a failed write reveals nothing. Cued recall never grants
  independent-use evidence. Listen and Shadow after a result reuse the practice-only retry path and
  never submit a second score or schedule change.
- **Archive** hides a phrase or mistake from Memory and every queue (status `archived`, never due) and
  keeps history. Saving an archived phrase again, or Eva's notes catching an archived mistake again,
  restores it (`learning` / `new`). **Delete** removes the item and its evidence; the UI asks first.

### 9.2 Usage review and mastery (frozen subsystem)

1. **Eligibility:** saved first-pass answers 1 and 2 only; retries, drills, typed and edited answers
   are excluded. At most 3 non-archived candidates created before the session start (mistakes with
   earlier occurrences, phrases with provenance outside the session), 2+ words, ≤ 300 characters.
2. **Source rejection:** reject a target whose wording appeared in the opening question, the preceding
   AI reply/question, earlier saved feedback or the question scaffold. Targets with a cue exposure at
   or before the answer time are excluded. No eligible candidates → an empty assessment is saved
   without a provider call.
3. **Review:** `UsageReviewEngine` returns per target `correct | incorrect | uncertain`, confidence
   and a contiguous transcript excerpt (≤ 500 characters). Rust re-validates: confidence ≥ 0.9; the
   excerpt is an exact transcript substring containing the normalised target words; incorrect use must
   quote the full target (or full original mistake wording). One in-flight review per turn.
4. **Progression:** `times_correct_afterwards` counts distinct sessions with accepted correct evidence
   (plus a fixed pre-migration baseline). Streak = accepted correct sessions on separate days after the
   latest relapse. `new → learning` on first success; `learning → improving` after 2 sessions on
   separate days; `improving → stable` after 3 sessions on separate days, in 3 distinct weekly
   buckets, spanning at least 21 days. `archived` never changes.
5. **Relapse:** accepted incorrect use, or a repeated known correction in saved conversation feedback,
   resets status to `learning`, interval to 1 day, due at the original answer time, and the streak to
   0. Feedback-origin relapse events are idempotent and removed if the feedback is detached.
6. Commit re-checks the answer and target identity/status/provenance and saves assessment, events,
   counters, projection and cue exposure atomically. Duplicate reviews return the first assessment.
   Evidence describes transcript wording, not pronunciation or certified proficiency.

## 10. IPC

- Every Rust type crossing `invoke()` has a TypeScript counterpart updated in the same commit (the
  frontend's generated/decoded IPC layer, see [engineering/FRONTEND.md](engineering/FRONTEND.md));
  fields stay `snake_case`.
- Errors cross IPC as typed values with a `code`; the UI branches on codes, never on messages.
  `ProviderErrorCode` also carries session and database failures (`busy`, `invalid_session`,
  `database_error`).
- Long-running commands are `async` and run blocking work with `spawn_blocking`.
- Commands by area (the Rust command registration is the complete list):
  - Speech: `transcribe_audio`, `transcribe_partial`, `transcribe_rescue`, `get_speech_settings`,
    `save_speech_model`, `save_keep_raw_audio`, `list_speech_models`, `get_speech_engine_status`,
    `get_glossary`, `save_glossary` (trimmed, deduplicated ignoring case, at most 200 words of 40
    characters), `get_kept_recordings`, `delete_kept_recordings`, `get_speech_check`,
    `save_speech_check_recording` (raw WAV, header `x-sentence-index`),
    `delete_speech_check_recordings`, `run_speech_check` (model files, `include_prompt`, progress
    channel). Failures are `TranscriptionError` or `ProviderError` values.
  - Settings and setup: `get_setup_diagnostics`, `get_ai_settings`, `save_ai_settings`,
    `set_dock_icon`, `get_api_usage`, `get_speaking_activity` (minutes spoken per local day over the last
    190 days, from `sessions.active_duration_ms`, text chat excluded), `prewarm_conversation_provider`, Gemini key commands (§5.1),
    translation commands (§7.3), profile commands (§7).
  - Practice: `generate_follow_up`, `start_practice_session`, `get_active_practice_session`,
    `send_practice_turn`, `cancel_practice_reply`, `get_practice_dialogue`, `finish_practice_session`,
    `set_practice_clock`, `transition_practice_phase`, `start_mistake_practice`, `retry_practice_turn`,
    `retry_answer_coaching`, `get_question_scaffold`, `get_guided_answer`, `prefetch_answer_plan`,
    `rescue_answer`, `record_answer_help_used`.
  - Wrap-up: `get_session_wrapup`, `retry_session_wrapup`, `save_wrapup_phrases`.
  - Memory: `get_daily_recall_plan`, `submit_daily_recall`, `save_phrase_card`, `delete_phrase_card`,
    `delete_mistake`, `archive_learning_item`, `get_learning_memory`, `view_learning_memory`,
    `start_memory_review`, `get_memory_review`, `submit_memory_recall`, `skip_memory_review_item`,
    `finish_memory_review`, `prepare_review_material`, `get_review_material`, `reveal_review_phrase`,
    `review_practice_memory_usage`, `get_practice_memory_usage`, `get_memory_usage_evidence`.
- **API usage:** neither Gemini nor `agy` reports remaining quota, so requests are counted where sent
  (Gemini stream adapter, `agy` runner) and limit errors where they arrive (Gemini 429: bounded
  `error.message`; `agy`: the quota line and the reset moment such as "Resets in 4h44m53s"). Events go
  over a channel to a writer thread, so counting never delays a reply. Days are Pacific dates
  (daylight saving implemented by hand); counts older than 14 days are dropped. `get_api_usage`
  returns today's counts, the last Gemini limit error, the last `agy` quota error and the next Pacific
  midnight; Settings > Usage shows them with a link to the AI Studio usage page.
- **Dock icon:** `set_dock_icon(icon: "eva" | "dark" | "light")` swaps the running Dock tile via
  `NSApplication.applicationIconImage` (no-op off macOS). The choice is a localStorage preference
  re-applied at launch; `eva` restores the bundle icon (Eva with her sprout on sky blue), `dark` and
  `light` swap in the Icon board's Dark and Tinted styles. The SVG sources live in `assets/icons/`;
  `bun run build:icons` renders them and runs `tauri icon` for every size.

## 11. Setup diagnostics

`get_setup_diagnostics` reports paths and readability of `whisper-cli`, `whisper-server` (with whether
the model is kept loaded and why not), the Whisper model and `agy`, the database path, and the
bounded, plain-text default model name from the local `agy` settings file (nothing else from it). It
never proves authentication, transcription quality or microphone permission, and never starts capture
or a provider request. Apple model availability and Gemini key presence (never the key) are reported
by their own status commands.

## 12. Latency

Primary metric: end of learner speech → first AI audio.

| Stage | Budget (p50) |
| :--- | :--- |
| End of turn (button or VAD) | ≤ 0.2 s (button) / pause setting (VAD) |
| Transcription of a 15 s answer | ≤ 1.5 s |
| Provider first token | ≤ 1.0 s |
| First sentence to audio start | ≤ 0.3 s |
| **Total** | **≤ 2.5 s p50, ≤ 4 s p95** |

Each stage is measured in the app and shown in a debug panel; deep feedback is outside the budget.
Synthetic benchmarks record timings and error categories only, never personal transcripts.

## 13. Privacy and permissions

- Required: microphone. Not required: Screen Recording, Accessibility, notifications, autostart.
- Audio is transcribed locally and discarded by default; failed transient attempts stay in memory for
  retry until reset or close. Kept answers (Settings > Privacy) and speech-check recordings are the
  only stored audio: local, opt-in, deletable.
- Only the transcript and minimal context go to the selected provider. The Gemini free tier allows
  Google to use prompts for product improvement and human review; Settings shows this notice.
- Local data: sessions, transcripts, Learning Memory and settings in SQLite; device ID in WebView
  storage; Gemini key in an encrypted, owner-only file in the app data folder.

## 14. Testing

- Rust unit tests beside the code for parsers, validation, scheduling, migrations and transactions.
- Fake providers at the edge: `ENG_TRAINER_AGY_BIN` for `agy`; a fake conversation provider and a
  temporary SQLite database for the pipeline test in `src-tauri/tests/`.
- Live provider checks are `#[ignore]` and run explicitly with synthetic input only. The bundled
  translation helper has one such check (`real_bundled_helper_translates_a_word_on_device`; needs
  macOS 26+, installed English/Russian models and Apple Intelligence; downloads nothing).
- `bun run verify` runs frontend types/lint/unit tests, Rust format/Clippy/tests and Playwright
  scenarios. `bun run test:e2e` exercises the real UI with typed fixtures at the Tauri IPC boundary and
  synthetic browser audio; unknown fixture commands fail the scenario. CI requires these before
  packaging; failures keep screenshots, traces and an HTML report.
- Manual checks on a physical Mac are required for microphone, STT quality, TTS, native download
  consent, translation relevance and perceived latency; a green automated suite does not prove them.
