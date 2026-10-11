---
name: writing
description: Write or edit English Trainer prose — UI copy, error messages, docs, commit messages, roadmap entries. Use when adding user-facing strings or changing any Markdown file in the repository.
---

# Writing

## UI copy (the learner reads it)

- English, short, plain, calm. One sentence where one is enough; ~30 % room for future localisation.
- Encourage, never judge: "More natural: …", not "Error" / "Wrong". No guilt, streak pressure or red
  failure language for mistakes.
- Errors: what happened + one way forward ("Couldn't reach Gemini. Retry or switch to Apple on-device.").
  Never show codes, stack traces or provider internals.
- Honest claims: trends, not CEFR levels; Whisper output is never a pronunciation grade.
- Eva speaks natural everyday English and never invents facts about the learner.

## Docs

- Each fact lives in exactly one document; link instead of repeating. Present tense, describe what *is*.
- No dates, histories or "who checked what" — git keeps history. Numbers and rules stay; narration goes.
- Tables over paragraphs for contracts; code blocks only for things meant to be copied.
- Where things go: behaviour → `PRODUCT_SPEC`, status/next → `ROADMAP`, look → `DESIGN`, runtime shape →
  `ARCHITECTURE`, contracts → `TECHNICAL_REQUIREMENTS`, how code is written → `CODE_REQUIREMENTS` and
  `docs/engineering/`.

## Commits

Conventional style already used in history: `feat: …`, `fix: …`, `refactor: …`, `docs: …`, `chore: …`,
roadmap ID in parentheses when there is one (`feat: add stuck rescue (F7)`). Body: why, measured
numbers for latency/STT changes, and what was checked by hand versus automatically.
