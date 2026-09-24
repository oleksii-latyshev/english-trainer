# English Trainer — B1 → B2 Desktop Speaking Coach

English Trainer is a macOS-first desktop application designed to help a learner move from hesitant B1 speaking toward more spontaneous, independent, and professional B2-level communication.

It combines **local speech recognition**, **AI conversation and coaching**, **re-speaking**, **adaptive Learning Memory**, **short ambient micro-practice**, and an optional **Mini Eva companion**.

Technical interview preparation is the first professional scenario, but the product is built as a broader speaking trainer rather than only a mock-interview application.

---

## Core Learning Loop

```text
Speak
  → focused feedback
  → stronger B2 phrasing
  → speak again
  → remember important mistakes / phrases
  → retest later
```

The product separates **fluency practice** from **correction practice** so normal conversation does not feel like a grammar exam.

---

## Key Features

### Daily Practice

One-click 10–15 minute speaking session combining warm-up, conversation, re-speaking, recall, and a short summary.

### Conversation Mode

Natural voice conversation with delayed feedback to prioritize fluency and spontaneous interaction.

### Rehearsal / Coach Mode

Focused grammar corrections, B1 → B2 upgrades, useful collocations, and immediate **Try Again** re-speaking.

### Interview Mode

HR, technical, system-design, and behavioral / STAR speaking scenarios with realistic follow-up questions.

### Learning Memory

Local tracking of recurring mistakes, useful phrases, review history, and mastery state.

### Evidence-Based Progress

A CEFR-inspired speaking profile tracks:

- Fluency;
- Accuracy;
- Range;
- Coherence;
- Interaction.

The scores are internal progress indicators, not an official CEFR certification.

### Ambient Practice

Optional 20–90 second micro-quests available through the macOS menu bar, compact practice window, global shortcut, and local notifications.

Example:

> “What are you working on right now? Explain it in English for 30 seconds.”

No screen monitoring is required; the prompt simply asks the user to describe their own context.

### Mini Eva Companion

An optional tamagotchi-like companion that reacts to real learning progress, delivers micro-quests, and unlocks cosmetic states without punishing missed days.

---

## Architecture Highlights

- **Desktop:** Tauri v2
- **Frontend:** React 19, TypeScript, Vite, Bun, Tailwind CSS v4, Shadcn/ui, TanStack Router
- **Backend/Core:** Rust, Tokio, SQLite
- **STT:** Local Whisper integration, Metal baseline; CoreML/ANE path validated through an implementation spike
- **TTS:** macOS/system speech synthesis with runtime voice discovery
- **AI:** provider interfaces with Antigravity CLI as the initial adapter
- **Storage:** local SQLite
- **Ambient:** Tauri tray, notifications, autostart, compact secondary window
- **Future native extension:** WidgetKit desktop / Notification Center widget

The architecture intentionally separates:

```text
ConversationEngine  → fast spoken dialogue
FeedbackEngine      → deeper language analysis
LearningEngine      → long-term adaptation
Gamification        → downstream presentation of real learning events
```

---

## Privacy Model

- microphone audio is transcribed locally;
- raw audio is discarded by default after transcription;
- learning history is stored locally;
- only required transcript/context text is sent to the configured LLM provider;
- Ambient Mode does not require Screen Recording or Accessibility access;
- notifications and launch-at-login are opt-in.

---

## Development

```bash
bun install
bun run dev
```

`bun run dev` opens the Tauri desktop app with Vite hot reload. Use `bun run dev:web`
only when you want to inspect the frontend in a browser; native Tauri commands are
available in the desktop app.

## Documentation

- [`docs/PRODUCT_SPEC.md`](docs/PRODUCT_SPEC.md) — product vision, learning methodology, practice modes, Ambient Mode, and Mini Eva.
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — component boundaries, provider architecture, runtime flows, Learning Engine, and macOS integration.
- [`docs/TECHNICAL_REQUIREMENTS.md`](docs/TECHNICAL_REQUIREMENTS.md) — stack, schemas, IPC, persistence, performance, privacy, and engineering requirements.
- [`docs/ROADMAP.md`](docs/ROADMAP.md) — phased plan from technical spikes to adaptive learning, ambient practice, benchmarks, pronunciation, and WidgetKit.

---

## MVP Philosophy

The MVP is not “all planned features finished.”

It is complete when the application is already useful for daily speaking practice:

```text
Question
  → Speak
  → Local transcript
  → Natural AI follow-up
  → Focused correction
  → Try again
  → Save learning evidence
```

Everything else should improve that loop rather than delay it.
