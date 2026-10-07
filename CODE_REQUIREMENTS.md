# CODE_REQUIREMENTS.md

How code in this repository is written. *What* the app does and *why* it is built this way is in
[`docs/PRODUCT_SPEC.md`](docs/PRODUCT_SPEC.md), [`docs/ROADMAP.md`](docs/ROADMAP.md),
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), and [`docs/TECHNICAL_REQUIREMENTS.md`](docs/TECHNICAL_REQUIREMENTS.md).
The bar: a reviewer signs off without a follow-up conversation.

Everything in the repository is English.

## 1. Where code lives

```
src/
  App.tsx               app providers and window layout
  router.tsx            TanStack Router route tree
  components/           shared by more than one feature (HeroUI-based; `eva/` is the mascot)
  context/              app-wide React context; may import feature hook *types* only
  theme/                design tokens (`theme.css`) and the light/dark switch (`applyTheme.ts`)
  audio/                shared microphone capture, device preference, signal diagnostics (Web Audio)
  lib/                  shared and DOM-free: IPC types (`*Types.ts`), settings, formatting
  features/<feature>/   one user-facing area: practice, conversation, coach, memory, speech,
                        talk-start, first-run, settings
    components/         that feature's components
    lib/                that feature's pure logic, tests beside it
src-tauri/src/          session orchestrator, local STT, providers, learning engine, SQLite
src-tauri/apple/        Swift helper for Apple Foundation Models, compiled at build time
src-tauri/tests/        pipeline integration tests against a temp database and a fake provider (added with F1)
e2e/                    Playwright against Vite / Tauri, command layer faked (added after F5)
```

- Code starts in the feature that uses it and moves to `components/` or `lib/` when a second
  feature needs it — not before.
- Features depend one way: `practice → conversation, coach, memory, speech`,
  `coach → speech`, `memory → speech`, `talk-start → memory`, `first-run → settings, speech, memory`; features are leaves otherwise.
  No cycles, and `components/`, `audio/` and `lib/` never import a feature. (The current
  `coach → practice` imports are a known violation, removed in F5.) When two features
  need each other, the shared part belongs in `components/` or `lib/`.
- Import through `@/…`; only files in the same folder import each other relatively. No barrels.
- Split growing modules and components by responsibility or job (`orchestrator/session.rs`),
  never by technical kind (`hooks/`, `helpers/`).
- A Rust module split into a directory re-exports its public surface from `mod.rs`, so callers
  keep writing `orchestrator::start_session` whichever file it lives in.
- **Rust owns state, learning decisions, and persistence.** Rust owns sessions, speech metrics,
  provider calls, spaced repetition (SRS), and SQLite. The UI is a thin declarative presentation
  layer that renders results and captures user input. A rule the UI needs without a round trip
  lives in `src/lib/`, once, and names its Rust counterpart.
- **Separation of conversation from evaluation:** Fast dialogue turns (`next_turn`) must never
  wait for deep feedback evaluation (`evaluate_turn`). Conversation responsiveness comes first.

## 2. Functional principles & State

- **Pure logic separation:** Calculations (SRS intervals, metric aggregations, score derivations,
  text normalization) are pure, side-effect-free functions in `lib/` or Rust. Needing a DOM for a
  unit test means logic is in the wrong place.
- **Discriminated unions over boolean flags:** States are tagged unions, not bags of flags.
  Model UI and session lifecycle as explicit variants (e.g. `idle | recording | transcribing |
  thinking | speaking | feedback | error`). Make illegal states unrepresentable.
- **Parse, don't validate at boundaries:** Whatever is read from the outside (IPC payloads,
  `localStorage`, STT transcripts, LLM JSON) is `unknown` until narrowed by type guards or
  validated by Zod / serde. Narrow, don't cast (`as`).
- **Immutability & derived values:** Treat state as immutable. Compute derived values during
  render; never mirror or synchronize state via `useEffect`.
- **Effects only at the edges:** Effects strictly synchronize with outside systems (`invoke()`,
  Web Audio hardware, timers, DOM) and must always clean up listeners, streams, and intervals.

## 3. Types, IPC, and Errors

- `strict`; no `any`, no non-null `!`, no `as` to silence the compiler. Narrow or validate.
- Tauri IPC is a versioned contract: when a Rust struct crosses `invoke()`, update its TypeScript
  type in `src/lib/` (`types.ts` or the matching `*Types.ts`) in the same commit.
- Fields that cross `invoke()` stay `snake_case` on both sides; do not rename them to camelCase in TS.
- Units explicit in names: `durationMs`, `sampleRateHz`, `wordsPerMinute`, `dueAt`.
- Never swallow an error. An empty `catch` is only for failures that are harmless by design
  (storage unavailable), and says so.
- Rust: typed error values with a `code` across IPC (`TranscriptionError`, `ProviderError`, and
  dedicated session/persistence errors as they are split out). Each error message says what was
  being done and how to recover. TS branches on typed error codes, NEVER matches on message
  strings.
- Parse model output into typed Rust structures. Invalid output is a recoverable provider error,
  never a panic or a partially accepted learning result.

## 4. Audio, Privacy, and macOS

- Push-to-Talk first. Capture 16-bit mono PCM normalized to 16 kHz via Web Audio / AudioWorklet;
  never assume `MediaRecorder` emits a specific format in WebKit.
- Transcribe locally with Whisper and discard raw PCM by default. Storing audio requires an explicit
  user setting. Send the configured LLM provider only the transcript and prompt context needed.
- LLM providers: Apple Foundation Models (bundled helper) and the Gemini API are the target
  real-time providers; API keys live in an encrypted, owner-only file in the app data folder, never in SQLite,
  logs or the repository. The legacy Antigravity CLI (`agy`) runs only in private scratch directories with
  bounded timeouts; never pass the repository as its working directory.
- macOS companion: Ambient prompts, notifications, and autostart are opt-in and respect quiet
  hours. Normal practice never requires Accessibility or Screen Recording permissions.
- Honest metrics: Internal scores are CEFR-inspired trend indicators, never presented as official
  CEFR certifications or Whisper transcription as phoneme-level pronunciation grading.

## 5. React & UI

- Function components, props typed inline or as a local `Props`. No classes except `ErrorBoundary`.
- No effect for derived state — compute during render.
- No `useMemo` / `useCallback` by reflex; only for a measurable cost or a dependency that must stay
  stable.
- One level of ternary in JSX. Past that, return early or extract a component.
- Read `event.target.value` into a local variable before `setState`.
- Keep controls accessible and semantic.

## 6. Shape & Naming

- Guard clauses over deep nesting.
- More than ~4 parameters: an options object in TS, a struct in Rust.
- Export what is used, nothing speculative. No dependency for what the platform or an installed
  package already does.
- Model tiers, not model ids, at call sites.
- `camelCase` values and functions, `PascalCase` types and components, `SCREAMING_SNAKE_CASE`
  module constants. Rust follows `rustfmt`.
- Booleans read as assertions: `isRecording`, `hasNotes`, `canStart` — never `flag` or `status`.
- `handleX` implements, `onX` is the prop.
- Components `PascalCase.tsx`; other modules lowercase, named for what they do. No `utils.ts`
  dumping ground.
- Comments explain the *why*: a platform workaround, a constraint from `agy` or macOS, a choice
  that looks wrong and is not. Never restate code, narrate history, or leave a `TODO`. Every
  `biome-ignore` states its reason.

## 7. Tests

| What | Where | Command |
|---|---|---|
| Pure TS logic | `*.test.ts` beside it in a `lib/`, no DOM | `bun test` |
| Rust logic | `#[cfg(test)] mod tests` beside the code | `bun run test:rust` |
| End-to-end pipeline (from F1) | `src-tauri/tests/pipeline.rs` | `bun run test:rust` |
| User flows (after F5) | `e2e/*.e2e.ts` | `bun run test:e2e` |

- To test logic, move it out of the component into a `lib/` or Rust. Needing a DOM for a unit
  test means the logic is in the wrong place.
- No mocks of code we own. Seams are faked only at the edge: providers (`agy` through
  `ENG_TRAINER_AGY_BIN`, a fake engine for streaming providers) and, in E2E only, `invoke()`, whose
  fixtures are typed against `src/lib/` types.
- E2E covers flows, not details. Select by role and visible English text, never by class name.
- Every bug fix starts with a test that reproduces it.
- No snapshot tests of rendered output.
- Manual speech checks on physical Mac are required for microphone permissions, local STT, TTS,
  and perceived turn latency; a green unit test does not validate those experiences.
- Automated verification runs via Lefthook pre-commit hooks and GitHub Actions CI.
