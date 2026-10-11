---
name: effect
description: Look up Effect 4 APIs and patterns before writing or changing Effect code (services, Layer, Schema, errors, atoms from effect/reactivity, Stream, Scope, TestClock) in English Trainer. Use whenever unsure whether an Effect API exists or how it is spelled in v4.
---

# Effect 4 lookup

Effect 4 differs from Effect 3 and from most training data. Never guess an API.

1. **Our conventions:** `docs/engineering/EFFECT.md` (read the one section you need) and the pilot
   `src/features/gemini-key`, `src/core/ipc`, `src/core/runtime`.
2. **Official guide shipped with the package:** `node_modules/effect/AGENTS.md`. Grep its headings
   (`grep -n '^#' node_modules/effect/AGENTS.md`) and read only the relevant section; follow its links
   into `node_modules/effect/ai-docs/` for examples.
3. **Exact signatures:** `node_modules/effect/dist/<Module>.d.ts` (grep `export declare const <name>`),
   source in `node_modules/effect/src/`. Atoms: `node_modules/effect/dist/reactivity/Atom.d.ts`; React
   hooks: `node_modules/@effect/atom-react/dist/Hooks.d.ts`.

Known v4 spellings: `Context.Service<Self, Shape>()('key')` (no `Context.Tag`, no `.asEffect()` —
yield the key in `Effect.gen`); `Schema.Literals([...])`; `Schema.TaggedError<Self>()('Tag', fields)`;
`Schema.decodeUnknownEffect`; atoms from `effect/reactivity`; `Atom.runtime.withReactivity(keys)`;
`runtime.fn(effectFn, { reactivityKeys })`; tests: `AtomRegistry.make({ initialValues: [[runtime.layer, layer]] })`,
`AtomRegistry.getResult`, `TestClock` from `effect/testing`, `Arbitrary.schema` + `Arbitrary.checkEffect`.

If a pattern compiles but is not in EFFECT.md, and it will recur, add it there in the same change.
