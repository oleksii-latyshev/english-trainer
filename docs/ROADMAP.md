# Roadmap

What is built, what is left, and what comes next. Behaviour is in [PRODUCT_SPEC](PRODUCT_SPEC.md);
detail of each built feature lives in the code, its tests and git history.

## Goal

Practise **spoken** English every day. The MVP is done when the learner can pick a topic and hold a
natural spoken conversation in which:

1. the AI starts answering within ~2 s of the learner finishing a sentence;
2. technical and personal vocabulary is transcribed correctly most of the time;
3. help for structuring an answer is available before and during speaking, inside the chat;
4. coaching never delays or interrupts the conversation and is reviewed after it;
5. useful phrases come back later for spoken review.

**MVP acceptance:** the learner practises ≥ 10 minutes on five different days within two weeks using
only F1–F10 and reports that answers are easier to structure than in the first alpha.

## Delivery rules

- One feature = one commit: a user-visible vertical slice, testable by speaking into the app.
- `[x]` means accepted **in the built app on a physical Mac**. `bun run verify` covers contracts,
  state, persistence and browser flows; microphone, Whisper, TTS and perceived latency need the Mac.
- Measure before and after any latency or STT change; record the numbers in the commit body.
- Every element of the approved design is either built or listed here; nothing is dropped silently.

## MVP features

`[x]` accepted · `[~]` built, waiting for the physical-Mac check · `[ ]` not started

| ID | Feature | Status | Acceptance on the Mac |
| :--- | :--- | :---: | :--- |
| F1 | Streaming conversation providers | `[x]` | first token < 1 s median; no invalid replies in 20 turns |
| F2 | Warm microphone, hands-free turns | `[x]` | first word captured 10/10; listening starts < 200 ms; 10 min hands-free |
| F3 | Accurate speech recognition (`small.en`, warm `whisper-server`, glossary prompt, live transcript) | `[~]` | 30 own technical terms ≥ 90 %; 15 s answer transcribed < 1.5 s |
| F4 | Speak while generating + voice visual | `[~]` | end of speech → first AI audio < 2.5 s median over 10 turns; interruption works on speakers and headphones |
| F5 | One Talk screen with a quiet tip marker and the answer review on the wrap-up | `[~]` | 10 turns: feedback for every answer, reply never delayed by it |
| F6 | Answer planner (frame → phrases → example, prefetched) | `[~]` | help instant for ≥ 9 of 10 questions |
| F7 | Stuck rescue (next step, simpler, missing word) | `[~]` | a stuck moment resolved in < 10 s without leaving the chat |
| F8 | Topics, profile, time-based sessions | `[~]` | three sessions on different topics feel relevant |
| F9 | Session wrap-up | `[~]` | real session → phrases and notes make sense; save/undo; they return in review |
| F10 | Spoken phrase review + warm-up | `[~]` | six-item review, shadowing, Show phrase, warm-up choose/skip |
| F11 | Write, then speak | `[~]` | full write → review → speak → review run with real audio |
| F12 | Practice my usual mistakes | `[~]` | five relevant questions, real audio, resume (runs as a Talk conversation, #80; Mac check pending) |
| F13 | Translate a word or phrase | `[~]` | selection of a word or phrase (up to 8 words) in Talk/notes/Memory; visible trigger; readable panel; translation under 1 s warm; model download consent |
| V1 | Natural local voice (Supertonic 3, four voices, system fallback) — taken ahead of the avatar | `[~]` | sounds natural; first audio quick; busy or slow engine falls back without a gap |

The learner chose to batch the physical-Mac checks for F3–F13 and V1 into one later pass.

## In progress

- **Migration and redesign, one pass** — each screen is rebuilt in the target architecture and the
  glass design together; plan, order and issues: [engineering/MIGRATION.md](engineering/MIGRATION.md)
  §3. Work items live in GitHub issues (milestones *MVP*, *Architecture migration*, *After MVP*).

## Designed, not built

Approved in the glass design canvas ([DESIGN](DESIGN.md)); each has an issue in the migration plan.

- **Talk details** (screen and turn loop, #74) — the canvas boards Main, TalkThinking, TalkError and
  TalkLight were not reachable while the screen was built, so it follows [DESIGN](DESIGN.md) and the
  tokens. Still to compare with the boards on the Mac: hands-free as a pill in the header (it is a
  switch in the flow strip under Eva), the chat fading over Eva's lower half, and the exact spacing
  of the stage.
- **App icon and Dock icon choice** in the glass style.

## After the MVP

Ordered by expected value; start only with real usage data.

1. **Avatar** — 2D Eva animated by real audio, later 3D with lip-sync driven by the natural voice's
   PCM; experimental own character (Rive/Lottie, ten states, fallback to Eva) in Settings › Eva.
2. **Interview packs** — structured mock interviews on the Talk screen.
3. **Progress view** — weekly trends with examples from real answers.
4. **Eva check-ins, menu-bar quick practice and widgets** — opt-in floating panel with one
   spontaneous question (30–90 s answer), frequency and quiet hours, never over full-screen apps or
   Focus, no guilt mechanics.
5. **Eva grows further** — a **garden** where a plant in full bloom moves and Eva starts a new
   seed, **unlockable** leaf and bloom colours, leaves that **light up** at the moment of sunshine,
   and drops from quick questions asked in the menu bar.
6. **Windows build** — Gemini as the provider; needs a Windows CI job and installer.
7. **4/3/2 retelling drill.**
8. **Pronunciation** — shadowing feedback, later phoneme-level scoring as a separate pipeline.
9. **"Rephrased" evidence** — a Memory tag for when the learner avoided the target wording on
   purpose. It needs a new outcome from the usage review, so it follows the With help tag.

## Decisions

| Topic | Decision |
| :--- | :--- |
| Practice language | English only. One exception: on-demand translation of a selected word or short phrase into the native language (F13), on device. |
| Conversation provider | Gemini API (default, free tier) and Apple Foundation Models (on-device fallback), both streaming behind one trait. Default chosen by measured time to first spoken word. |
| Background AI | Coaching (batches of ≤ 5 answers), wrap-up, review material and rescue run through `agy` pinned to Gemini Flash models; the Gemini API free quota is reserved for conversation and the F6 planner. `agy` never runs on the real-time path. |
| Speech | Local Whisper (`small.en` when installed). Local natural voice (Supertonic 3) with macOS system voices as fallback; it came before the avatar at the learner's request. |
| Gemini key | Pasted in Settings, encrypted file bound to this Mac (no Keychain prompt); `ENG_TRAINER_GEMINI_API_KEY` for development. Free-tier data use is stated next to the field. |
| Usage-review / mastery streak | Frozen: kept working, not extended. |
| Portability | macOS only for now; core code must not block Windows (providers behind traits, no macOS APIs outside adapters). |
| Not planned | Streaks, guilt mechanics, badges, five-dimension benchmark, separate Interview/Drills/Progress modes before the MVP. |
