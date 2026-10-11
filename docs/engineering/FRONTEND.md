# Frontend architecture

How `src/` is organised. The normative short form is in
[`CODE_REQUIREMENTS.md`](../../CODE_REQUIREMENTS.md); Effect patterns are in [`EFFECT.md`](EFFECT.md);
how legacy code moves into this shape is in [`MIGRATION.md`](MIGRATION.md).

## 1. Layers

```text
src/
  main.tsx        entry: mounts <App />, nothing else
  app/            composition root: providers, router, shell, the Effect runtime and its layers
  screens/        one folder per route; composes features into a page
  features/       one folder per user-facing capability; independent of each other
  core/           app-wide capabilities without UI: IPC, audio, speech, storage
  shared/         product-agnostic building blocks: UI kit, theme, pure helpers
```

Imports only go **down** this list:

| Layer | May import | Never imports |
| :--- | :--- | :--- |
| `app/` | `screens`, `features`, `core`, `shared` | — |
| `screens/` | `features`, `core`, `shared` | `app`, other screens |
| `features/<x>/` | `core`, `shared`, files inside `x` | `app`, `screens`, **other features** |
| `core/<x>/` | `shared`, other `core` modules through their public API | `app`, `screens`, `features` |
| `shared/` | `shared` | everything above |

Biome enforces this table (`noRestrictedImports` overrides in `biome.json`).

Why this and not full Feature-Sliced Design: FSD's `entities` and `widgets` layers pay off in large
web apps with many pages sharing business objects. This app has four screens, and its domain objects
(session, memory item, coaching note) are owned by Rust and arrive as IPC types in `core/ipc`.
We keep FSD's two ideas that matter here — a strict downward import rule and a public API per
slice — and skip the layers we would leave empty.

### Why `screens/`

Features never import each other. When Talk needs coaching notes, Memory items and speech, the
**screen** composes `features/coaching`, `features/memory-*` and `features/speech-*` side by side
and passes data between them as props or through shared atoms in `core`. This removes the feature
dependency graph that the old `CODE_REQUIREMENTS` had to maintain by hand
(`practice → conversation, coach, memory, speech …`) and makes each feature testable alone.

When two features need the same state or logic, it is not theirs: move it to `core/` (app-wide
capability) or `shared/` (product-agnostic).

## 2. Anatomy of a feature

```text
features/gemini-key/
  index.ts                         public API — the only file other layers import
  types.ts                         feature-wide types used by more than one folder below
  components/
    gemini-key-field/
      index.tsx                    the component (named export, PascalCase)
      styles.css                   styles for this component only
      helpers.ts, constants.ts, types.ts   added beside it only when it needs them
    key-status-line/
      index.tsx
  helpers/
    key-error-message/
      index.ts                     one helper = one job
      key-error-message.test.ts    unit test beside it
    key-field-controls/
    key-source-label/
  model/
    runtime.ts                     the feature's Effect runtime on top of CoreLive
    atoms.ts                       state: atoms built on that runtime (see EFFECT.md §5)
  services/
    gemini-key-service.ts          Effect service: talks to core/ipc, typed errors
  tests/
    gemini-key.test.ts             behaviour tests: atoms + services with a fake Ipc layer
  flow.md                          Mermaid sequence diagram of the feature's data flow
```

Rules:

- **Everything is a folder once it has a second file.** A component or helper starts as
  `components/<name>/index.tsx` or `helpers/<name>/index.ts`; its `helpers.ts`, `constants.ts`,
  `types.ts`, `styles.css` and tests are added beside it only when needed. Do not create empty files.
- Folders and files are `kebab-case`. Exports inside are `PascalCase` (components, types, services,
  errors) or `camelCase` (functions, atoms). One component per `index.tsx`.
- `index.ts` at the feature root is the **public API**: explicit named exports only
  (`export { GeminiKeyField } from './components/gemini-key-field'`), never `export *`. It is the
  only barrel allowed. Code outside the feature imports `@/features/gemini-key`, never a deep path.
- Inside a feature, files import each other **relatively**. Across layers, imports use `@/…`.
- A sub-component used by one component lives in that component's folder
  (`components/gemini-key-field/key-input/index.tsx`) — one nesting level at most; past that it
  becomes a sibling in `components/`.
- `model/` is the only place with feature state. Components read and write atoms; they do not run
  Effects, call `invoke()`, or hold business logic.
- `services/` is the only place that talks to `core/ipc` or other side-effecting core services.
- `helpers/` are pure functions: no Effect runtime, no React, no DOM. They are unit-tested.
- `tests/` holds behaviour tests that drive the feature through its atoms with test layers
  (no DOM). User flows that need a real WebView are Playwright tests in `e2e/`.
- `flow.md` holds one Mermaid `sequenceDiagram` per user action of the feature, with these
  participants in this order: Learner, the component, atoms, the service, `Ipc`, the Rust command,
  the Rust service, and the store or provider it reaches. Show the success path and each typed
  failure (`alt`). It changes in the same commit as the flow; a reviewer reads it before the code.
- No comments in any file; names carry the meaning (CODE_REQUIREMENTS › Principles).

## 3. Screens

```text
screens/settings/
  index.tsx                        route component: layout + composed features
  components/
    settings-section/index.tsx     layout pieces used only by this screen
```

A screen owns layout and wiring between features, not logic. If a screen needs a helper that is
not layout, that helper belongs to a feature or `core`.

## 4. Core

`core/` holds capabilities that are part of *this* product but have no UI of their own and are
used by several features. Each module is a folder with an `index.ts` public API:

```text
core/
  ipc/
    index.ts                       Ipc service, invokeCommand, IpcError family
    bindings/                      GENERATED by ts-rs from Rust — never edit by hand
    schemas/                       Effect Schemas for binding types, checked against them
  audio/                           microphone, PCM capture, device preference (Scope-managed)
  speech/                          system TTS, local STT client
  storage/                         typed localStorage preferences
```

## 5. Shared

`shared/` knows nothing about English training. If a file mentions sessions, phrases, Eva or
Gemini, it is not `shared/`.

```text
shared/
  ui/<component-name>/index.tsx    design-system components on top of HeroUI
  helpers/<helper-name>/index.ts   generic pure helpers (formatting, text, arrays)
  theme/                           tokens, light/dark switch
```

## 6. React rules

- Function components declared with `function`, props typed as `type Props`.
- State: atoms (`model/atoms.ts`) for anything shared, remote, or effectful. `useState` only for
  ephemeral state that lives and dies with one component (an input draft, a hover).
- No `useEffect` for data loading or for synchronising state. Remote data is an atom backed by an
  Effect; derived values are derived atoms or computed in render. `useEffect` remains only for
  DOM synchronisation in `shared/ui` and `app/`.
- No `useMemo` / `useCallback` by reflex.
- One level of ternary in JSX; past that, return early or extract a component.
- Render `AsyncResult` with `AsyncResult.match` (or `builder`), so loading, failure and success are
  each handled explicitly.
- Accessible, semantic controls; E2E selects by role and visible text.

## 7. Styles

CSS lives beside the component (`styles.css`) and is imported by its `index.tsx`. Class names are
prefixed with the component name (`.gemini-key-field__status`). Tokens come from `shared/theme`.
No feature-wide or screen-wide CSS files that style other folders' components.
