# Testing

What to test where, and the patterns that keep tests readable as the app grows. The short rules are
in [`CODE_REQUIREMENTS.md`](../../CODE_REQUIREMENTS.md) §7.

## 1. The pyramid here

| Level | Proves | Tool | Location |
| :--- | :--- | :--- | :--- |
| Unit | a pure helper or domain rule | `bun test` | `helpers/<name>/<name>.test.ts` |
| Property | an invariant over all valid inputs | `bun test` + Effect `Arbitrary` | beside the unit test |
| Behaviour | a feature works through its atoms and services | `bun test` + test layers | `features/<x>/tests/` |
| Rust unit / service | domain rules, use cases with fake ports | `cargo test` | beside the code |
| Pipeline | session → SQLite → provider seam end to end | `cargo test` | `src-tauri/tests/` |
| E2E | a user flow in the real UI with typed fake commands | Playwright | `e2e/` |
| Manual | microphone, Whisper, TTS, perceived latency | the built app on a Mac | commit message |

Push each check to the lowest level that can prove it. E2E proves flows, not details.

## 2. Unit and behaviour tests

### Name the behaviour

The test name is a sentence about behaviour, readable without the body:

```ts
describe('dueItemsForReview', () => {
  test('returns at most six items, oldest due first', …);
  test('skips archived items even when overdue', …);
});
```

Not `test('works')`, not `test('dueItemsForReview 2')`.

### Arrange · Act · Assert

One behaviour per test, three visible blocks separated by a blank line. One `act`. Assert the
outcome, not the steps that led to it.

```ts
test('a cued answer never counts as independent use', () => {
  const answer = anAnswer({ cueExposed: true });

  const evidence = evidenceFor(answer);

  expect(evidence.isIndependent).toBe(false);
});
```

### Test data builders

Build inputs with small builders that have valid defaults and take overrides, so each test shows only
what matters for it. Builders live in `features/<x>/tests/builders.ts` (or `core/ipc/testing/` for IPC
types shared by many features) and are typed against the generated bindings:

```ts
export function aSession(overrides: Partial<PracticeSession> = {}): PracticeSession {
  return { session_id: 1, turn_count: 0, target_turns: 8, …, ...overrides };
}
```

No shared mutable fixtures; no JSON blobs copied between tests.

### Table-driven cases

When the same rule is checked on several inputs, use `test.each` with named rows instead of copies:

```ts
test.each([
  { input: 'Just I want', expected: 'I just want' },
  { input: 'in the university', expected: 'at university' },
])('rewrites "$input" as "$expected"', ({ input, expected }) => { … });
```

### Properties for rules with many inputs

Normalisation, scheduling and parsing have invariants that examples miss. Generate inputs from the
same Schema the code decodes with:

```ts
test('normalising is idempotent', async () => {
  const failure = await Effect.runPromise(
    Arbitrary.checkEffect(Arbitrary.schema(TranscriptText), (text) =>
      normalise(normalise(text)) === normalise(text),
    ).pipe(Effect.map(Arbitrary.formatCheckFailure)),
  );
  expect(failure).toBeUndefined();
});
```

### Time and effects

- Time-dependent Effects run with `TestClock` (`effect/testing`) and advance it with
  `TestClock.adjust`; never `sleep` in a test.
- Behaviour tests drive the real atoms in a fresh `AtomRegistry` with the feature runtime's layer
  replaced (`EFFECT.md` §7). Fake only the edges (`Ipc`, audio, clock), never a service of our own.
- Assert on typed errors by tag/code, never on message text.

## 3. E2E: Page Object Model with fixtures

E2E tests follow Playwright's [Page Object Model](https://playwright.dev/docs/pom), with fixtures so
pages stay small and tests read like the product spec.

```text
e2e/
  fixtures/
    index.ts              test = base.extend<{ app, start, talk, wrapup, memory, review, settings, tauri }>
    tauri/                FakeBackend (`tauri`): one controller per area (session, memory, review,
                          translation, planner, streaming, rescue, …) over typed command fakes
  pages/
    app.ts                open, reload, sidebar, shared overlays, quiet-period and clock helpers
    talk-page.ts          one class per screen: locators + screen-level actions
    memory-page.ts
  components/
    composer.ts           one class per reusable widget, composed into pages
    recorder.ts
    sidebar.ts
  data/
    builders.ts           test data builders typed against the app's types
    sessions.ts           shared constants and sessions
  specs/
    talk.e2e.ts           tests only: user intent + expectations
    practice.feature      Gherkin scenarios next to the specs that implement them
```

```ts
// e2e/specs/talk.e2e.ts
test('a failed send keeps the draft available for retry', async ({
  app,
  start,
  talk,
  tauri,
}) => {
  tauri.session.failingNextSend();
  await app.open();
  await app.sidebar.openSpeak();
  await start.start();
  await talk.composer.typeInsteadAndSend(writtenAnswer);

  await expect(app.alert).toContainText('could not be generated');
  await expect(talk.composer.answer).toHaveValue(writtenAnswer);
});
```

Rules:

- **Specs hold intent and assertions**; page objects hold locators and multi-step actions. A spec never
  contains a raw selector.
- **Fixtures, not constructors.** Specs receive page objects and the fake-backend controller through
  `test.extend` fixtures; a spec never writes `new TalkPage(page)` or installs fakes by hand. Fakes are
  configured on `tauri` before `app.open()`, which installs them once.
- **Keep page classes small.** A page owns only its own screen. Anything reusable (composer, sidebar,
  coaching note, dialogs) is a component object composed into pages (`talk.composer`). When a page
  class passes ~150 lines or mixes two areas, split a component out.
- **Fake backend per area.** `tauri.session`, `tauri.memory`, `tauri.speech` are small controllers
  over typed command fakes; they replace the single growing harness. Scenario setup reads as
  `tauri.review.withDuePhrase()`, not an options bag.
- Locate by role and visible English text (`getByRole`, `getByLabel`); never by CSS class.
- Page objects return locators or perform actions; they do not assert, except for waiting helpers
  whose name says so (`waitUntilListening`).
- No `waitForTimeout` in specs; wait for a visible state. When the passing of time is itself the
  assertion (nothing happens for 1.8 s), use the named `app.waitForQuietPeriod(ms)`.
- Each spec is independent: fresh page, fresh fake backend, no order dependence. Unhandled fake
  commands fail the test in the `tauri` fixture teardown.
- The dev server port comes from `E2E_PORT` (default 1431); give each worktree its own so that
  `reuseExistingServer` never tests another checkout.

## 4. Rust

- Domain tests are plain unit tests with no I/O.
- Services are tested with fake implementations of their ports (in-memory repository, fake engine,
  fake clock) defined in the context's `tests` module.
- Use table-driven tests (`for case in [...]`) with a descriptive `name` field for each case.
- SQLite adapters are tested against a temporary database created per test.
- Every bug fix starts with a failing test that reproduces it.
