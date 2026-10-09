# Technical Requirements

Contracts the code must keep. Product behaviour is in [PRODUCT_SPEC.md](PRODUCT_SPEC.md), structure
in [ARCHITECTURE.md](ARCHITECTURE.md), coding conventions in
[CODE_REQUIREMENTS.md](../CODE_REQUIREMENTS.md). Sections marked **Target** describe the agreed
contract of a roadmap feature that is not implemented yet.

## 1. Platform and stack

| Area | Choice |
| :--- | :--- |
| OS | macOS 14+, Apple Silicon. Apple Foundation Models needs macOS 26+ with Apple Intelligence enabled. |
| Desktop | Tauri v2, Rust stable, SQLite via `rusqlite` (bundled). |
| Frontend | React 19, TypeScript (strict), Vite, Bun, Tailwind CSS v4, HeroUI v3, TanStack Router, Lucide. |
| Quality | Biome, `tsc --noEmit`, `bun test`, rustfmt, Clippy with warnings as errors, `cargo test`; run by Lefthook pre-commit and GitHub Actions CI. |
| Packaging | `bun run build:desktop` → ad-hoc signed `.app` and DMG; the Apple helper is compiled at build time and bundled. |

## 2. Audio capture

- Push-to-talk through Web Audio / AudioWorklet: mono, 16-bit PCM, normalised to 16 kHz, WAV in
  memory. Never rely on `MediaRecorder` formats.
- Capture requests `echoCancellation`, `noiseSuppression` and `autoGainControl` as `false`
  (best-effort; device DSP and macOS microphone modes are outside the app's control). Playback and
  TTS stop before capture.
- An explicit device uses `deviceId: { exact: id }`; a missing device is a recoverable error, never
  a silent fallback to the default. The device ID is a local WebView preference. The actual input
  label is read from the acquired track. Enumerating devices never starts capture.
- Microphone session (`src/audio/microphoneSession.ts`): one open stream, `AudioContext` and
  worklet. The input is warmed up once at open (three seconds of frames, including silence); the
  session times out after eight seconds without readiness and releases the device. Frames keep
  flowing afterwards into a 300 ms in-memory pre-roll ring buffer, a live level and a noise-floor
  estimate. A capture starts immediately, even before the warm-up finished, and returns the same
  16 kHz mono WAV plus signal summary as before. Raw audio stays in memory and is discarded after
  transcription.
- Practice conversations keep one warm session (`useMicrophoneSession`) open while a practice
  session is active; it is released on finish, unmount, device loss, or the user's "Pause mic"
  (Record or Resume mic reopens it) and is reopened when the preferred device changes. macOS shows
  its microphone indicator while the session is open. Without a session (memory recall drill,
  Settings test) `startPcmRecording` opens, warms, captures and releases one on the same code path.
- Pre-roll is 300 ms for a manual press, but 0 when the assistant was speaking at the press and
  0 for auto-listening, so the assistant's own voice is not captured. Capture starts only after
  speech ended or was stopped. The request-to-capture latency is shown in the speech timing panel
  ("Mic Start").
- Turn detection (`src/audio/turnDetector.ts`) is energy based with an adaptive noise floor seeded
  from the session. A turn needs about 300 ms of speech; it ends after the configured pause of
  silence (default 1.5 s, 1.0-3.0 s). With hands-free on, recording stops by itself at the end of
  the turn and is transcribed as usual; "Keep listening" holds the turn open. Auto-listening that
  hears no speech for 20 s cancels back to idle. Esc cancels listening without sending.
- Conversation flow preferences (localStorage, `src/lib/conversationFlowPreferences.ts`, edited in
  Settings): auto-listen (default on), hands-free turn end (on), end-of-turn pause (1500 ms),
  auto-send of voice answers (on) and the edit window before sending (2000 ms, 0-5000 ms). After
  a transcript the composer shows "Sending in N s - edit to stop" with "Send now"; editing the
  draft stops the countdown; an unedited auto-sent transcript is still sent as `voice`.
- Auto-listen runs after the AI's reply finished speaking by itself, on the Conversation screen only.
- The Settings microphone check uses the same recorder, stops after ten seconds, offers local
  playback and discard only, and shows per-second amplitude, captured vs elapsed duration and
  reported processing flags. It never transcribes, calls a provider or saves audio. Device changes
  and checks are blocked while practice capture is active.

## 3. Speech recognition

Current:

- `transcribe_audio` receives raw WAV bytes; Rust validates RIFF/WAVE, mono, 16-bit, 16 kHz, at most
  60 MB.
- The model is `<app data>/models/<model_file>` where `model_file` is the learner's choice in
  Settings > Speech recognition (any plain `ggml-*.bin` name, never a path). With no choice stored
  (`speech_settings.model_file` is empty) the app uses `ggml-small.en.bin` when it is installed and
  `ggml-base.en.bin` otherwise; Rust resolves this (`SpeechSettings::resolved`) so the UI always
  sees the model in use. `ENG_TRAINER_WHISPER_MODEL` overrides the choice and Settings says so.
- **Model kept loaded (F3 part 2, `audio/server.rs`).** One `whisper-server` child per app run holds
  the model. It is resolved like `whisper-cli` (`ENG_TRAINER_WHISPER_SERVER_BIN`, `PATH`, Homebrew
  paths), started with `-m <model> --host 127.0.0.1 --port <free port>` when a practice session opens
  (`warm_speech_engine`), when the model is changed, or on the first transcription. Transcription is
  `POST /inference` as multipart (`file` = the WAV, `prompt`, `language=en`,
  `response_format=json`) with the existing blocking `reqwest` client (no proxy; the multipart body
  is written by hand, so no extra crate feature). A server that has died is restarted once; after two
  deaths with no answer in between, or if it cannot start, it is not started again for that model
  until the model changes or the next session opens, and the call falls back to `whisper-cli`.
  Settings > Speech recognition shows "Kept loaded · ready", "Loading…" or "Not running (using
  one-off runs)" (`get_speech_engine_status`), and Setup details gain a Whisper server line with the
  reason when it is not used. The child is stopped on app exit (`RunEvent::Exit`) and on drop; its
  pid is noted in `<app data>/whisper-server.pid` so a server left by a crashed run is stopped
  before the next start.
- Without the server, each call runs `whisper-cli` (`ENG_TRAINER_WHISPER_BIN`, `PATH`, Homebrew
  paths) in a private temporary directory with a 120 s timeout. Failures map to typed
  `TranscriptionError` codes (`model_missing`, `engine_missing`, `engine_failed`, `timeout`,
  `invalid_audio`, `invalid_output`, `no_speech`, `io_failure`); a silent recording is `no_speech`
  on either path and is not retried on the other.
- **Initial prompt (`audio/prompt.rs`).** Rust builds it for each answer from the open session:
  `<question being answered> Vocabulary: <names from the last three answers>, <glossary>.`, at most
  500 characters (the question is cut at a word after 160; the vocabulary keeps as many terms as fit,
  session names first). Names are words with a capital inside a sentence or inside the word
  (`CS2`, `TypeScript`) that the glossary does not hold. Outside a session (the memory review) it is
  the glossary alone.
- **Live transcript (F3 part 2).** While a practice answer is being recorded the UI asks for
  `transcribe_partial` every 1.5 s with a WAV of the audio so far (copied from the capture buffer;
  capture is not interrupted; no more than 30 s). Rust runs it on the loaded model only when the
  setting is on, the model is small (tiny, base or small) and the server is ready; it never starts a
  server, handles one update at a time, gives up after 5 s and returns nothing otherwise. The
  partial audio is not kept. The final transcription after recording is separate and authoritative.

- Speech check (F3 part 1, `src-tauri/src/audio/speech_check.rs`): 12 fixed sentences; the learner
  reads them in Settings and each reading is stored as the same 16 kHz mono WAV as `NN.wav` with
  the sentence as `NN.txt` in `<app data>/speech-check/` (owner-only; replacing a reading
  overwrites it; "Delete recordings" removes the folder with the measurements). Measuring runs the
  same `whisper-cli` call as the app for each chosen model (and, if asked, again with
  `--prompt "Vocabulary: <glossary>."`, at most 500 characters), off the UI thread, one measurement
  at a time. Per model and prompt setting it stores term accuracy (glossary terms present in the
  sentence that appear in the transcript as whole words, ignoring case and tolerant of spacing and
  of small number words: "CS 2", "CS two"), word error rate (pooled, on normalised words), median and
  slowest time (the whole process, so including model load) and every transcript, in
  `speech-check/results.json`. Scoring is pure code in `audio/scoring.rs`.
- The personal glossary and the settings below are stored in SQLite (section 8).

Measured on the learner's 12 speech-check recordings (2026-10-09, glossary terms recognised of 23,
without / with the glossary prompt): base.en 13 / 19, small.en 17 / 21 (91%), medium.en 17 / 20,
large-v3-turbo-q5_0 17 / 19 (better word error rate, 7% against 11%). Per recording with the
model kept loaded: small.en loads in 0.7 s and answers in 0.32 s (median); large-v3-turbo loads in
0.4 s and answers in 1.15 s. Hence small.en is the default and the live transcript is limited to the
small models.

Recognition uncertainty is never presented as a pronunciation or knowledge error.

## 4. Speech output

- System voices through `speechSynthesis`; voices are discovered at runtime, English voices are
  preferred, no named voice is assumed. Rate is adjustable; pause, resume, stop and replay exist.
- A new recording or a new AI turn cancels current speech.
- **Target [F4]:** the reply is spoken sentence by sentence as it streams in.

## 5. Conversation providers

### 5.1 Contract (F1)

- `ConversationContext`: `opening_question`, up to 20 `recent_turns` (learner, assistant reply,
  assistant question), `latest_transcript` (1–4,000 characters), up to 2 `learning_targets`,
  `earlier_answers` (the learner's answers older than the recent turns, each cut to about 160
  characters at a word boundary) and `asked_questions` (the 40 most recent questions Eva asked, each
  at most 200 characters; the prompt tells her never to repeat them or ask what is already answered).
  One builder serves every turn. Total context at most 24,000 characters; over budget,
  condensed answers are dropped first (oldest first), then the oldest turns, then the oldest asked
  questions. The latest transcript, opening question and targets are always kept. The context stays
  inside the one Gemini request per turn. Each provider compacts its own copy
  (`ConversationContext::compact`): the Apple backup gets the last 6 turns, at most 3,500
  characters, the 10 latest asked questions and no condensed answers; legacy `agy` gets 8 turns and
  8,000 characters.
- `ConversationTurn`: `spoken_reply`, `question` (nullable), `provider_latency_ms`,
  `first_token_ms`, `answered_by` (`{ provider: gemini | apple | agy, model, is_backup }`; the race
  reports which leg won, `is_backup` is true when Apple answered for a stalled or failed Gemini).
  `agy` still returns the schema-validated pair (reply ≤ 30 words, one question
  ≤ 20 words; the reply limit depends on the style); Gemini and Apple return plain text.
- Settings (`ai_settings` table): provider `gemini | apple | agy` (default `gemini`); `agy_model`
  `default | gemini-3.8-flash-low | gemini-3.8-flash-high`; `eva_style` `short_and_simple |
  natural` (default `natural`; rows saved before it existed read as `natural`). Model IDs already
  encode effort; never also pass `--effort`.
- Eva's style (`providers/plain_prompt.rs`, `providers/settings.rs`): `ConversationContext.eva_style`
  is set from the saved settings in `generate_configured_turn` and never serialised into the model
  data. `short_and_simple` asks for one or two short sentences of simple English; `natural` for two
  to four sentences of B2-level everyday English with varied reactions, light humour, a short opinion
  of her own as an AI friend and sometimes a deeper follow-up. Both end with exactly one question and
  give no corrections. Gemini's `maxOutputTokens` is 220 and the reply cap 520 characters. `agy`
  reads the style too: `natural` allows 400 characters and 70 words in `spoken_reply`.
- Streaming: `send_practice_turn` and `generate_follow_up` take a Tauri
  `Channel` that receives `{ kind: "delta", text }` chunks while the reply is generated; the command
  still returns the final `ConversationTurn`. `agy` sends its whole reply as one delta at the end.
- Plain-text shaping (`providers/reply_text.rs`, shared by Gemini and Apple): strip markdown,
  collapse whitespace, cap at about 350 characters at a sentence boundary, then split off the final
  sentence ending in `?` as `question`. Without a question the whole text is `spoken_reply`,
  `question` is `null`, and that reply is the prompt the learner answers next. Only empty output is
  an error.
- The learner's answer is saved only after a complete reply; on failure nothing is saved, the
  session leaves `in_flight`, and the answer stays editable. Generation runs outside the session
  mutex.
- `agy` runs with `--print`, `--json-schema`, `--sandbox`, `--disable-slash-commands`, a log file,
  in a private temporary directory. Both attempts share one 45 s budget. Invalid output returns a
  typed error with `reply_stage` (`envelope`, `schema`, `content`); provider output is never stored.
- Apple: one bundled helper process per app run, started lazily or by
  `prewarm_conversation_provider` when a session opens, speaking JSON lines (`{id, instructions,
  prompt}` in; `delta`, `done`, `error` events out) and streaming with `streamResponse`. One request
  at a time, 20 s timeout, restarted once if the process died before replying. Unavailability
  reasons map to typed `unavailable` errors. Apple failures never fall back to another provider.
  The same helper is the backup leg for Gemini (below) and is prewarmed with it.
- Gemini API: `streamGenerateContent?alt=sse` over HTTPS (blocking `reqwest` in `spawn_blocking`),
  5 s connect and 20 s total timeout. Model IDs are tier constants inside the adapter:
  conversation `gemini-3.5-flash-lite`. The Apple on-device model is raced as a backup
  (`providers/race.rs`): it starts when Gemini fails with 429, 5xx or a network error, ends with no
  text, or has produced no text after 2 s (the free tier can accept a request and stall for
  10–15 s). The first stream that produces text wins and the other is dropped; when both fail, the
  Gemini error is reported. Configuration errors (`unauthorized`, invalid request) are reported
  without a backup reply. `gemini-3.5-flash` is not used as a fallback: its free tier allows 20
  requests a day.
  The origin is stored per turn (schema version 9: nullable `answered_by_provider`,
  `answered_by_model`, `answered_by_backup` on `turns`; older turns stay null and show no origin),
  returned on each turn of `PracticeDialogue`, and shown under Eva's messages and in Settings'
  "Test AI response". Model IDs are `gemini-3.5-flash-lite`, `apple-foundation-models` and the
  `agy_model` setting (`default` when unset).
  The HTTP client is shared per app run to keep the connection alive. Thinking level `minimal`,
  about 150 output tokens. Errors map to `unauthorized` (401, 403, 400
  `API_KEY_INVALID`), `rate_limited` (429), `unavailable` (5xx, network), `timeout`,
  `invalid_output` (empty text, blocked prompt).
- Gemini key: pasted in Settings and stored in `<app data>/gemini-api-key.enc` (mode 0600, written
  via a temporary file and rename). Format: version byte, 12-byte nonce, ChaCha20-Poly1305
  ciphertext; the encryption key is SHA-256 of a fixed context string and the OS machine ID
  (`machine-uid`). This keeps the key unreadable in backups, synced folders or a copied data folder;
  it does not protect against software already running as the user. No OS credential prompt is
  shown. A file that does not decrypt is reported as `unauthorized` with a request to paste the key
  again. `ENG_TRAINER_GEMINI_API_KEY` overrides it. The key is read once per run and kept in memory, sent only in the `x-goog-api-key` header, and
  never returned to the UI, logged, put in a URL or in an error message. Commands:
  `get_gemini_key_status` (`{ configured, source: settings | environment | null }`),
  `save_gemini_api_key`, `delete_gemini_api_key`.
- Tiers, not model IDs, at call sites: `conversation` (fast) and `coaching` (background, batched,
  `agy` with `gemini-3.8-flash-medium`; the Gemini API is not used for coaching).

## 6. Coaching, help and review providers

- **Coaching queue** (`conversation/coaching_queue.rs`, F5). Every saved learner answer waits for
  coaching. The queue is derived from SQLite: answers without a `turn_feedback` row and with fewer
  than 2 failed attempts (`coaching_failures`, schema version 11; the current version is 12), so a restart resumes it. One
  worker thread runs one batch at a time. A batch of the oldest waiting answers, at most 5, starts
  when 5 answers wait, when the session finishes (`flush`), when the learner has been quiet for 60 s
  with anything waiting (`IDLE_FLUSH`, restarted by every saved answer), or at once for an answer that
  failed once (its single retry). A failed, empty or invalid batch counts one failed attempt for every
  answer it missed; an answer with 2 failed attempts shows "Couldn't check this answer" with a manual
  Retry (`retry_answer_coaching`, which also resumes a paused queue). A quota error (`RESOURCE_EXHAUSTED`
  or 429 in agy's stderr, stdout or envelope, `ProviderErrorCode::RateLimited`) pauses coaching without
  spending attempts; talking is never blocked. The pause lasts 30 minutes (`QUOTA_PAUSE`, in memory only),
  then one batch probes again, and a still-limited probe pauses another 30 minutes; Retry resumes at once. Results are saved through `SessionStore::save_feedback`,
  the same path as before, so the learning engine records the mistake (one per answer, deduplicated by
  normalised key) and typed or edited answers keep their evidence rules. Saving works after the
  session finished. After every batch Rust emits the Tauri event `coaching-updated` `{ session_id }`;
  the UI re-reads the dialogue or wrap-up and never polls.
- **Batch call** (`providers/agy/coaching.rs`): one `agy` call with `--model gemini-3.8-flash-medium`
  (measured on 66 real answers: 14–136 s per batch of 5, median about 40 s, as many real mistakes found
  as one answer per call; one answer per call exhausted the quota after about 54 calls). The process
  budget is 170 s. The prompt ("do not use any tools or commands") gets `{ n: sequence, question,
  transcript }` per answer and the JSON schema returns `answers[{ n, mistakes[0..2]{ original,
  improved, explanation, category }, rewrite }]`. The reply is read from `structured_output` (an
  object or text; the `response` text is the fallback). Each answer is validated on its own: the
  rewrite is plain text of at most 600 characters; the first mistake whose quote really occurs in the
  transcript, with texts within bounds and a different `improved`, becomes the one focus point
  (`TurnFeedback.focus_feedback` has at most one, as the learning model records one mistake per
  answer); a bad entry costs only its own answer.
- `get_practice_dialogue` returns `coaching[]`, one entry per turn: `{ state: pending | paused |
  failed }` or `{ state: ready, feedback }`. `get_session_wrapup(session_id)` rebuilds the wrap-up of
  a finished session; `FinishedPracticeSession` has `pending_coaching` and `is_coaching_paused`.
  `TurnFeedback` is stored and shown; the note's "Say it again" uses `retry_practice_turn`.
- `retry_practice_turn` saves a second attempt and returns a local `AttemptComparison`
  (`target_evidence`: `already_present_in_both | newly_observed_in_retry | partially_observed |
  not_observed | uncertain`, word-count change).
- `get_guided_answer(session_id, sequence, question)` → `{ model_answer, adaptation }` for the
  active unanswered prompt only. Rust checks session, sequence and exact question. The cue exposure is saved **before** generation; a stale result cannot supply help for
  another turn. Failure does not change the session.
- **Target [F6]:** a help bundle `{ frame[3], phrases[3..5], model_answer, adaptation }` is
  prefetched when a question appears. Opening any level records a cue exposure.
- **Target [F7]:** rescue requests carry the partial transcript and return one suggestion; they
  record a cue exposure.

## 7. Sessions and input provenance

- One Talk mode with a suggested 5, 10 or 15 minute goal (10 by default, F8). Reaching the goal
  never finishes the session or blocks another answer. The eight-answer field remains only for
  compatibility with the existing daily recall gate. New sessions are stored with
  mode `conversation`; sessions saved as `coach` by older versions are read the same way (an answer
  that Coach saved but never continued stays in the dialogue without a reply). No mode crosses IPC.
- `get_practice_dialogue(session_id)` returns `{ session_id, opening_question, turns,
  input_sources, reply_times_ms, answer_durations_ms, help_used, coaching }` for the active session
  only. The three lists after `input_sources` are aligned with `turns`:
  time to Eva's first words (falls back to total provider latency; `null` for older turns), spoken
  answer length (`null` for typed or older answers) and whether help was opened for that answer.
  Schema version 10 adds nullable `turns.reply_ms` and `turns.answer_duration_ms` and the
  `answer_help_uses(session_id, sequence)` table. `send_practice_turn` takes an optional
  `answer_duration_ms` (voice and edited answers only). `record_answer_help_used(session_id,
  sequence)` is idempotent and rejects other sessions and any sequence but the pending answer; it
  records only and changes no learning or mastery rule.
- `send_practice_turn` takes an optional `input_source`
  (`voice | edited | text`; omitted means `text`), saved atomically with the answer in
  `turn_input_sources`. Failed provider calls save nothing.
- Voice auto-send applies only to a new successful transcription and only when enabled. Drafts stay
  in memory; no browser persistence of answers.
- A session has at most one in-flight provider request; duplicate or stale submissions are rejected.
- F8 session metadata: `topic_id`, `topic_label`, nullable `topic_custom`,
  `duration_goal_seconds`, `active_duration_ms`, `started_at` and `is_clock_running`.
  `start_practice_session` accepts optional topic/time options, validated in Rust; an existing open
  session is resumed with its saved options. Topic openings are local and vary between sessions.
  `set_practice_clock(session_id, running)` checkpoints a monotonic active clock and returns the
  session snapshot. The UI checkpoints every 15 seconds while Talk is open, pauses on
  leaving Talk or pausing the mic, and extrapolates the snapshot for display. App exit checkpoints
  the clock; startup restores it paused. A crash may lose up to one checkpoint interval.
  `FinishedPracticeSession.duration_ms` is active time, with topic and goal returned beside it.
- `get_personal_profile` / `save_personal_profile` read/write optional-content fields `role`,
  `stack`, `interests`, `goals` (each at most 150 characters). Profile and topic are delimited data
  in provider instructions and counted in context limits; question types vary by turn. Profile
  terms supplement the effective STT glossary without changing the learner's editable list.
- Memory phrase records carry optional `session_topic`; the source line shows topic and date
  when provenance exists, preserving the saved note.

## 8. Persistence

SQLite at `<app data>/english-trainer.sqlite3`. Current tables:

| Group | Tables |
| :--- | :--- |
| Sessions | `sessions`, `turns`, `turn_input_sources`, `answer_help_uses`, `turn_feedback`, `attempt_comparisons`, `session_cue_exposures`, `session_phrase_recalls` |
| Memory | `mistakes`, `mistake_occurrences`, `phrase_cards`, `review_events`, `memory_review_runs`, `memory_review_items` |
| Usage evidence | `turn_usage_assessments`, `learning_usage_events`, `learning_usage_counter_baselines` |
| Settings | `ai_settings`, `speech_settings` (the chosen Whisper model file, empty until the learner chooses; `keep_raw_audio`, default off; `live_transcript`, default on), `glossary_terms` (ordered personal glossary), `personal_profile` (F8, schema version 15); speech settings and the glossary were added in version 13, `live_transcript` and the empty model default in version 14; the glossary is seeded once with 27 words |
| API usage | `api_usage_days` (requests per Pacific day, source and model), `api_usage_last_limit` (last limit error per source), both added by schema version 12 |

- Migrations are additive and idempotent; tests cover upgrade from older schemas.
- Writes that change learning state (answer + source, review + schedule, assessment + evidence +
  projection) are single transactions.
- Raw audio is discarded after transcription unless the learner turns on "Keep raw audio"; then
  each answer is kept in `<app data>/recordings/<session>/<sequence>.wav` (owner-only files; answers
  outside a session in `recordings/review/`), never uploaded, and removed by "Delete kept
  recordings". The speech check recordings are kept on purpose in `<app data>/speech-check/`
  (section 3). API keys are never stored in SQLite.

## 9. Learning rules

### 9.1 Scheduling

- Schedule rule (applied to a spoken recall: a miss is "need practice", a wording match "remembered"; there is no self-reported review any more): "need practice" → interval 1 day, status `learning`; "remembered" →
  interval 2 → 4 → previous × ease (4–365 days), ease +0.1 up to 3.0. `new → learning`;
  `learning → improving` once the interval reaches 4 days; a review never sets `stable`.
- Spoken recall (daily recall, Memory review) saves transcript wording evidence and the schedule
  change atomically. Wording match is transcript evidence, not mastery. The saved wording must
  appear as whole words in order; a phrase with "…" gaps matches when its pieces are said in order
  with at most 8 of the learner's own words in each gap (`conversation/recall.rs`).
- A Memory review run holds up to three due items, answered in order. An item the learner skips is
  closed without a score: it keeps its schedule and stays due, and its wording stays hidden. The
  first answer to an item is the one that is saved; a later try on screen is practice only.
- Archive hides a phrase or mistake from Memory and from every review queue (status `archived`,
  never due) and keeps its history. Saving an archived phrase again, or Eva's notes catching an
  archived mistake again, brings it back (`learning` / `new`). Delete removes the item and its
  evidence for good; the UI asks first.

### 9.2 Usage review and mastery (frozen subsystem)

1. **Eligibility:** saved first-pass answers 1 and 2 only; retries and
   drills are excluded. Typed or edited answers are excluded. At most 3 non-archived candidates
   created before the session start (mistakes with earlier occurrences, phrases with provenance
   outside the session), 2+ words, ≤ 300 characters.
2. **Source rejection:** a target is rejected if its wording appeared in the opening question, the
   preceding AI reply/question, earlier saved feedback, or the question scaffold. Targets with a cue
   exposure at or before the answer time are excluded. No eligible candidates → an empty assessment
   is saved without calling a provider.
3. **Review:** `UsageReviewEngine` returns per target `correct | incorrect | uncertain`, confidence
   and a contiguous transcript excerpt (≤ 500 characters). Rust re-validates: confidence ≥ 0.9; the
   excerpt is an exact transcript substring containing the normalised target words; incorrect use
   must quote the full target (or full original mistake wording). One in-flight review per turn.
4. **Progression:** `times_correct_afterwards` counts distinct sessions with accepted correct
   evidence (plus a fixed pre-migration baseline). Streak = accepted correct sessions on separate
   days after the latest relapse. `new → learning` on first success; `learning → improving` after
   2 sessions on separate days; `improving → stable` after 3 sessions on separate days, in 3
   distinct weekly buckets, spanning at least 21 days. `archived` never changes.
5. **Relapse:** accepted incorrect use, or a repeated known correction in saved conversation
   feedback, resets status to `learning`, interval to 1 day, due at the original answer time, and
   the streak to 0. Feedback-origin relapse events are idempotent and are removed if the feedback
   is detached.
6. Commit re-checks the answer and target identity/status/provenance and saves assessment, events,
   counters, projection and cue exposure atomically. Duplicate reviews return the first assessment.
   Evidence describes transcript wording, not pronunciation or certified proficiency.

## 10. IPC

- Every Rust type crossing `invoke()` has a TypeScript counterpart in `src/lib/` updated in the same
  commit; fields stay `snake_case`.
- Errors cross IPC as typed values with a `code`; the UI branches on codes, never on messages.
  Current `ProviderErrorCode` also carries session and database failures (`busy`,
  `invalid_session`, `database_error`); separating them into their own error types is planned with
  [F5].
- Speech commands (`src-tauri/src/audio/commands.rs`, types in `src/lib/speechTypes.ts`):
  `transcribe_audio` (raw WAV; reads the model choice and the keep-audio setting),
  `get_speech_settings`, `save_speech_model`, `save_keep_raw_audio`, `list_speech_models`,
  `get_glossary`, `save_glossary` (trimmed, deduplicated ignoring case, at most 200 words of 40
  characters), `get_kept_recordings`, `delete_kept_recordings`, `get_speech_check`,
  `save_speech_check_recording` (raw WAV, header `x-sentence-index`),
  `delete_speech_check_recordings`, `run_speech_check` (model files, `include_prompt`, progress
  channel). Failures are `TranscriptionError` or `ProviderError` values with a `code`;
  `TranscriptionErrorCode` gained `busy`.
- Other current commands: `get_setup_diagnostics`, `get_ai_settings`,
  `save_ai_settings`, `set_dock_icon`, `get_api_usage`, `prewarm_conversation_provider`, `get_gemini_key_status`,
  `save_gemini_api_key`, `delete_gemini_api_key`, `generate_follow_up`, `start_practice_session`, `get_active_practice_session`,
  `send_practice_turn`, `get_practice_dialogue`, `finish_practice_session`, `get_session_wrapup`,
  `retry_answer_coaching`, `retry_practice_turn`,
  `get_question_scaffold`, `get_guided_answer`, `record_answer_help_used`, `get_daily_recall_plan`, `submit_daily_recall`,
  `save_phrase_card`, `delete_phrase_card`, `delete_mistake`, `archive_learning_item`,
  `get_learning_memory`, `view_learning_memory`,
  `start_memory_review`, `get_memory_review`, `submit_memory_recall`, `skip_memory_review_item`,
  `finish_memory_review`,
  `review_practice_memory_usage`, `get_practice_memory_usage`, `get_memory_usage_evidence`.
- API usage (`src/api_usage/`): neither Gemini nor `agy` reports a remaining quota, so requests are
  counted where they are sent (`providers/gemini/stream.rs`, `agy::runner::run_cli`) and limit
  errors are noted where they arrive (Gemini 429: only `error.message`, bounded; `agy`: the quota
  line and the moment from "Resets in 4h44m53s"). Events go over a channel to a writer thread, so
  counting never delays a reply. Days are Pacific dates (daylight saving implemented by hand in
  `pacific.rs`); counts older than 14 days are dropped. `get_api_usage` returns today's counts, the
  day's last Gemini limit error, the last `agy` quota error and the next Pacific midnight; Settings >
  Usage shows them with a link to the AI Studio usage page.
- Dock icon: `set_dock_icon(icon: "dark" | "light")` swaps the running app's Dock tile through
  `NSApplication.applicationIconImage` (objc2; a no-op off macOS). The choice is a UI preference in
  localStorage re-applied at launch; the bundle icon (Finder, Launchpad) stays the dark one. Icon
  sources are in `src-tauri/icons/source/`; every size comes from `tauri icon`.
- Long-running commands are `async` and run blocking work with `spawn_blocking`.

## 11. Setup diagnostics

`get_setup_diagnostics` reports paths and readability of `whisper-cli`, `whisper-server` (with whether
the model is kept loaded and why not), the Whisper model and
`agy`, the database path, and the bounded, plain-text default model name read from the local `agy`
settings file (no other settings exposed). **Target [F1]:** Apple model availability and Gemini
key presence (never the key itself). Detection never proves authentication, transcription quality or
microphone permission, and never starts capture or a provider request.

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
- Audio is transcribed locally and discarded by default; failed transient attempts stay in memory
  for retry until reset or close. Keeping answers (Settings > Privacy) and the speech check
  recordings are the only audio stored, both local, opt-in and deletable.
- Only the transcript and minimal context go to the selected provider. The Gemini free tier allows
  Google to use prompts for product improvement and human review; Settings shows this notice.
- Local data: sessions, transcripts, Learning Memory and settings in SQLite; device ID in WebView
  storage; Gemini API key in an encrypted, owner-only file in the app data folder.

## 14. Testing

- Rust unit tests beside the code for parsers, validation, scheduling, migrations and transactions.
- Fake providers at the edge: `ENG_TRAINER_AGY_BIN` for `agy`; **target [F1]** a fake streaming
  engine for a pipeline test in `src-tauri/tests/`.
- Live provider checks are `#[ignore]` and run explicitly with synthetic input only.
- Manual checks on a physical Mac are required for microphone, STT quality, TTS and perceived
  latency; a green unit test does not prove them.
