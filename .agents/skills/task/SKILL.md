---
name: task
description: Run the English Trainer issue-to-PR workflow — create a labelled issue, a linked branch, a PR that closes it, and a squash merge once CI is green. Use for any repository change and whenever the owner asks to record work as an issue.
---

# Task workflow

`CONTRIBUTING.md` is canonical; read only the section needed (§3–4 to create an issue, §2 and §4 to
open or merge a PR).

1. Reuse the current issue and its branch. Otherwise write the four sections (Goal, Acceptance
   criteria, Constraints touched, Out of scope) to a file and run
   `gh issue create --title "<type(scope): subject>" --body-file <file> --label "type:…,area:…,priority:…,size:…" --milestone "<milestone>"`.
2. `gh issue develop <N> --base main --checkout` (in a git worktree when the owner has work on `main`).
3. Implement; run the narrowest useful checks while editing.
4. Push and open a draft PR early: `gh pr create --base main --draft --title "<issue title>" --body-file <file>`
   with `Closes #N`, What, Why, Verification.
5. Before ready/merge: `dod` skill, all checks green, `mergeStateStatus: CLEAN`; then
   `gh pr merge <N> --squash --delete-branch`. Never push to `main`, never force-push.
