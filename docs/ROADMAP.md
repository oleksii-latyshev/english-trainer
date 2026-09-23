# Development Roadmap: English Trainer

This roadmap prioritizes usable learning loops over infrastructure completeness. Each phase should produce something that can be manually tested by speaking into the application.

---

## 1. Roadmap Principles

1. Build vertical slices early.
2. Validate the speaking experience before adding complex adaptive systems.
3. Keep conversation latency separate from deep coaching.
4. Add gamification only after the learning event model exists.
5. Treat WidgetKit and pronunciation scoring as later extensions, not MVP blockers.

---

## 2. Phase Overview

```mermaid
flowchart LR
    P0["Phase 0: Learning & Technical Spikes"] --> P1["Phase 1: Tauri Foundation"]
    P1 --> P2["Phase 2: Speech Vertical Slice"]
    P2 --> P3["Phase 3: First Usable Daily Practice"]
    P3 --> P4["Phase 4: Coaching + Re-Speaking"]
    P4 --> P5["Phase 5: Conversation + Interview Packs"]
    P5 --> P6["Phase 6: Learning Memory + Adaptation"]
    P6 --> P7["Phase 7: Ambient Practice + Mini Eva"]
    P7 --> P8["Phase 8: Benchmarks + Progress"]
    P8 --> P9["Phase 9: Pronunciation + Native Widget"]
```

---

## 3. Phase 0 — Learning Model & Technical Spikes

### Goal

Remove the largest unknowns before building the product around them.

### Deliverables

- [ ] Finalize five speaking dimensions:
  - Fluency;
  - Accuracy;
  - Range;
  - Coherence;
  - Interaction.
- [ ] Define which metrics are deterministic/local and which require AI evaluation.
- [ ] Define baseline / benchmark task format.
- [ ] Define first Learning Memory entities.
- [ ] Prototype current Whisper integration on target Mac.
- [ ] Verify Metal path.
- [ ] Test CoreML / ANE path through selected whisper.cpp / whisper-rs build setup.
- [ ] Benchmark 2 s, 5 s, 15 s, and 30 s samples.
- [ ] Prototype Antigravity structured response with one small conversation schema.
- [ ] Prototype system TTS voice discovery.

### Exit Criteria

- local recording can be transcribed reliably;
- build strategy for Whisper is known;
- one structured AI response can be parsed into typed Rust;
- no architecture decision depends on an unverified `coreml` Cargo feature.

---

## 4. Phase 1 — Foundation & Project Skeleton

### Goal

Create the desktop shell and persistence boundaries.

### Deliverables

- [ ] Initialize Tauri v2 + React 19 + TypeScript + Vite + Bun.
- [ ] Configure Tailwind CSS v4 and Shadcn/ui.
- [ ] Configure TanStack Router.
- [ ] Configure strict TypeScript and Biome.
- [ ] Add microphone permission metadata.
- [ ] Add SQLite migrations.
- [ ] Create module boundaries:
  - `audio`;
  - `providers`;
  - `sessions`;
  - `learning`;
  - `persistence`;
  - `ambient`;
  - `gamification`.
- [ ] Add empty routes for Dashboard, Conversation, Rehearsal, Interview, Memory, Progress, Settings.
- [ ] Add tray/menu-bar icon with `Open` and `Quit`.

### Exit Criteria

- app launches on macOS;
- main and secondary windows can be created;
- DB migration runs successfully;
- tray can open the app.

---

## 5. Phase 2 — Speech Vertical Slice

### Goal

Prove the full local audio path before building learning logic.

### Deliverables

- [ ] Push-to-Talk recording.
- [ ] Web Audio / AudioWorklet PCM capture.
- [ ] Local STT provider.
- [ ] Transcript UI.
- [ ] Runtime system voice discovery.
- [ ] TTS playback controls.
- [ ] Basic latency instrumentation:
  - recording finalization;
  - STT;
  - TTS start.
- [ ] Audio error states and retry.

### User-Testable Flow

```text
Press → Speak → Release → See transcript → Hear it spoken back
```

### Exit Criteria

The user can complete this flow repeatedly without restarting the app.

---

## 6. Phase 3 — First Usable Daily Practice

### Goal

Create the first version worth using every day.

### Deliverables

- [ ] `ConversationEngine` provider interface.
- [ ] Antigravity conversation adapter.
- [ ] Small fast conversation JSON schema.
- [ ] Session creation and turn persistence.
- [ ] AI question → user voice answer → AI spoken follow-up.
- [ ] Daily Practice flow with approximately 10 minutes of prompts.
- [ ] Conversation latency measurement:
  - end of speech → AI audio start.
- [ ] Basic scaffolding:
  - sentence starters;
  - optional target vocabulary.
- [ ] Manual Full / Partial / Off hint control.

### User-Testable Flow

```text
Open app → Start Daily Practice → Have a short spoken conversation → Finish session
```

### Exit Criteria

The developer/user can genuinely practice English with the app for several days without requiring the future features.

---

## 7. Phase 4 — Coaching & Re-Speaking

### Goal

Turn conversation into deliberate learning.

### Deliverables

- [ ] `FeedbackEngine` provider interface.
- [ ] Separate evaluation call from fast conversation response.
- [ ] Focused coaching card with maximum 1–3 priority items.
- [ ] Grammar correction.
- [ ] B1 → B2 rewrite.
- [ ] Useful phrase extraction.
- [ ] Slavicism / literal-translation detection when relevant.
- [ ] `Try Again` / re-record action.
- [ ] Compare first attempt with second attempt.
- [ ] Save improvement evidence.
- [ ] Rehearsal / Coach Mode UI.

### Exit Criteria

A user can make a mistake, understand the correction, immediately say the idea again, and receive evidence that the target was fixed.

---

## 8. Phase 5 — Conversation Modes & Interview Packs

### Goal

Broaden practice without changing the core speaking pipeline.

### Deliverables

#### General Conversation

- [ ] opinion prompts;
- [ ] storytelling;
- [ ] compare / contrast;
- [ ] explain a concept;
- [ ] polite disagreement;
- [ ] unexpected follow-ups.

#### Interview

- [ ] HR pack;
- [ ] Technical Deep-Dive pack;
- [ ] System Design pack;
- [ ] Behavioral / STAR pack.

#### Progressive Scaffolding

- [ ] Full Help;
- [ ] Partial Help;
- [ ] Rescue Only;
- [ ] Independent.

#### Skill Builders

- [ ] STAR vocalizer;
- [ ] 30-second pitch;
- [ ] paraphrase challenge;
- [ ] “explain it simpler” drill;
- [ ] quick collocation drill.

### Exit Criteria

The same core engine supports both general B1→B2 speaking and professional interview practice.

---

## 9. Phase 6 — Learning Memory & Adaptive Practice

### Goal

Make sessions remember the user and retest important weaknesses.

### Deliverables

- [ ] `mistakes` table and repository.
- [ ] `phrase_cards` table and repository.
- [ ] Review events.
- [ ] Mistake deduplication.
- [ ] Status lifecycle:
  - `new`;
  - `learning`;
  - `improving`;
  - `stable`;
  - `archived`.
- [ ] Simplified spaced repetition for phrases / discrete corrections.
- [ ] Track correct later usage.
- [ ] Session target selector using approximately 70/20/10 balance.
- [ ] Learning Memory screen.
- [ ] Session summary:
  - one improvement;
  - one focus;
  - 1–3 phrases.

### Exit Criteria

A mistake or phrase from one session can intentionally return in a later session and its mastery state can change based on real usage.

---

## 10. Phase 7 — Ambient Practice & Mini Eva

### Goal

Make English practice feel lightweight, spontaneous, and game-like instead of requiring a single long study block.

### 10.1 Menu-Bar Companion

- [ ] Expand tray actions:
  - Speak now;
  - Give me a quest;
  - Review one phrase;
  - Pause prompts today;
  - Open app.
- [ ] Add compact quick-practice Tauri window.
- [ ] Add global shortcut for quick speaking.

### 10.2 Ambient Scheduler

- [ ] Optional prompt frequency.
- [ ] Quiet hours.
- [ ] Weekday/weekend preferences.
- [ ] Local notifications.
- [ ] Daily prompt maximum.
- [ ] No repeated nagging after dismissal.
- [ ] Micro-quest history.

### 10.3 Micro-Quests

- [ ] “What are you working on?” — 30 s explanation.
- [ ] Quick opinion.
- [ ] Paraphrase challenge.
- [ ] Yesterday in three sentences.
- [ ] Explain a technical concept simply.
- [ ] Due phrase recall.
- [ ] One B1 → B2 phrase upgrade.

### 10.4 Mini Eva v1

- [ ] Companion state model.
- [ ] XP from learning events.
- [ ] Expressions / simple visual states.
- [ ] Reactions to completed practice.
- [ ] Small milestone unlocks.
- [ ] No progress decay or punishment for missed days.

### Exit Criteria

The user can complete meaningful 20–90 second speaking practice from the menu bar without navigating through the full application.

---

## 11. Phase 8 — Baseline, Benchmarks & Progress

### Goal

Show evidence that speaking is improving over time.

### Deliverables

- [ ] Initial 8–12 minute baseline flow.
- [ ] Benchmark versioning.
- [ ] Local fluency metrics:
  - response latency;
  - pause metrics;
  - speech/pause ratio;
  - filler frequency;
  - speaking time.
- [ ] AI evidence for:
  - Accuracy;
  - Range;
  - Coherence;
  - Interaction.
- [ ] Combined Fluency evidence using local metrics + task result.
- [ ] Trend charts.
- [ ] First vs latest benchmark comparison.
- [ ] Evidence examples for score changes.
- [ ] Separate Interview Readiness view.

### Exit Criteria

The user can answer “What improved in my speaking over the last month?” using concrete trends and examples rather than a mysterious AI score.

---

## 12. Phase 9 — Advanced Pronunciation & Native Widget

These features are valuable but intentionally outside the MVP critical path.

### 12.1 Pronunciation Lab

- [ ] Evaluate forced-alignment options.
- [ ] Convert target text to phoneme representation.
- [ ] Align expected and spoken audio.
- [ ] Add stress/timing feedback.
- [ ] Validate scoring against real recordings.
- [ ] Keep Whisper transcription separate from phoneme scoring.

### 12.2 WidgetKit Extension

- [ ] Add native Swift WidgetKit target.
- [ ] Define shared snapshot/state mechanism.
- [ ] Show due phrase / current quest / Mini Eva state.
- [ ] Deep-link into compact practice.
- [ ] Keep widget read-mostly and lightweight.

### Exit Criteria

Advanced features add value without becoming required dependencies for normal speaking sessions.

---

## 13. Testing Strategy by Phase

Testing should protect deterministic and high-risk logic without blocking early product iteration.

### Early

Prioritize:

- schema parsers;
- DB migrations;
- provider error handling;
- Learning Memory state changes;
- scheduler quiet-hour logic.

### After Core UX Stabilizes

Add:

- integration fixtures;
- key UI flows;
- regression recordings;
- end-to-end Daily Practice smoke tests.

Not every exploratory UI feature needs exhaustive automated coverage during the first iteration.

---

## 14. Definition of MVP

The MVP is complete when all of the following are true:

1. User can launch Daily Practice and speak naturally with the AI.
2. STT is local and reliable enough for normal English practice.
3. AI responses are voiced automatically.
4. Conversation feedback does not block the next spoken reply.
5. Coach Mode can show focused feedback.
6. User can re-speak an answer and compare attempts.
7. Sessions persist locally.
8. Basic Learning Memory retains mistakes / phrases.
9. Menu bar can launch a quick practice.
10. Optional notifications can invite short practice without notification spam.
11. Raw audio is not retained by default.
12. The app can be useful before WidgetKit, advanced pronunciation, and deep gamification are finished.

---

## 15. Post-MVP Decision Gates

Before investing heavily in later features, collect personal usage data for at least several weeks.

Useful questions:

- Do short micro-quests increase total speaking frequency?
- Does re-speaking get used or skipped?
- Which feedback categories are actually useful?
- Does Mini Eva make practice more inviting or become visual noise?
- Are notifications useful at 1, 2, or 3 prompts per day?
- Does the user prefer long Daily Practice sessions or many micro-sessions?
- Which metrics correlate with the user feeling more fluent?

The roadmap should be adjusted using these observations rather than treating every later phase as mandatory.
