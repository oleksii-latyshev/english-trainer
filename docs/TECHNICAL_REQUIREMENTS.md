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
- `whisper-cli` is resolved from `ENG_TRAINER_WHISPER_BIN`, `PATH`, then Homebrew paths. The model
  defaults to `<app data>/models/ggml-base.en.bin` (override `ENG_TRAINER_WHISPER_MODEL`).
- Each call runs in a private temporary directory, has a 120 s timeout and maps failures to typed
  `TranscriptionError` codes (`model_missing`, `engine_missing`, `engine_failed`, `timeout`,
  `invalid_audio`, `invalid_output`, `no_speech`, `io_failure`).

**Target [F3]:**

- A long-lived worker keeps the model loaded (Metal). Model choice (English-only) is made from a
  measured comparison on the learner's recordings; record word accuracy on a fixed list of
  technical terms and latency for 5 s and 15 s answers.
- The request carries an initial prompt built from the current question, the last turns and the
  personal glossary, bounded to Whisper's prompt length.
- Recognition uncertainty is never presented as a pronunciation or knowledge error.

## 4. Speech output

- System voices through `speechSynthesis`; voices are discovered at runtime, English voices are
  preferred, no named voice is assumed. Rate is adjustable; pause, resume, stop and replay exist.
- A new recording or a new AI turn cancels current speech.
- **Target [F4]:** the reply is spoken sentence by sentence as it streams in.

## 5. Conversation providers

### 5.1 Contract (F1)

- `ConversationContext`: `opening_question`, up to 8 `recent_turns` (learner, assistant reply,
  assistant question), `latest_transcript` (1–4,000 characters), up to 2 `learning_targets`.
  Total context at most 8,000 characters; the oldest turns are dropped first.
- `ConversationTurn`: `spoken_reply`, `question` (nullable), `provider_latency_ms`,
  `first_token_ms`, `answered_by` (`{ provider: gemini | apple | agy, model, is_backup }`; the race
  reports which leg won, `is_backup` is true when Apple answered for a stalled or failed Gemini).
  `agy` still returns the schema-validated pair (reply ≤ 30 words, one question
  ≤ 20 words); Gemini and Apple return plain text.
- Settings (`ai_settings` table): provider `gemini | apple | agy` (default `gemini`); `agy_model`
  `default | gemini-3.8-flash-low | gemini-3.8-flash-high`. Model IDs already encode effort; never
  also pass `--effort`.
- Streaming: `send_practice_turn`, `continue_coach_turn` and `generate_follow_up` take a Tauri
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
  text, or has produced no text after 1.2 s (the free tier can accept a request and stall for
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
- Tiers, not model IDs, at call sites: `conversation` (fast) and `coaching` (quality, not yet on
  Gemini).

## 6. Coaching, help and review providers

- `get_turn_feedback(question, transcript)` → `TurnFeedback { focus_feedback[], b2_rewrite }`
  parsed with `deny_unknown_fields`.
- `retry_practice_turn` saves a second attempt and returns a local `AttemptComparison`
  (`target_evidence`: `already_present_in_both | newly_observed_in_retry | partially_observed |
  not_observed | uncertain`, word-count change).
- `get_guided_answer(session_id, sequence, question)` → `{ model_answer, adaptation }` for the
  active unanswered prompt only. Rust checks session, sequence, exact question and pending Coach
  review. The cue exposure is saved **before** generation; a stale result cannot supply help for
  another turn. Failure does not change the session.
- **Target [F5]:** feedback runs automatically after each saved answer, in parallel with the reply,
  and returns a natural rephrasing plus at most one focus point.
- **Target [F6]:** a help bundle `{ frame[3], phrases[3..5], model_answer, adaptation }` is
  prefetched when a question appears. Opening any level records a cue exposure.
- **Target [F7]:** rescue requests carry the partial transcript and return one suggestion; they
  record a cue exposure.

## 7. Sessions and input provenance

- Modes: `conversation` (eight-answer goal; target [F8] is time-based) and `coach` (four answers,
  explicit Continue). Target [F5] retires `coach` as a separate mode; saved sessions stay readable.
- `get_practice_dialogue(session_id)` returns `{ session_id, opening_question, turns,
  input_sources, reply_times_ms, answer_durations_ms, help_used }` for the active session only; a
  pending Coach answer has empty assistant fields. The last three are aligned with `turns`:
  time to Eva's first words (falls back to total provider latency; `null` for older turns), spoken
  answer length (`null` for typed or older answers) and whether help was opened for that answer.
  Schema version 10 adds nullable `turns.reply_ms` and `turns.answer_duration_ms` and the
  `answer_help_uses(session_id, sequence)` table. `send_practice_turn` takes an optional
  `answer_duration_ms` (voice and edited answers only). `record_answer_help_used(session_id,
  sequence)` is idempotent and rejects other sessions and any sequence but the pending answer; it
  records only and changes no learning or mastery rule.
- `send_practice_turn` and `save_coach_answer` take an optional `input_source`
  (`voice | edited | text`; omitted means `text`), saved atomically with the answer in
  `turn_input_sources`. Failed provider calls save nothing.
- Voice auto-send applies only to a new successful transcription and only when enabled. Drafts stay
  in memory; no browser persistence of answers.
- A session has at most one in-flight provider request; duplicate or stale submissions are rejected.

## 8. Persistence

SQLite at `<app data>/english-trainer.sqlite3`. Current tables:

| Group | Tables |
| :--- | :--- |
| Sessions | `sessions`, `turns`, `turn_input_sources`, `answer_help_uses`, `turn_feedback`, `attempt_comparisons`, `session_cue_exposures`, `session_phrase_recalls` |
| Memory | `mistakes`, `mistake_occurrences`, `phrase_cards`, `review_events`, `memory_review_runs`, `memory_review_items` |
| Usage evidence | `turn_usage_assessments`, `learning_usage_events`, `learning_usage_counter_baselines` |
| Settings | `ai_settings` |

- Migrations are additive and idempotent; tests cover upgrade from older schemas.
- Writes that change learning state (answer + source, review + schedule, assessment + evidence +
  projection) are single transactions.
- Raw audio is never stored. API keys are never stored in SQLite.

## 9. Learning rules

### 9.1 Scheduling

- Self-reported review: "need practice" → interval 1 day, status `learning`; "remembered" →
  interval 2 → 4 → previous × ease (4–365 days), ease +0.1 up to 3.0. `new → learning`;
  `learning → improving` once the interval reaches 4 days; self-report never sets `stable`.
- Spoken recall (daily recall, Memory review) saves transcript wording evidence and the schedule
  change atomically. Wording match is transcript evidence, not mastery.

### 9.2 Usage review and mastery (frozen subsystem)

1. **Eligibility:** saved first-pass `conversation` answers 1 and 2 only; Coach answers, retries and
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
- Current commands: `transcribe_audio`, `get_setup_diagnostics`, `get_ai_settings`,
  `save_ai_settings`, `prewarm_conversation_provider`, `get_gemini_key_status`,
  `save_gemini_api_key`, `delete_gemini_api_key`, `generate_follow_up`, `start_practice_session`, `get_active_practice_session`,
  `send_practice_turn`, `save_coach_answer`, `continue_coach_turn`, `get_practice_dialogue`,
  `finish_practice_session`, `get_turn_feedback`, `save_practice_feedback`, `retry_practice_turn`,
  `get_question_scaffold`, `get_guided_answer`, `record_answer_help_used`, `get_daily_recall_plan`, `submit_daily_recall`,
  `save_phrase_card`, `get_learning_memory`, `view_learning_memory`, `submit_learning_review`,
  `start_memory_review`, `get_memory_review`, `submit_memory_recall`, `finish_memory_review`,
  `review_practice_memory_usage`, `get_practice_memory_usage`, `get_memory_usage_evidence`.
- Long-running commands are `async` and run blocking work with `spawn_blocking`.

## 11. Setup diagnostics

`get_setup_diagnostics` reports paths and readability of `whisper-cli`, the Whisper model and
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
- Audio is transcribed locally and discarded; failed transient attempts stay in memory for retry
  until reset or close.
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
