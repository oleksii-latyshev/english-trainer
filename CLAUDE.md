# CLAUDE.md

> Only what is specific to Claude Code. Everything about the project lives in `AGENTS.md` (shared with
> humans and other agents) and is imported below; change it there, never copy it here.

@AGENTS.md

## Claude Code specifics

- Project skills live in `.agents/skills` (`.claude/skills` links to it): `feature`, `ui-component`,
  `effect`, `e2e`, `writing`, `dod`. Load the one that matches the task instead of reading whole docs.
- A PostToolUse hook runs `biome check --write` on every edited TS/JSON/CSS file; do not run a separate
  format pass, and re-read a file only if a later edit fails to match.
- Dev server for the browser pane: the `web` entry in `.claude/launch.json` (`:1420`, `bun run dev:web`),
  started with `preview_start`, never through Bash. Tauri commands are unavailable there; e2e fakes
  them. The real app (`bun run dev`) is for the owner's manual checks.
- The owner often has uncommitted work on `main`: start separate work in a git worktree on a new branch.

## Architect and implementer

The main session decides, the `implementer` subagent (Sonnet) types. Delegate once the approach is
settled and the change is more than a handful of edits; keep design, security-sensitive work and
anything still being discovered in the main session.

A brief for this repo is short because the repo carries the context:

- **Goal and decision** in a few sentences, plus the non-obvious reasons.
- **Pointers, not copies:** name the skill to load (`feature`, `e2e`, …), the doc section
  (`EFFECT.md §5`) and the reference files. Never paste doc content into a brief.
- **What must not break** and **done when** (exact commands).
- Independent parts go to parallel implementers only when they touch different files.

Review the result with the `dod` skill: read the diff, run the checks yourself, judge against the goal.

## Spending tokens well

- Read the section you need: `grep -n '^#'` a doc, then read that range. Never read a whole doc "for
  context" when a skill or the pilot answers the question.
- Use Codebase Memory graph queries for structure, callers and impact; grep for literals; open files
  only to confirm.
- Prefer one targeted check (`bun test <path>`, `bunx biome check <path>`) while iterating; run
  `bun run verify` once at the end.
- Do not re-derive decisions recorded in `docs/` or memory; if one looks wrong, say so instead of
  silently redoing it.
- Long command output: filter it (`| tail`, `grep`) before it reaches the context.
