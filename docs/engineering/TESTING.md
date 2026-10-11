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
    index.ts              test = base.extend<{ app, talk, memory, settings, tauri }>
    tauri/                typed fake commands, one file per area (session, memory, speech, …)
  pages/
    talk-page.ts          one class per screen: navigation + screen-level actions
    memory-page.ts
  components/
    composer.ts           one class per reusable widget, composed into pages
    sidebar.ts
    coaching-note.ts
  data/
    builders.ts           test data builders typed against src/core/ipc/bindings
  specs/
    talk.e2e.ts           tests only: user intent + expectations
```

```ts
// e2e/specs/talk.e2e.ts
test('coaching appears under the answer without delaying the reply', async ({ talk, tauri }) => {
  tauri.session.replyWith('Nice! What did you change?');
  tauri.coaching.delayBy(2_000);

  await talk.open();
  await talk.composer.say('I fixed the bug in the login');

  await expect(talk.lastReply).toHaveText('Nice! What did you change?');
  await expect(talk.coachingNoteFor('I fixed the bug in the login')).toBeVisible();
});
```

Rules:

- **Specs hold intent and assertions**; page objects hold locators and multi-step actions. A spec never
  contains a raw selector.
- **Fixtures, not constructors.** Specs receive page objects and the fake-backend controller through
  `test.extend` fixtures; a spec never writes `new TalkPage(page)` or installs fakes by hand.
- **Keep page classes small.** A page owns only its own screen. Anything reusable (composer, sidebar,
  coaching note, dialogs) is a component object composed into pages (`talk.composer`). When a page
  class passes ~150 lines or mixes two areas, split a component out.
- **Fake backend per area.** `tauri.session`, `tauri.memory`, `tauri.speech` are small controllers
  over typed command fakes; they replace the single growing harness. Scenario setup reads as
  `tauri.memory.withDue(3)`, not an options bag.
- Locate by role and visible English text (`getByRole`, `getByLabel`); never by CSS class.
- Page objects return locators or perform actions; they do not assert, except for waiting helpers
  whose name says so (`waitUntilListening`).
- No `waitForTimeout`; wait for a visible state.
- Each spec is independent: fresh page, fresh fake backend, no order dependence.

The current `e2e/*Fixture.ts` files migrate to this layout with step 1 of
[`MIGRATION.md`](MIGRATION.md); new specs use it from the start.

## 4. Rust

- Domain tests are plain unit tests with no I/O.
- Services are tested with fake implementations of their ports (in-memory repository, fake engine,
  fake clock) defined in the context's `tests` module.
- Use table-driven tests (`for case in [...]`) with a descriptive `name` field for each case.
- SQLite adapters are tested against a temporary database created per test.
- Every bug fix starts with a failing test that reproduces it.
