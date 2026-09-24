# Code Requirements

Engineering conventions for English Trainer. Product behavior and priorities live in
[`docs/PRODUCT_SPEC.md`](docs/PRODUCT_SPEC.md) and [`docs/ROADMAP.md`](docs/ROADMAP.md);
the intended boundaries and contracts live in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
and [`docs/TECHNICAL_REQUIREMENTS.md`](docs/TECHNICAL_REQUIREMENTS.md).

## Scope and structure

- The repository is currently a Tauri starter. The stack in the docs is a target, not a claim
  that every library or subsystem is already installed.
- Keep React components, recording controls, and view state in `src/`. Put reusable frontend
  logic near its first consumer; move it to a shared module when another feature needs it.
- Keep Tauri commands thin. Put session orchestration, persistence, learning decisions, speech
  metrics, and provider adapters in focused Rust modules under `src-tauri/src/` as they appear.
- Domain and learning code depends on provider interfaces, not a particular CLI or model name.
  Keep conversation generation separate from deeper feedback so evaluation cannot block the
  next spoken turn.
- Prefer small files organized by responsibility. Aim for at most 300 lines per code file;
  split a growing module where its responsibilities naturally divide.
- Add dependencies only for a concrete feature. Do not create the full planned directory tree
  before it is used.

## Types and contracts

- Keep TypeScript strict. Avoid `any`, unchecked non-null assertions, and casts used only to
  silence errors. Validate data from storage, IPC, and providers at the boundary.
- Treat Tauri IPC as a versioned contract. When a command or serialized Rust type changes,
  update its TypeScript type and callers together. Use explicit names for units such as
  `durationMs` and `sampleRateHz`.
- Parse model output into typed Rust structures. Invalid output is a recoverable provider error,
  never a panic or a partially accepted learning result.
- Use typed error categories when the UI needs different recovery actions. Show a useful retry
  or settings action for microphone, model, provider, and storage failures.
- Persist related learning changes transactionally. Do not silently replace a failed provider
  with behavior that changes learning semantics.

## Audio, privacy, and macOS

- Capture audio with Push-to-Talk first. Do not assume `MediaRecorder` emits a particular PCM
  format in WebKit; normalize input explicitly when the STT provider requires it.
- Transcribe locally and discard raw audio by default. Store a recording only after an explicit
  user setting enables retention. Send the configured LLM provider only the transcript and
  context needed for that request.
- Run `agy` in isolated temporary directories, with bounded timeouts and structured responses.
  Do not grant it the repository as a working directory.
- Ambient prompts, notifications, and launch at login are opt-in. Normal practice must not
  depend on Screen Recording or Accessibility permission.
- Never present internal speaking scores as an official CEFR certification or Whisper
  transcription as phoneme-level pronunciation scoring.

## UI and code style

- Prefer explicit state variants for recording, transcribing, thinking, speaking, and error
  states over combinations of independent booleans.
- Effects synchronize with the outside world and clean up listeners, timers, and audio resources.
  Derive values during render when possible.
- Use accessible controls with visible recording and error states. Keep normal feedback focused
  on the highest-value 1–3 corrections, as specified in the product docs.
- Comments explain non-obvious constraints or decisions. Do not add comments that restate code.
- Use Biome for TypeScript, TSX, CSS, and JSON formatting/linting, and `cargo fmt` / `cargo clippy`
  for Rust. The repository's `biome.json` defines the frontend formatting style.

## Validation

- Test deterministic logic where mistakes are costly: schema parsing, migrations, learning
  transitions, review scheduling, speech metrics, quiet hours, and provider error mapping.
- Use focused integration fixtures for provider and audio boundaries. Add UI flow tests as the
  speaking experience stabilizes; do not require exhaustive UI tests for early exploration.
- For each change, run the checks relevant to touched files. Available commands are
  `bun run check`, `bun run typecheck`, `bun run build`,
  `cargo fmt --manifest-path src-tauri/Cargo.toml --all --check`, and
  `cargo test --manifest-path src-tauri/Cargo.toml` once dependencies are installed.
- Manual speech checks on the target Mac are required for microphone permissions, local STT,
  TTS, and perceived turn latency; a green unit test does not validate those experiences.
