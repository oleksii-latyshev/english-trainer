# Migration to the target architecture

The app is feature-complete and in daily use, so it is rewritten **incrementally** (strangler fig):
new structure grows beside the legacy code, one slice at a time, and the app keeps working after
every merged PR. There is no long-lived rewrite branch.

**Refactor and redesign happen in one pass.** Each step rebuilds a slice in the target architecture
*and* in the approved glass design ([canvas](https://claude.ai/artifact/2JbngoUp7LVQToZZgzzmuK),
summarised in [`DESIGN.md`](../DESIGN.md)), so no screen is rewritten twice. Until a screen's step
lands it keeps its old layout but already uses the new palette through the shared tokens.

Targets: [`FRONTEND.md`](FRONTEND.md), [`EFFECT.md`](EFFECT.md), [`BACKEND.md`](BACKEND.md).

## 1. Rules while both worlds exist

- **Legacy paths** are listed in `biome.json` (`overrides` → "legacy") and are exempt from the new
  layer, naming and function-style rules. The list only ever shrinks.
- New code goes into the new structure only. Do not add files to legacy folders except to fix a bug.
- Legacy code may import the new structure (`@/features/x`, `@/core/...`) through public APIs. New
  code never imports legacy folders (`@/lib`, `@/components`, `@/context`, `@/audio`,
  legacy `@/features/*`); Biome enforces this.
- A slice is migrated when its old files are **deleted**, not when a new copy exists.
- Behaviour is preserved: a step changes the look to its canvas boards, never product behaviour.
  Copy changes only where a board changes it. Fixing a bug found on the way is a separate issue
  that starts with a failing test.
- Rust: a context is migrated when it follows `BACKEND.md` §1 and its `mod.rs` carries the strict
  lint attribute. Its commands move out of `lib.rs`; its errors stop using `ProviderError`.

## 2. Definition of done for one slice

1. Files moved into the target layout; old files deleted; imports updated.
2. Side effects through Effect services; state in atoms; no `useEffect` data loading left.
3. The screen matches its canvas boards (dark, and light where a light board exists); every element
   on the boards is built or tracked in an issue.
4. Controls come from `src/shared/ui` (Base UI + Tailwind); no HeroUI imports and no `.css` files
   left in the slice.
5. IPC types come from `core/ipc/bindings` + schemas; the slice's hand-written guards deleted.
6. Tests: helpers have unit tests, the feature has behaviour tests in `tests/`, existing e2e flows
   pass unchanged.
7. The slice's paths removed from the legacy list in `biome.json`.
8. `bun run verify` passes; the touched flow is checked by hand in the desktop app
   (`bun run dev`) and the commit message says what was checked manually.

## 3. Order

One issue per step (milestone *Architecture migration*), each merged as one PR. Infrastructure and the
shell come first; the real-time Talk loop comes last, when the patterns are proven. Feature requests
for a screen are built inside that screen's step.

| # | Step | Issue | Canvas boards | Folds in |
| :--- | :--- | :--- | :--- | :--- |
| 0 | Foundation + `gemini-key` pilot | #1 (done) | — | — |
| 1 | Glass UI kit, tokens, SF Pro; HeroUI removed; e2e layout | #15 (done), #34 | Glass components & tokens | — |
| 2 | App shell, Eva (Mochi + sprout), app and Dock icon | #21 | Talk, Start, Icon, Components | — |
| 3 | Settings | #22 | Settings › Eva, Settings — all sections | #14 voice picker |
| 4 | First run | #23 | First run | — |
| 5 | Start screen with speaking activity | #24 | Start, Start — light | — |
| 6 | Core audio and speech | #25 | — | #12 natural voice without gaps |
| 7 | Talk and its flows (split into child issues: screen and turn loop #74, then #75–#80 and #13) | #26 | Talk, F6, F7, thinking, errors, F13, F9, F11, F12, Talk — light | #13 phrase translation |
| 8 | Memory and spoken review | #27 | Memory, F10 Review | — |
| 9 | Eva grows | #28 | Eva grows as you speak | — |
| 10 | Ratchet | — | — | — |

Ratchet: delete the legacy override from `biome.json`, move strict lints into
`Cargo.toml [lints]`, remove `ProviderError` from non-provider code and the `ProviderError ↔ IpcError`
bridge from `core`. Widgets and the menu-bar panel stay *After MVP*. Steps 2–5 may swap; 6 precedes 7.

## 4. Mapping legacy → target

| Legacy | Target |
| :--- | :--- |
| `src/lib/*Types.ts` + `is*` guards | `src/core/ipc/bindings` (generated) + `src/core/ipc/schemas` |
| `src/lib/*` (preferences, formatting) | `src/core/storage`, `src/shared/helpers/<name>` |
| `src/features/*/…Api.ts`, `sessionApi.ts` | feature `services/*-service.ts` |
| `src/features/*/use*.ts` hooks | feature `model/atoms.ts` (+ `helpers/` for the pure parts) |
| `src/features/*/lib/*` | feature `helpers/<name>/` |
| `src/context/TrainerContext.tsx` (deleted in #74) | atoms in the owning features/core; screens read them directly |
| `src/routes/<screen>` (glue that feeds a migrated screen from legacy state) | deleted when the legacy state it reads is migrated; new layers never import it |
| `src/components/*` | `src/shared/ui/<name>` (generic) or the feature that owns it |
| `src/router.tsx`, `src/App.tsx` | `src/app/router.tsx`, `src/app/app.tsx`, `src/app/shell` |
| `src-tauri/src/lib.rs` commands | `src-tauri/src/<context>/commands.rs` |
| `ProviderError` for non-provider failures | the context's `thiserror` enum → `IpcError` |
