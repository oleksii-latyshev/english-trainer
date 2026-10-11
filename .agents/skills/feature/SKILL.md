---
name: feature
description: Create a new frontend feature slice or migrate a legacy slice into features/, core/, shared/ or screens/ in English Trainer. Use before adding a folder under src/features, moving legacy code, or adding a new Tauri command with its UI.
---

# Feature slice

Reference implementation: `src/features/gemini-key` (+ `src/core/ipc`, `src-tauri/src/gemini_key`).
Open it first and mirror its shape; read `docs/engineering/FRONTEND.md` §2 only if something is unclear.

## Decide the home

- User-facing capability → `src/features/<kebab-name>/`. Used by two features → `src/core/` (product) or
  `src/shared/` (generic). Page layout and wiring → `src/screens/<route>/`.
- Features never import each other. If you need another feature, the screen composes both.

## Build in this order

1. **Rust first** (if data crosses IPC): types derive `ts_rs::TS` + `#[ts(export)]`; command in the
   context's `commands.rs`; errors via the context's `thiserror` enum → `IpcError`. Run
   `bun run test:rust` to regenerate `src/core/ipc/bindings/`.
2. **Schema**: `src/core/ipc/schemas/<name>.ts` with `bindingSchema<Generated>()(...)`; export from
   `src/core/ipc/index.ts`.
3. **Service** `services/<name>-service.ts`: `Context.Service` class + static `layer`, methods return
   `Effect`s with typed errors, via `invokeCommand`.
4. **Model** `model/runtime.ts` (`Atom.runtime(Service.layer.pipe(Layer.provide(CoreLive)))`) and
   `model/atoms.ts` (remote `runtime.atom`, commands `runtime.fn` + `reactivityKeys`).
5. **Helpers** `helpers/<name>/index.ts` + `<name>.test.ts` for pure logic (copy from error codes, formatting).
6. **Components** `components/<name>/index.tsx` (+ `types.ts`): compose controls from `src/shared/ui`
   (missing one → `ui-component` skill), Tailwind only for layout, no `.css`; render `AsyncResult.match`.
7. **Behaviour test** `tests/<feature>.test.ts`: real atoms, fresh `AtomRegistry`, fake `Ipc` layer.
8. **Public API** `index.ts`: explicit named exports only.
9. **Flow** `flow.md`: Mermaid `sequenceDiagram` per user action, success and typed failures
   (FRONTEND.md §2). Write it before the code when the flow is new; it is the plan.

No comments anywhere: when a line needs explaining, extract a named function or constant.

## Migrating a legacy slice

Follow `docs/engineering/MIGRATION.md` §2: move, delete the old files, switch consumers to the public
API, remove the paths from the legacy list in `biome.json`. No behaviour, copy or style changes in the
same commit.

## Check

`bun run typecheck && bun run check && bun test src` — plus `bun run test:rust` if Rust changed and
`bun run test:e2e` if a flow changed.
