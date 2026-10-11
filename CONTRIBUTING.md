# Contributing

Workflow for humans and AI agents alike. Requires an authenticated GitHub CLI (`gh`).

## 1. The loop

```text
issue → linked branch → commits → PR (Closes #N) → CI green → squash merge → branch deleted
```

1. **No issue, no branch.** Work that is not described cannot be reviewed against intent.
2. **Branches come from `gh issue develop`**, so GitHub links the issue and the branch.
3. **One PR per issue.** Scope grows → open a follow-up issue instead of widening the PR.
4. **Squash merge only.** `main` gets one commit per issue, titled by the PR.

## 2. Commands

```bash
gh issue create --template task.yml
gh issue develop 42 --checkout --base main
gh pr create --base main --fill --draft
gh pr ready
gh pr merge --squash --delete-branch
```

Agents write the issue body to a file and pass `--body-file`, plus `--label` and `--milestone`.
Before merging, `gh pr view --json mergeStateStatus` must read `CLEAN`.

## 3. Labels and milestones

Every issue gets one `type:`, one `area:`, one `priority:`, one `size:` and a milestone. The set is code:
`scripts/repo-taxonomy.ts`, applied with `bun run repo:taxonomy` (safe to re-run). Change labels there,
never in the web UI.

| Axis | Values |
| :--- | :--- |
| `type:` | `feat` · `fix` · `perf` · `refactor` · `chore` · `docs` · `test` |
| `area:` | `talk` · `speech` · `coaching` · `memory` · `translation` · `settings` · `ui` · `core` · `rust` · `ci` · `docs` |
| `priority:` | `p0` breaks a promise the product makes · `p1` next · `p2` wanted · `p3` nice to have |
| `size:` | `xs` under an hour · `s` one session · `m` two or three · `l` four or more · `xl` split first |
| Milestone | `MVP` · `Architecture migration` · `After MVP` |

Status labels, sparingly: `blocked`, `needs-decision`. `docs/ROADMAP.md` keeps the product view;
issues hold the work.

## 4. Issues, commits and PRs

- An issue has four sections: **Goal**, **Acceptance criteria**, **Constraints touched**,
  **Out of scope** (`.github/ISSUE_TEMPLATE/task.yml`). Mark criteria that need the physical Mac.
- The issue title is the future squash subject, a conventional commit:
  `feat(translation): translate a selected phrase, not only one word`. Scope = `area:` without prefix.
- Commits inside a branch may be untidy; the PR title may not.
- The PR body says **Closes #N**, **What**, **Why** and **Verification**: commands run, numbers for
  latency or STT work, and what was checked by hand on the Mac.
- Never merge with red or pending checks. CI (`ci.yml`) and Security (`security.yml`) run on every PR.

## 5. Releases

A `v*.*.*` tag on `main` builds and publishes the installer (`docs/SETUP.md` › Release).
