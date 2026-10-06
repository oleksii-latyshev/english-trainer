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
- Readiness: Recording begins only after the input delivered three seconds of frames (including
  silence); startup times out after eight seconds and releases capture. Warm-up samples are not part
  of the answer. **Target [F3]:** one warm stream per session replaces the per-answer warm-up.
- The Settings microphone check uses the same recorder, stops after ten seconds, offers local
  playback and discard only, and shows per-second amplitude, captured vs elapsed duration and
  reported processing flags. It never transcribes, calls a provider or saves audio. Device changes
  and checks are blocked while practice capture is active.
- **Target [F4]:** optional voice activity detection with a configurable end-of-turn pause
  (default ~1.5 s) and a "keep listening" control; push-to-talk remains available.

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
- **Target [F2]:** the reply is spoken sentence by sentence as it streams in.

## 5. Conversation providers

### 5.1 Current contract

- `ConversationContext`: `opening_question`, up to 8 `recent_turns` (learner, assistant reply,
  assistant question), `latest_transcript` (1–4,000 characters), up to 2 `learning_targets`.
  Total context at most 8,000 characters; the oldest turns are dropped first.
- `ConversationTurn`: `spoken_reply` (one statement, ≤ 30 words), `question` (one question ending
  in `?`, ≤ 20 words), `provider_latency_ms`.
- Settings (`ai_settings` table): provider `agy | apple`; `agy_model`
  `default | gemini-3.8-flash-low | gemini-3.8-flash-high`. Model IDs already encode effort; never
  also pass `--effort`.
- `agy` runs with `--print`, `--json-schema`, `--sandbox`, `--disable-slash-commands`, a log file,
  in a private temporary directory. Both attempts share one 45 s budget. Invalid output returns a
  typed error with `reply_stage` (`envelope`, `schema`, `content`); provider output is never stored.
- Apple runs the bundled helper with the prompt on stdin; unavailability reasons map to typed
  `unavailable` errors. Apple failures never fall back to sending the transcript to `agy`.

### 5.2 Target [F1]

- Engine output is a stream of text chunks delivered to the UI through a Tauri `Channel`, followed
  by a final event with the complete reply, `first_token_ms` and `total_ms`.
- The reply is plain text: one or two short sentences and one question. Rust trims to a length cap,
  strips markdown and rejects only empty output.
- Apple adapter: one helper process per app run speaking JSON lines; `prewarm()` when a session
  opens; `streamResponse`; restart once if the process exits.
- Gemini API adapter: `streamGenerateContent` over HTTPS with a request timeout; the key is read
  from the OS credential store (`keyring` crate; service `com.user.english-trainer`, account
  `gemini-api-key`), with `ENG_TRAINER_GEMINI_API_KEY` as a developer override; the key is sent only
  in the `x-goog-api-key` header, never in a URL; errors map to `unavailable`, `unauthorized`, `rate_limited`, `timeout`,
  `invalid_output`.
- Tiers, not model IDs, at call sites: `conversation` (fast) and `coaching` (quality).
- The learner's answer is saved only after a complete reply; on failure it stays editable.

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
  input_sources }` for the active session only; a pending Coach answer has empty assistant fields.
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
| Sessions | `sessions`, `turns`, `turn_input_sources`, `turn_feedback`, `attempt_comparisons`, `session_cue_exposures`, `session_phrase_recalls` |
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
  `save_ai_settings`, `generate_follow_up`, `start_practice_session`, `get_active_practice_session`,
  `send_practice_turn`, `save_coach_answer`, `continue_coach_turn`, `get_practice_dialogue`,
  `finish_practice_session`, `get_turn_feedback`, `save_practice_feedback`, `retry_practice_turn`,
  `get_question_scaffold`, `get_guided_answer`, `get_daily_recall_plan`, `submit_daily_recall`,
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
  storage; API key in the OS credential store (Keychain on macOS).

## 14. Testing

- Rust unit tests beside the code for parsers, validation, scheduling, migrations and transactions.
- Fake providers at the edge: `ENG_TRAINER_AGY_BIN` for `agy`; **target [F1]** a fake streaming
  engine for a pipeline test in `src-tauri/tests/`.
- Live provider checks are `#[ignore]` and run explicitly with synthetic input only.
- Manual checks on a physical Mac are required for microphone, STT quality, TTS and perceived
  latency; a green unit test does not prove them.
