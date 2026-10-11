---
name: dod
description: Review a finished English Trainer change before it is committed or reported done — diff review, risk checklist, checks to run, manual checks to request. Use at the end of every implementation or after a subagent reports back.
---

# Definition of done

1. Read the diff (`git diff`, `git status` for new files) and compare with what was asked. Reject drift
   and half-moved legacy code.
2. Review only risks present in the diff:
   - principles: no comments (`bun run check:conventions`), names say intent, one job per unit,
     no speculative abstraction, every fact in one place, English only;
   - feature `flow.md` matches the changed flow;
   - UI: controls from `src/shared/ui` (Base UI + Tailwind), no new `.css`, no hex or `[...]` values;
   - layers: imports go down, no feature→feature, public `index.ts` only, no new code in legacy folders;
   - IPC: Rust type changed → bindings regenerated and schema updated in the same change;
   - errors: typed end to end, no `throw`, no message matching, no swallowed `Result`;
   - effects: resources acquired with release, no `Effect.run*` outside `app/` and tests, no
     `useEffect` data loading;
   - core loop: nothing makes the conversation wait for coaching, help or wrap-up;
   - privacy: no raw audio kept, no key or transcript in logs;
   - tests: helpers unit-tested, feature behaviour test, e2e only for flows; bug fix has a failing test first.
3. Run the narrowest complete set: `bun run typecheck`, `bun run check`, `bun test src`; add
   `sh ./scripts/check-rust.sh` for Rust and `bun run test:e2e` for flows. `bun run verify` before a
   roadmap feature commit.
4. Report: what changed, checks run with results, and what still needs the physical Mac (microphone,
   Whisper, TTS, latency). Never call a roadmap feature accepted.
