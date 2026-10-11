---
name: e2e
description: Write or change a Playwright end-to-end test for English Trainer using page objects, component objects and fixtures. Use when adding e2e coverage for a user flow or editing files under e2e/.
---

# E2E test

Rules and layout: `docs/engineering/TESTING.md` §3. In short:

- The spec (`e2e/specs/<flow>.e2e.ts`) contains only setup through fixtures, user intent and
  `expect`s. No raw selectors, no `new SomePage(page)`, no `waitForTimeout`.
- Page objects (`e2e/pages/<screen>-page.ts`) own one screen; reusable widgets are component objects
  (`e2e/components/<widget>.ts`) composed into pages. Split when a class passes ~150 lines.
- Fake backend controllers per area under `e2e/fixtures/tauri/`, typed against
  `src/core/ipc/bindings`; scenario setup reads like the spec (`tauri.review.withDuePhrase()`).
- Locate by role, label and visible English text only.
- Cover the flow and its failure path; leave details to unit and behaviour tests.

Run: `bunx playwright test e2e/specs/<flow>.e2e.ts` (set `E2E_PORT` to a free port when another worktree
is testing; default 1431); on failure read the trace before changing code
(`bunx playwright show-trace test-results/<dir>/trace.zip`).
