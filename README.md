# English Trainer (B1 → B2 Desktop Coach)

A high-performance desktop application for macOS (Apple Silicon) built with **Tauri v2**, **Whisper CoreML**, **Antigravity CLI (Gemini 3.8 Flash)**, and **macOS Native SpeechSynthesis**.

Specifically engineered to help non-native engineers break through speaking paralysis and prepare for international technical & behavioral job interviews.

---

## Key Highlights

- ⚡ **Zero Cloud Audio Latency:** 100% on-device speech-to-text (**Whisper CoreML** on Apple Neural Engine, ~150ms) and instant native macOS speech synthesis (**SpeechSynthesis**).
- 🧠 **Smart Content Engine:** Powered by **Gemini 3.8 Flash** via **Antigravity CLI (`agy`)**, operating under strict JSON schemas with zero token costs on your existing subscription.
- 🛞 **"Training Wheels" Scaffolding:** Real-time sentence starters, structural roadmaps, and B2 vocabulary hints for candidates who feel stuck or anxious during live conversation.
- 🎯 **B1 → B2 Coaching:** Instant professional rephrasing, grammar fixes, and Slavicisms / Russian-isms alerts.
- 🗄️ **The Mistake Vault:** Persistent SQLite tracking of recurring weaknesses; dynamically tailors future interview questions to your individual bottlenecks.

---

## Documentation

Comprehensive architectural, product, and technical documentation is available in the [`docs/`](docs/) directory:

- 📐 [**System Architecture (`docs/ARCHITECTURE.md`)**](docs/ARCHITECTURE.md): Component diagrams, audio pipelines, data flows, and Mermaid sequence diagrams.
- 🎯 [**Product Specification (`docs/PRODUCT_SPEC.md`)**](docs/PRODUCT_SPEC.md): Pedagogical methodology, core features (The Hot Seat, Rehearsal Room, Skill Builders), and UX flows.
- ⚙️ [**Technical Requirements (`docs/TECHNICAL_REQUIREMENTS.md`)**](docs/TECHNICAL_REQUIREMENTS.md): Tech stack (Tauri, React, Bun, Tailwind v4, Whisper-rs), IPC contracts, and JSON Schemas.
- 🗺️ [**Development Roadmap (`docs/ROADMAP.md`)**](docs/ROADMAP.md): Phased implementation milestones from project bootstrap to adaptive quizzes.

---

## Tech Stack

- **Backend:** Rust, Tauri v2, `whisper-rs` (CoreML / Metal), `tokio`, `rusqlite`
- **Frontend:** Bun, React 19, TypeScript, Vite, Tailwind CSS v4, Shadcn/ui, TanStack Router
- **AI / LLM:** Antigravity CLI (`agy`) using `gemini-3.8-flash-medium` and `gemini-3.1-pro-high`
- **Audio:** Web Audio API (16kHz mono WAV) + macOS SpeechSynthesis (_Ava_, _Samantha_, _Oliver_)
