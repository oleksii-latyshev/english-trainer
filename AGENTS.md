# English Trainer agent guide

- Read `docs/PRODUCT_SPEC.md` for learning behavior, `docs/ROADMAP.md` for current priority,
  `docs/ARCHITECTURE.md` for boundaries, and `docs/TECHNICAL_REQUIREMENTS.md` for contracts.
  Follow `CODE_REQUIREMENTS.md` for implementation conventions.
- This is a macOS-first Tauri v2 app. React/TypeScript owns the UI and audio controls; Rust
  owns sessions, providers, persistence, metrics, and learning decisions. Keep Tauri IPC typed.
- Preserve the core loop: speak → fast AI reply → inline rephrasing → speak again → remember and
  review. The conversation never waits for coaching or help. Practice content is English only.
- Local STT and local SQLite are defaults. Discard raw audio after transcription unless the
  user explicitly enables retention. Ambient prompts and notifications are opt-in.
- In the app itself, the real-time AI providers are Apple Foundation Models (bundled helper) and the
  Gemini API; Antigravity CLI (`agy`) is a legacy adapter being moved out of the real-time path.
  These are app runtime providers, not coding workers. Keep them behind engine traits and verify
  actual API/CLI behavior and latency before relying on it.
- One roadmap feature = one commit of meaningful size. Do not mark a feature accepted because code
  or an interface exists; acceptance is checked in the built app on a physical Mac.
- Run checks relevant to changed files; report what was verified manually versus automatically.
- This repository refreshes its Codebase Memory index after Git checkout and merge via Lefthook.
  Before relying on graph results after ordinary file edits, check index freshness and run
  `codebase-memory-mcp cli index_repository --repo-path "$PWD"` when it is stale. Verify graph
  conclusions in current source. Do not enable global auto-indexing or watching for this project.
