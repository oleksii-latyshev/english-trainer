# English Trainer agent guide

## Read first

- `docs/PRODUCT_SPEC.md` — learning behaviour; `docs/ROADMAP.md` — current priority;
  `docs/ARCHITECTURE.md` — runtime boundaries; `docs/TECHNICAL_REQUIREMENTS.md` — contracts.
- `CODE_REQUIREMENTS.md` — how code is written (normative). Before writing frontend code read
  `docs/engineering/FRONTEND.md` and `docs/engineering/EFFECT.md`; before Rust code,
  `docs/engineering/BACKEND.md`; before moving legacy code, `docs/engineering/MIGRATION.md`.
- The reference implementation of every pattern is the pilot slice: `src/features/gemini-key`,
  `src/core/ipc`, `src/core/runtime`, `src-tauri/src/gemini_key`, `src-tauri/src/core`. Copy its
  shape rather than the legacy code next to it.

## Product invariants

- macOS-first Tauri v2 app. React/TypeScript owns UI and audio controls; Rust owns sessions,
  providers, persistence, metrics and learning decisions. IPC types are generated from Rust (ts-rs)
  and decoded with Effect Schema.
- Preserve the core loop: speak → fast AI reply → inline rephrasing → speak again → remember and
  review. The conversation never waits for coaching or help. Practice content is English only.
- Local STT and local SQLite are defaults. Discard raw audio after transcription unless the user
  enables retention. Ambient prompts and notifications are opt-in.
- Real-time AI providers are Apple Foundation Models (bundled helper) and the Gemini API;
  Antigravity CLI (`agy`) is a legacy background adapter. These are app runtime providers, not
  coding workers. Keep them behind engine traits and verify real API/CLI behaviour and latency
  before relying on it.

## Working in the code

- The codebase is mid-migration. Legacy folders are listed in `biome.json`; new code never goes
  there and never imports them. When a task touches a legacy slice, either work within it or
  migrate the whole slice per `MIGRATION.md` §2 — never half-move it.
- Everything is English. Code is self-describing with no comments; SOLID, KISS, DRY of knowledge
  (CODE_REQUIREMENTS › Principles). Every feature has a `flow.md` sequence diagram.
- Frontend: layers `app → screens → features → core → shared`, features never import each other,
  side effects are Effects, state is atoms, errors are tagged values, functions use `function`,
  types use `type`, files are `kebab-case`.
- Rust: one context folder layered `domain · ports · service · infra · commands · error`; commands
  thin; `IpcError` is the only error over IPC; IPC types derive `ts_rs::TS`. After changing such a
  type run `bun run test:rust` and commit the regenerated `src/core/ipc/bindings` with it.
- Look things up instead of guessing: Effect 4 APIs differ from Effect 3 (e.g. `Context.Service`,
  `Schema.Literals`, atoms in `effect/reactivity`). Before using an API you have not seen in this
  repo, check the pilot, the relevant section of `node_modules/effect/AGENTS.md` (the official guide
  shipped with the package) or `node_modules/effect/dist/*.d.ts`.
- Task recipes live in `.agents/skills/` (`feature`, `effect`, `e2e`, `writing`, `dod`); use the one
  that matches the task.

## Done

- One roadmap feature or one migration step = one commit of meaningful size. A feature is not
  accepted because code exists; acceptance is checked in the built app on a physical Mac.
- Run the checks relevant to the change (`bun run verify` runs all of them). Report what was
  verified automatically and what by hand.

## Codebase Memory

This repository refreshes its Codebase Memory index after Git checkout and merge via Lefthook.
Before relying on graph results after ordinary file edits, check index freshness and run
`codebase-memory-mcp cli index_repository --repo-path "$PWD"` when it is stale. Verify graph
conclusions in current source. Do not enable global auto-indexing or watching for this project.
