# Migration to the target architecture

The app is feature-complete and in daily use, so it is rewritten **incrementally** (strangler fig):
new structure grows beside the legacy code, one slice at a time, and the app keeps working after
every commit. There is no long-lived rewrite branch.

Targets: [`FRONTEND.md`](FRONTEND.md), [`EFFECT.md`](EFFECT.md), [`BACKEND.md`](BACKEND.md).

## 1. Rules while both worlds exist

- **Legacy paths** are listed in `biome.json` (`overrides` → "legacy") and are exempt from the new
  layer, naming and function-style rules. The list only ever shrinks.
- New code goes into the new structure only. Do not add files to legacy folders except to fix a bug.
- Legacy code may import the new structure (`@/features/x`, `@/core/...`) through public APIs. New
  code never imports legacy folders (`@/lib`, `@/components`, `@/context`, `@/audio`,
  `@/theme`, legacy `@/features/*`); Biome enforces this.
- A slice is migrated when its old files are **deleted**, not when a new copy exists.
- Behaviour is preserved: a migration commit changes no product behaviour, copy or styling. Fixing
  a bug found on the way is a separate commit that starts with a failing test.
- Rust: a context is migrated when it follows `BACKEND.md` §1 and its `mod.rs` carries the strict
  lint attribute. Its commands move out of `lib.rs`; its errors stop using `ProviderError`.

## 2. Definition of done for one slice

1. Files moved into the target layout; old files deleted; imports updated.
2. Side effects through Effect services; state in atoms; no `useEffect` data loading left.
3. IPC types come from `core/ipc/bindings` + schemas; the slice's hand-written guards deleted.
4. Tests: helpers have unit tests, the feature has behaviour tests in `tests/`, existing e2e flows
   pass unchanged.
5. The slice's paths removed from the legacy list in `biome.json`.
6. `bun run verify` passes; the touched flow is checked by hand in the desktop app
   (`bun run dev`) and the commit message says what was checked manually.

## 3. Order

Each step is one commit of meaningful size (or a few, if a step is large). The order front-loads
infrastructure and leaves the riskiest area — the real-time Talk loop — for last, when the patterns
are proven.

| # | Step | Frontend | Rust |
| :--- | :--- | :--- | :--- |
| 0 | Foundation + pilot (this branch) | tooling, `core/ipc`, `core/runtime`, `RegistryProvider`, `features/gemini-key` | `core::IpcError`, ts-rs, `gemini_key` context with its commands |
| 1 | Shared kit + e2e layout | `theme/` → `shared/theme`, generic `components/` → `shared/ui`, generic `lib/` helpers → `shared/helpers`; `e2e/` → `fixtures/ pages/ components/ data/ specs/` (TESTING.md §3) | — |
| 2 | Settings slices | each settings group becomes a feature (`appearance`, `privacy`, `translation-settings`, `ai-provider`, …); `screens/settings` composes them | `ai_settings`, `api_usage`, `setup` contexts |
| 3 | Small features | `coach` → `features/coaching-note`, `talk-start`, `first-run` (+ `screens/first-run`) | `translation` |
| 4 | Core audio & speech | `audio/` → `core/audio` with Scope-managed microphone; `speech/` → `core/speech` (TTS, STT client, live transcript as `Stream`) | `audio` → `speech` context (whisper server as an `infra` adapter) |
| 5 | Memory | `memory` → `features/memory-library`, `features/spoken-review`; `screens/memory` | `learning`, `persistence` split into context repositories |
| 6 | Talk | `practice` split into features (`practice-session`, `dialogue`, `composer`, `answer-help`, `rescue`, `wrap-up`, …); `screens/talk`; delete `TrainerContext` | `conversation`: split `SessionStore` into services; queues behind ports |
| 7 | Ratchet | delete the legacy override from `biome.json`; enable `knip` in CI | move strict lints into `Cargo.toml [lints]`; remove `ProviderError` from non-provider code and the `ProviderError ↔ IpcError` bridge from `core` (core must not depend on a context) |

Steps 1–3 can be reordered freely; 4 must precede 5 and 6.

## 4. Mapping legacy → target

| Legacy | Target |
| :--- | :--- |
| `src/lib/*Types.ts` + `is*` guards | `src/core/ipc/bindings` (generated) + `src/core/ipc/schemas` |
| `src/lib/*` (preferences, formatting) | `src/core/storage`, `src/shared/helpers/<name>` |
| `src/features/*/…Api.ts`, `sessionApi.ts` | feature `services/*-service.ts` |
| `src/features/*/use*.ts` hooks | feature `model/atoms.ts` (+ `helpers/` for the pure parts) |
| `src/features/*/lib/*` | feature `helpers/<name>/` |
| `src/context/TrainerContext.tsx` | atoms in the owning features/core; screens read them directly |
| `src/components/*` | `src/shared/ui/<name>` (generic) or the feature that owns it |
| `src/router.tsx`, `src/App.tsx` | `src/app/router`, `src/app/providers`, `src/app/shell` |
| `src-tauri/src/lib.rs` commands | `src-tauri/src/<context>/commands.rs` |
| `ProviderError` for non-provider failures | the context's `thiserror` enum → `IpcError` |
