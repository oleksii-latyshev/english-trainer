# English Trainer agent guide

- Read `docs/PRODUCT_SPEC.md` for learning behavior, `docs/ROADMAP.md` for current priority,
  `docs/ARCHITECTURE.md` for boundaries, and `docs/TECHNICAL_REQUIREMENTS.md` for contracts.
  Follow `CODE_REQUIREMENTS.md` for implementation conventions.
- This is a macOS-first Tauri v2 app. React/TypeScript owns the UI and audio controls; Rust
  owns sessions, providers, persistence, metrics, and learning decisions. Keep Tauri IPC typed.
- Preserve the core loop: speak → focused feedback → stronger phrasing → speak again → remember
  and review. Keep conversation responsive if deeper feedback fails.
- Local STT and local SQLite are defaults. Discard raw audio after transcription unless the
  user explicitly enables retention. Ambient prompts and notifications are opt-in.
- Use Antigravity CLI (`agy`) as the initial LLM adapter. Keep it replaceable and verify its
  actual command behavior before implementation.
- The repository is still a starter. Build one useful vertical slice at a time and do not mark
  roadmap items complete merely because a shell or interface exists.
- Run checks relevant to changed files; report what was verified manually versus automatically.
