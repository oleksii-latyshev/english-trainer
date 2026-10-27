# CODE_REQUIREMENTS.md

How code in this repository is written. *What* the app does and *why* is in
[`docs/PRODUCT_SPEC.md`](docs/PRODUCT_SPEC.md), [`docs/ROADMAP.md`](docs/ROADMAP.md),
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) and [`docs/TECHNICAL_REQUIREMENTS.md`](docs/TECHNICAL_REQUIREMENTS.md).
This file is the short normative form; the reasoning and examples are in `docs/engineering/`:

- [`FRONTEND.md`](docs/engineering/FRONTEND.md) — layers, feature anatomy, React rules
- [`EFFECT.md`](docs/engineering/EFFECT.md) — services, errors, schemas, atoms, streams, tests
- [`BACKEND.md`](docs/engineering/BACKEND.md) — Rust contexts, layers, errors, ts-rs
- [`TESTING.md`](docs/engineering/TESTING.md) — unit, behaviour, property and E2E (POM + fixtures) patterns
- [`MIGRATION.md`](docs/engineering/MIGRATION.md) — how legacy code moves to the target shape

The bar: a reviewer signs off without a follow-up conversation. Legacy folders (listed in
`biome.json`) are being migrated; new code follows this file.

## Principles

- **English only.** Everything in the repository is English: code, identifiers, UI copy, docs,
  diagrams, test names, commit messages and branch names. The one exception is test data that
  exercises non-English text on purpose (word translation output, rejecting non-English model
  output).
- **Self-describing code, no comments.** Source and config files carry no comments. A name says what
  a value or function is; when a line needs a *why* (a macOS quirk, an `agy` constraint, a case that
  looks wrong), extract it into a function or constant whose name says it
  (`discardInputWarmupFrames()`, `MAC_INPUT_WARMUP_MS`) or into a test whose name states the rule.
  Product constraints belong in `docs/`, not beside the code. Only tool directives remain, and they
  carry their reason as data: `biome-ignore lint/...: <reason>`, Rust `#[expect(lint, reason = "…")]`.
  Generated files are exempt. (`bun run check:conventions`.)
- **KISS.** The simplest code that meets the requirement and reads top to bottom. No speculative
  options, layers or generics (YAGNI); add them with the second real use.
- **DRY of knowledge, not of lines.** Every rule, number and type has one source of truth (Rust
  owns learning rules; bindings are generated; schemas pair with bindings; copy lives in one helper).
  Two similar-looking pieces of code that change for different reasons stay separate.
- **SOLID, as it applies here:**
  - *Single responsibility* — one job per file, function, component, service and Rust module; a
    name that needs "and" is two things.
  - *Open/closed* — new behaviour arrives as a new adapter or variant (a provider implementing the
    engine trait, a new union case handled exhaustively), not as flags inside existing code.
  - *Liskov* — every implementation of a port or service (including test fakes) honours the same
    contract: same errors, same invariants.
  - *Interface segregation* — service shapes and Rust ports stay small and specific to their caller;
    no catch-all `Api` objects.
  - *Dependency inversion* — features and use cases depend on `Context.Service` keys and Rust traits;
    concrete layers and adapters are chosen only in runtimes and `lib.rs`.
- **Every feature explains its flow.** Each feature folder has a `flow.md` with a Mermaid
  `sequenceDiagram` of its data flow (learner → component → atoms → service → IPC → Rust command →
  service → store/provider), updated in the same change that alters the flow.

## 1. Where code lives

```text
src/
  main.tsx      entry
  app/          composition root: providers, router, shell
  screens/      one folder per route; composes features
  features/     user-facing capabilities; never import each other
  core/         app-wide capabilities without UI: ipc (+ generated bindings), runtime, audio, speech, storage
  shared/       product-agnostic: ui kit, theme, pure helpers
src-tauri/src/
  lib.rs        builder only
  core/         IpcError, db, process runner, clock
  <context>/    domain · ports · service · infra · commands · error (BACKEND.md §1)
e2e/            Playwright flows against Vite with typed fake commands
```

- Imports go down only: `app → screens → features → core → shared`. Features never import other
  features; a screen composes them. What two features share moves to `core/` or `shared/`.
- Each feature and core module has one public `index.ts` with explicit named exports. Other layers
  import only that (`@/features/gemini-key`), never a deep path. No other barrels, no `export *`.
- Inside a feature, imports are relative. Across layers, imports use `@/…`.
- Feature anatomy: `components/<name>/index.tsx` (+ `helpers.ts`, `constants.ts`, `types.ts`,
  `styles.ts`), `helpers/<name>/index.ts` (+ `<name>.test.ts`, `types.ts`), `model/` (runtime and
  atoms), `services/` (Effect services), `tests/` (behaviour tests), `flow.md` (sequence diagram).
  Create a file only when it has content.
- Rust: one module folder per bounded context, layered inside; commands are thin; `domain` is pure.
- **Rust owns state, learning decisions and persistence.** The UI renders results and captures
  input. A rule the UI needs without a round trip lives once in a feature `helpers/` and names its
  Rust counterpart.
- **Conversation never waits for evaluation:** `next_turn` never waits for coaching, help or wrap-up.

## 2. TypeScript style

- Named functions are declared with `function`, never `const f = () =>`. Arrow functions are for
  inline callbacks only. (Biome plugin `function-declarations`.)
- Types are declared with `type`, never `interface`. No `enum`: use string-literal unions.
- Named exports only; no default exports (except where a tool requires one, e.g. config files).
- `strict`; no `any`, no non-null `!`, no `as` to silence the compiler. Outside data is `unknown`
  until decoded by a Schema.
- Discriminated unions over boolean flags; make illegal states unrepresentable. Branch on unions
  exhaustively (`switch` + `Match` or `satisfies never`).
- Immutable data: `readonly` fields in service shapes and domain types; never mutate state.
- Units in names: `durationMs`, `sampleRateHz`, `wordsPerMinute`, `dueAt`.
- Fields that cross `invoke()` stay `snake_case` as generated; do not rename them.
- Guard clauses over nesting. More than ~4 parameters → an options object.
- Names: `camelCase` values and functions, `PascalCase` types, components, services and errors,
  `SCREAMING_SNAKE_CASE` module constants, `kebab-case` files and folders. Booleans read as
  assertions (`isRecording`, `hasNotes`, `canStart`). Atoms end in `Atom`. `handleX` implements,
  `onX` is the prop.
- No `utils.ts`, `common.ts` or `misc` dumping grounds; a helper is named for its one job.
- No comments and no `TODO`s (see Principles). A long condition or magic value becomes a named
  function or constant.

## 3. Effects, errors and state (frontend)

- Every side effect is an Effect: IPC, storage, timers, audio, speech, events. `Promise`, `async`
  and `try/catch` are not used in `app/ core/ features/ screens/` code; wrap platform promises once
  in a `core` service with `Effect.tryPromise` and a typed error.
- `invoke()` is called only in `core/ipc`. Every result is decoded with the Schema paired with its
  generated binding (`bindingSchema<T>()`).
- Dependencies are `Context.Service` classes provided by `Layer`s. Each feature builds its runtime in
  `model/runtime.ts` on top of `CoreLive`.
- Errors are tagged values in the error channel: `IpcError` (decoded from Rust, branch on `code`),
  `Data.TaggedError` for internal failures. Never throw, never match on message text, never store
  an error as a string. The learner-facing copy is chosen from the tag/code in UI helpers.
- State is atoms: remote data `runtime.atom`, commands `runtime.fn` with `reactivityKeys`, shared
  local state `Atom.make`, derived state derived atoms. `useState` only for ephemeral state owned by
  one component.
- `Effect.run*` only in `app/` and tests. Components never run Effects or call services directly.
- Resources (microphone, worklets, listeners, child processes) are acquired with
  `Effect.acquireRelease`/scoped layers so cleanup is guaranteed; no manual "is current" flags.

## 4. React and UI

- Function components declared with `function`, `type Props`. No classes.
- No `useEffect` for loading or synchronising data; only for DOM synchronisation in `shared/ui` and
  `app/`. No `useMemo`/`useCallback` by reflex.
- Render `AsyncResult` with `AsyncResult.match` so loading, failure and success are all handled.
- One level of ternary in JSX; past that, return early or extract a component.
- Read `event.target.value` into a local variable before using it.
- **Our own UI kit lives in `src/shared/ui/`**, built on unstyled **Base UI** primitives
  (`@base-ui/react`) styled with Tailwind. Need a basic component (button, input, switch, tabs,
  dialog, tooltip, toast, chip, kbd …)? **First look in `src/shared/ui/`. If it is not there, create it
  there** on the matching Base UI primitive (or a plain semantic element when Base UI has none) with
  Tailwind and `tv()` variants — never style a basic control inline inside a feature, never add
  another UI library. A kit component is generic (no product words), accessible, and covers the
  states the design needs (hover, focus-visible, disabled, pressed). HeroUI is removed; importing
  `@heroui/*` anywhere in `src/` fails `bun run check:conventions`.
- Styling is **Tailwind utility classes only**. No `.css` files except the one global stylesheet
  `src/app/styles.css` (Tailwind import, fonts, design tokens as `@theme` variables, the
  light/dark sets). Colours, radii and blur come from tokens (`bg-surface`, `text-muted`), never hex
  values or arbitrary `[...]` classes. A component with variants or long class lists defines them
  with `tv()` from `@/shared/ui/tv` in its `styles.ts`.
- Controls are accessible and semantic.

## 5. Rust

- Errors: one `thiserror` enum per context; `IpcError { code, message }` is the only error that
  crosses `invoke()`. Messages say what failed and how to recover; details go to the log.
- No `unwrap`/`expect`/`panic!` outside tests (strict lint attribute in migrated contexts).
- Types that cross `invoke()` or a `Channel` derive `ts_rs::TS` with `#[ts(export)]`; regenerate
  bindings with `cargo test` and commit them in the same commit as the Rust change.
- Provider output is parsed into typed values; invalid output is a recoverable typed error, never a
  panic or a partially accepted learning result.
- Blocking work runs in `spawn_blocking`; a lock is never held across a provider call.
- Call sites choose a model **tier**, not a model id.

## 6. Audio, privacy and macOS

- Push-to-talk first. Capture 16-bit mono PCM normalised to 16 kHz via Web Audio/AudioWorklet;
  never assume `MediaRecorder` emits a specific format in WebKit.
- Transcribe locally with Whisper and discard raw PCM by default. Storing audio requires an
  explicit user setting. Providers receive only the transcript and the prompt context needed.
- LLM providers: Apple Foundation Models (bundled helper) and the Gemini API are the real-time
  providers. API keys live in an encrypted, owner-only file in the app data folder — never in
  SQLite, logs or the repository. The Antigravity CLI (`agy`) runs background work only, in private
  scratch directories with bounded timeouts, never with the repository as its working directory,
  and every call names a Gemini model (`CliOptions.model` is required).
- Ambient prompts, notifications and autostart are opt-in and respect quiet hours. Practice never
  requires Accessibility or Screen Recording permission.
- Honest metrics: scores are CEFR-inspired trend indicators, never official CEFR results; Whisper
  output is never presented as phoneme-level pronunciation grading.

## 7. Tests

Patterns and examples: [`TESTING.md`](docs/engineering/TESTING.md).

| What | Where | Command |
| :--- | :--- | :--- |
| Pure helpers (+ properties) | `helpers/<name>/<name>.test.ts` | `bun test` |
| Feature behaviour | `features/<x>/tests/*.test.ts` — atoms + test layers, no DOM | `bun test` |
| Rust domain and services | `#[cfg(test)]` beside the code, fakes for ports | `bun run test:rust` |
| Pipeline | `src-tauri/tests/pipeline.rs` | `bun run test:rust` |
| User flows | `e2e/specs/*.e2e.ts` | `bun run test:e2e` |

- Unit and behaviour tests: the name states the behaviour; Arrange · Act · Assert with one act; inputs
  from test data builders with valid defaults (`aSession({ turn_count: 3 })`); `test.each` for tables of
  cases; property tests (`Arbitrary.schema` + `Arbitrary.checkEffect`) for normalisation, parsing and
  scheduling invariants; `TestClock` instead of real time.
- E2E follows the [Page Object Model](https://playwright.dev/docs/pom) **with fixtures**: specs get page
  objects and per-area fake-backend controllers from `test.extend` fixtures and contain only intent and
  `expect`s; page objects own one screen; reusable widgets are component objects composed into pages, so
  no page class grows past ~150 lines. Locate by role and visible English text, never by class; no
  `waitForTimeout`.
- Fake only edges: `Ipc`, hardware, time, provider processes. No mocks of code we own.
- Assert typed errors by tag or code, never by message text.
- Every bug fix starts with a test that reproduces it. No snapshot tests of rendered output.
- Microphone permission, local STT, TTS and perceived latency are checked by hand on a physical
  Mac; a green unit test does not validate them.

## 8. Tooling

- `bun run verify` runs everything CI runs. Lefthook runs Biome, typecheck, Knip, unit tests and
  Rust checks before each commit.
- Biome is the only formatter and linter for TS/JSON/CSS; `rustfmt` and Clippy (`-D warnings`) for
  Rust. Do not disable a rule to make code pass; fix the code or, if the rule is wrong for a line,
  add a `biome-ignore` with the reason.
- Knip (`bun run check:knip`) rejects unused files, exports and dependencies; delete the dead code or
  drop the `export`, and keep `knip.json` ignores to generated code only.
- Two TypeScripts are installed on purpose. `typecheck` and `typecheck:e2e` run TypeScript 7, the
  native compiler (`typescript-native`, about 7× faster). The root `typescript` stays on 6.x because
  `@effect/language-service` (`check:effect`) and the editor's tsserver need its JS API, which
  TypeScript 7 does not ship. Dependabot ignores majors of the root `typescript`. Drop 6.x once the
  Effect language service supports TypeScript 7.
- Generated files (`src/core/ipc/bindings`, `src-tauri/gen`) are never edited by hand.
- Third-party GitHub Actions are pinned to a commit SHA with the version as the trailing
  `# vX.Y.Z` marker Dependabot reads; never a moving tag.
- No dependency for what the platform or an installed package already does. Versions of `effect`
  and `@effect/atom-react` are pinned exactly and upgraded together.
