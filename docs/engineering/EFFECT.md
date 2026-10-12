# Effect in the frontend

The frontend uses [Effect](https://effect.website) 4 (`effect@4.0.x`, LTS) for every side effect,
every boundary and all shared state. React renders atoms; it does not orchestrate async work.

Versions: `effect` and `@effect/atom-react` are pinned to the same exact version in
`package.json` (the two are released together; `@effect/atom-react@4.0.3` declared a peer on an
`effect@4.0.3` that was never published, so we stay on `4.0.2` until both line up).
Atoms come from `effect/reactivity` (stable in 4.0, not `unstable`).

The patterns below were verified against `effect@4.0.2`; snippets are trimmed. The compiling
reference is the pilot feature `src/features/gemini-key` with `src/core/ipc` — copy from there.

## 1. Where Effect is used

| Concern | Tool | Lives in |
| :--- | :--- | :--- |
| Calling Rust | `Ipc` service + `invokeCommand` + Schema decode | `core/ipc` |
| Validating outside data (IPC, `localStorage`, LLM JSON) | `Schema` | `core/ipc/schemas`, feature `services/` |
| UI preferences kept in `localStorage` | `Atom.kvs` + `KeyValueStore.layerStorage` + `Schema` (decoding falls back per field) | `core/eva-look`, `core/conversation-flow`, `features/appearance` |
| Errors | `Schema.TaggedError` (crosses IPC), `Data.TaggedError` (internal) | where they are raised |
| Dependencies | `Context.Service` + `Layer` | `services/`, `core/*` |
| Resources (microphone, worklet, timers, listeners) | `Effect.acquireRelease`, `Layer.effect` with `Scope` | `core/audio`, `core/speech` |
| Streams (reply deltas, live transcript, mic level) | `Stream.callback` | `core/*`, feature `services/` |
| Timeouts, retries | `Effect.timeout`, `Effect.retry` + `Schedule` | services |
| State shown by React | `Atom` (`effect/reactivity`) on the app runtime | feature `model/` |

Pure calculations stay plain TypeScript functions in `helpers/`. Do not wrap a pure function in
`Effect.sync` to look consistent.

## 2. Services

A service is a class key with a shape type, a live layer, and (in tests) a test layer.

```ts
import { Context, Effect, Layer } from 'effect';
import {
  type GeminiKeyStatus,
  GeminiKeyStatusSchema,
  Ipc,
  invokeCommand,
  invokeUnitCommand,
} from '@/core/ipc';
import type { GeminiKeyFailure } from '../types'; // IpcError | IpcDecodeError

type GeminiKeyServiceShape = {
  readonly status: Effect.Effect<GeminiKeyStatus, GeminiKeyFailure>;
  readonly save: (key: string) => Effect.Effect<void, GeminiKeyFailure>;
  readonly remove: Effect.Effect<void, GeminiKeyFailure>;
};

export class GeminiKeyService extends Context.Service<GeminiKeyService, GeminiKeyServiceShape>()(
  'features/gemini-key/GeminiKeyService',
) {
  static readonly layer = Layer.effect(
    GeminiKeyService,
    Effect.gen(function* () {
      const ipc = yield* Ipc;
      return {
        // Suspended so every run asks Rust again instead of replaying one answer.
        status: Effect.suspend(() =>
          invokeCommand(ipc, 'get_gemini_key_status', GeminiKeyStatusSchema),
        ),
        save: (key) => invokeUnitCommand(ipc, 'save_gemini_api_key', { key }),
        remove: Effect.suspend(() => invokeUnitCommand(ipc, 'delete_gemini_api_key')),
      };
    }),
  );
}
```

Rules:

- The key string is `<layer>/<module>/<ServiceName>`; it is the runtime identity, so it must be unique.
- Service methods return `Effect`s with **every** failure in the error channel. A method that cannot
  fail has `never` there.
- A service depends on other services by yielding them inside its `layer`, not by importing their
  implementations.
- Name multi-step methods with `Effect.fn('Service.method')(function* (...) { ... })` so they show up
  as spans in traces.
- Every service has a test layer (`Layer.succeed(Service, { ... })`) written in the test that needs
  it. Fake only edges (`Ipc`, audio hardware, timers); never fake a service you are testing.

## 3. Errors

- Errors that come from Rust are **decoded**, not guessed: `core/ipc` decodes the rejected value of
  `invoke()` with `IpcErrorSchema` (generated `IpcError` binding, `code` + `message`) into a
  `Schema.TaggedError`. A value that does not decode becomes `IpcDecodeError`, never a bare string.
- Internal errors are `Data.TaggedError` classes with the data needed to recover:

  ```ts
  export class MicrophoneDenied extends Data.TaggedError('MicrophoneDenied')<{
    readonly deviceId: string | null;
  }> {}
  ```

- Handle errors by tag (`Effect.catchTag('IpcError', …)`, `Effect.catchTags({ … })`) or by the
  `code` field of `IpcError`. Never match on `message` text.
- `throw` is not used in feature, screen or core code. A thrown exception inside an Effect is a
  defect (a bug), reported as such, not a recoverable error.
- The message shown to the learner is chosen in the UI from the error tag/code (`helpers/`), so copy
  stays in English UI code and errors stay data.

## 4. Schemas and generated bindings

Rust types that cross `invoke()` are exported to TypeScript by `ts-rs` into
`src/core/ipc/bindings/` (see [`BACKEND.md`](BACKEND.md) §4). Bindings are types only; the runtime
check is an Effect Schema written beside them in `core/ipc/schemas/`, and the compiler proves the
two agree:

```ts
import { Schema } from 'effect';
import type { GeminiKeyStatus } from '../bindings/GeminiKeyStatus';
import { bindingSchema } from './binding-schema';

export const GeminiKeyStatusSchema = bindingSchema<GeminiKeyStatus>()(
  Schema.Struct({
    configured: Schema.Boolean,
    source: Schema.NullOr(Schema.Literals(['settings', 'environment'])),
  }),
);
```

`bindingSchema<T>()` only accepts a schema whose decoded type is exactly `T` (readonly modifiers
aside), so a Rust change that regenerates a binding breaks the TypeScript build until the schema
follows. The schema mirrors the binding, so it is as loose as the binding: a union of two narrower
shapes is *not* `GeminiKeyStatus` and is rejected (`binding-schema.test.ts` proves it). To narrow
`{ configured: boolean, source: KeySource | null }` for the UI, branch in a `helpers/` function. Bounds the UI relies on
(text length, positive integers) are added as Schema checks, mirroring the Rust validation.

## 5. State: atoms

Atoms are the state layer. Each feature builds its runtime in `model/runtime.ts` from its own
service layers on top of `CoreLive` (all `core/*` live layers, exported by `@/core/runtime`):

```ts
import { Layer } from 'effect';
import { Atom } from 'effect/reactivity';
import { CoreLive } from '@/core/runtime';
import { GeminiKeyService } from '../services/gemini-key-service';

export const runtime = Atom.runtime(GeminiKeyService.layer.pipe(Layer.provide(CoreLive)));
```

All runtimes share one layer memo map, so `CoreLive` (the IPC bridge, the warm microphone) is built
**once** for the whole app however many feature runtimes use it. The type checker proves each
runtime has every service it needs; a missing layer is a compile error, not a runtime surprise.
Features never import `app/`; `app/` only mounts the single `RegistryProvider`.

Atoms are declared in `model/atoms.ts`:

```ts
import { Effect } from 'effect';
import { Atom } from 'effect/reactivity';
import { GeminiKeyService } from '../services/gemini-key-service';
import { runtime } from './runtime';

const GEMINI_KEY = ['gemini-key'];

/** Remote state: AsyncResult<GeminiKeyStatus, IpcError>, refreshed after a save or removal. */
export const geminiKeyStatusAtom = runtime
  .atom(
    Effect.gen(function* () {
      const service = yield* GeminiKeyService;
      return yield* service.status;
    }),
  )
  .pipe(Atom.runtime.withReactivity(GEMINI_KEY));

/** Commands: running one invalidates every atom registered under the same keys. */
export const saveGeminiKeyAtom = runtime.fn(
  Effect.fn('saveGeminiKey')(function* (key: string, get: Atom.FnContext) {
    const service = yield* GeminiKeyService;
    yield* service.save(key);
    get.set(geminiKeyDraftAtom, ''); // a command may also write local atoms
  }),
  { reactivityKeys: GEMINI_KEY },
);

/** Local shared state: a plain writable atom. */
export const geminiKeyDraftAtom = Atom.make('');
```

Components use the hooks from `@effect/atom-react`:

```tsx
export function GeminiKeyField() {
  const status = useAtomValue(geminiKeyStatusAtom);
  const save = useAtomSet(saveGeminiKeyAtom);
  return AsyncResult.match(status, {
    onInitial: () => <KeyStatusLine state="checking" />,
    onFailure: (failure) => <KeyError cause={failure.cause} />,
    onSuccess: ({ value }) => <KeyForm status={value} onSave={save} />,
  });
}
```

Rules:

- Remote data → `runtime.atom(effect)`; commands → `runtime.fn(effect, { reactivityKeys })`;
  shared local state → `Atom.make(initial)`; derived state → `Atom.make((get) => …)`.
- Invalidation is declared with reactivity keys, never by manually re-fetching after a command.
- Parametrised state uses `Atom.family((id) => …)`.
- Atoms that must survive unmounting (the active practice session) use `Atom.keepAlive`; everything
  else is released when no component reads it.
- Preferences that are also read by code outside React (the legacy Talk and microphone modules) are
  read from the shared registry: `main.tsx` provides `appRegistry` from `@/core/runtime` through
  `RegistryContext`, and the slice exports a reader (`readConversationFlow()`) that mounts and reads
  the same atom. Never keep a second copy of a preference.
- A preference field that must survive a wrong or missing stored value uses `withFallback` from
  `@/shared/schema/with-fallback` inside `Schema.Struct`; tests install `installFakeLocalStorage`.
- Components never call `Effect.run*`. Only `app/` (bootstrap) and tests run Effects directly; the
  Biome plugin `no-effect-run` enforces it.

## 6. Resources and streams

Anything that must be closed is acquired with `Effect.acquireRelease` inside a scope, so cleanup is
guaranteed on success, failure and interruption (an atom unmounting interrupts its fiber):

```ts
const replyDeltas = (sessionId: number) =>
  Stream.callback<string, IpcError>((queue) =>
    Effect.acquireRelease(
      Effect.sync(() => openReplyChannel(sessionId, (delta) => Queue.offerUnsafe(queue, delta))),
      (channel) => Effect.sync(() => channel.close()),
    ),
  );
```

A `Stream` can back an atom directly (`runtime.atom(stream)`); React re-renders on each element.
This replaces the `let isCurrent = true` / `useRef` cancellation flags in the legacy hooks.

A session that legacy code drives imperatively (`append`, `finish`, `cancel`) is a `runtime.fn`
whose Effect owns the whole session: callers write their input into a plain atom (a log with a
stream id), the Effect reads it with `get.stream(atom)`, and `Atom.Interrupt` or starting the next
session closes the Effect's scope, which stops audio and drops late results
(`core/speech/model/atoms.ts`).

## 7. Testing

Behaviour tests drive the real atoms in a fresh registry and replace the feature runtime's layer.
Keep the real feature service and fake only the edge (`Ipc`); no DOM. Replacing `runtime.layer`
replaces everything it provided, so add `Reactivity.layer` back or `reactivityKeys` fail with
"Service not found". The full test is `features/gemini-key/tests/gemini-key.test.ts`:

```ts
test('saving a key refreshes the status', async () => {
  const FakeIpc = Layer.succeed(Ipc, {
    invoke: (command, args) => /* answer get_/save_/delete_gemini_* from in-memory state */,
  });
  const registry = AtomRegistry.make({
    initialValues: [
      [
        runtime.layer,
        GeminiKeyService.layer.pipe(Layer.provide(FakeIpc), Layer.provideMerge(Reactivity.layer)),
      ],
    ],
  });
  registry.mount(geminiKeyStatusAtom);
  registry.set(saveGeminiKeyAtom, 'AIza-test');
  await Effect.runPromise(AtomRegistry.getResult(registry, saveGeminiKeyAtom));
  // suspendOnWaiting: wait for the refresh the save triggered, not the value from before it.
  const status = await Effect.runPromise(
    AtomRegistry.getResult(registry, geminiKeyStatusAtom, { suspendOnWaiting: true }),
  );
  expect(status.configured).toBe(true);
});
```

`getResult` on a command atom fails the Effect when the command failed; use `Effect.runPromiseExit`
when the test is about the failure. Test files import `bun:test` with the repository's
`@ts-expect-error` line until Bun's types are installed.

Pure helpers keep plain `bun test` unit tests with no Effect at all.

Time-dependent services run under `TestClock`: provide `TestClock.layer()` next to the fakes
(`Layer.provideMerge`), fork the program, and advance the clock with `TestClock.adjust` inside the
same program. `core/speech/tests/speech-pipeline.test.ts` shows it with a fake audio clock.

## 8. Not allowed

- `Promise` chains, `async` functions or `try/catch` in feature/core code (use Effect).
- `invoke()` outside `core/ipc`.
- `Effect.run*` outside `app/` and tests.
- `as` casts on decoded data, `any`, non-null `!`.
- Errors as strings in state; `Error` subclasses other than tagged errors.
- `useEffect` + `useState` to load or mirror remote data.
