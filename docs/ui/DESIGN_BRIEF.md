# Design brief: English Trainer MVP

For a designer (human or AI tool) producing the MVP screens. Behaviour is defined in
[PRODUCT_SPEC.md](../PRODUCT_SPEC.md) and the delivery order in [ROADMAP.md](../ROADMAP.md); this
brief turns them into screens, states and components. Older files in this folder are early ideas,
not requirements.

## 1. Product in one paragraph

A macOS desktop app for **speaking** English. The learner talks by voice with an AI partner
("Eva") about everyday and work topics. Eva answers in about a second, out loud, with one or two
short sentences and a question. Under each of the learner's answers a quiet note suggests a more
natural way to say it. When the learner does not know how to structure an answer, help is one
click away and already prepared. Useful phrases are kept and come back in later sessions.

The learner reads and listens well, knows what they want to say, and struggles to say it
fluently. The design should make speaking feel like a calm conversation with a person, not like
filling in a form.

## 2. What is wrong with the current screen

Reference: the Conversation screen of the first alpha (screenshot in the 2026-10-06 feedback).

- The middle of the screen is a stack of unrelated cards (Eva's message, "Spoken phrase recall",
  "Deliberate practice → Open Coach", collapsed "Audio & voice settings") — it is unclear what to
  do next.
- The current question is shown twice (header and Eva's bubble).
- The main action — speaking — is a small "Record" button in the bottom-right corner, next to a
  text field that looks primary.
- Help ("Answer help & flow") is a collapsed row that is easy to miss.
- Conversation and Coach are separate modes; feedback means leaving the conversation.
- A narrow column in a wide window, large empty sides; a confusing "20 / 8 answers" counter.
- No sense of who is speaking: no visual difference between Eva thinking, Eva speaking and the
  app listening.

## 3. Design principles

1. **Voice first.** The microphone state is the most visible thing on the screen. Typing is
   possible but secondary.
2. **One next step.** At any moment there is one obvious thing to do: listen, speak, or continue.
3. **The conversation never waits for coaching.** Feedback appears later, quietly, under the
   answer it belongs to.
4. **Help is graduated.** Frame → phrases → example, each one step more revealing.
5. **Calm, not gamified.** No points, streak pressure or red failure states for language mistakes.
   Mistakes are shown as "more natural: …", never as errors.
6. **English UI text in the MVP**, short and plain. Russian localisation may come later, so avoid
   text baked into images and leave room for ~30% longer strings.

## 4. Platform and constraints

- macOS desktop app (Tauri webview), dark theme first; light theme is a nice-to-have.
- Window: default 1280×800, minimum 960×640, resizable; must also work at 1440×900 and on a
  full-screen 16" display. The dialogue column should use the width sensibly (no tiny centred
  strip).
- Built with React, HeroUI v3 and Tailwind CSS v4: prefer HeroUI components (buttons, cards,
  tabs, switches, popovers, tooltips) and Tailwind tokens; avoid designs that need custom canvas
  work except the voice visual.
- Fully keyboard operable. Proposed shortcuts (designer may adjust): Space hold = push-to-talk,
  Esc = cancel listening / stop Eva speaking, H = open help, S = "stuck", ⌘↩ = send typed text.
- Respect "Reduce motion": the voice visual must have a calm static fallback.
- Accessible contrast (WCAG AA) for all text; states must not rely on colour alone.

## 5. Information architecture

Keep it small. Sidebar or top-level navigation with:

1. **Talk** — the main screen (most time is spent here).
2. **Memory** — saved phrases and mistakes, and spoken review.
3. **Settings** — a separate screen or sheet.

"Daily Practice", "Conversation" and "Coach Mode" from the alpha merge into **Talk**. A home /
start state can live inside Talk (see §6.1) rather than as a separate dashboard.

## 6. Screens and states

### 6.1 Talk — start a session

- Topic picker: Work & technology, Daily life, Opinions & debates, Plans & stories, Job interview
  (HR / behavioural / technical), Free topic. Each with a one-line description.
- Session length: 5 / 10 / 15 minutes (default 10), shown as a suggestion, not a hard limit.
- "Phrases to review today: N" — optional short spoken review before or after the session.
- A resumable unfinished session, if any ("Continue: Work & technology, 4 min left").
- One primary action: **Start talking**.

### 6.2 Talk — conversation (the key screen)

Layout zones (designer decides exact arrangement):

- **Header:** topic, elapsed / target time (e.g. "6:12 of 10:00"), Finish button. Do not repeat the
  current question here.
- **Voice visual (Eva):** an orb or waveform that reacts to real audio. It is the place where the
  avatar will live later, so reserve a stable area for it (it can be compact). States are listed in
  §7.
- **Dialogue:** Eva's messages and the learner's messages, newest at the bottom, auto-scrolling.
  - Eva's message: reply text, then the question visually emphasised; replay audio button.
    While streaming, words appear progressively.
  - Learner's message: transcript text; small marks for "typed" or "used help". Below it, when
    ready, the **coaching note** (§6.3).
- **Help bar** above the composer: Frame / Phrases / Example for the current question (§6.4).
- **Composer (voice-first):** a large microphone control with a level meter and the current state
  label; after speaking, the recognised text appears in an editable area with a short
  auto-send countdown ("Sending in 2 s — edit to stop"); a secondary "Type instead" option.
  Hands-free toggle and pause length are reachable without opening Settings.

### 6.3 Inline coaching note (under the learner's message)

- Appears a few seconds after the answer, never blocks Eva's reply. Loading state is subtle
  (e.g. "Checking your answer…" in small text, or nothing).
- Content: **More natural:** one rewritten version of what the learner meant (with changed words
  highlighted), plus **at most one** focus point (e.g. "Use *I've been working* for an action that
  is still going on").
- Actions: **Say it again** (records a second attempt; shows the new transcript and what improved),
  **Save phrase** (to Memory), dismiss/collapse.
- Collapsed by default after the next turn starts, so the dialogue stays readable.

### 6.4 Answer help (graduated)

Prepared in the background, opens instantly. Three levels, each revealing more:

1. **Frame** — three steps for this question type, e.g. Point → Reason → Example, Past → Present →
   Future, Situation → Action → Result.
2. **Phrases** — three to five connectors and phrases for this question.
3. **Example** — a short model answer, hidden by default, with "Play" and "Hide before speaking".

Plus an optional **planning timer** (15 / 30 s) with the frame visible. Opening any level marks the
answer as "used help" (show this subtly on the learner's message).

### 6.5 Stuck rescue (while speaking)

- A **Stuck** button visible only while the learner is speaking (and the S shortcut).
- Shows one of: a next connector, a sentence start, or "say it simpler" — based on what was said so
  far — without stopping the recording.
- **Missing word:** a small field "Describe the word in English…" → 3–5 candidate words to pick.
- Must fit next to the microphone control without covering the dialogue.

### 6.6 Session wrap-up

- Shown after Finish or when time is up (the learner can keep talking).
- Up to three phrases worth learning and up to two recurring mistakes, each with an example from
  the learner's own answers; "Save all to Memory" in one action, individual remove.
- Local numbers: speaking time, words per minute, average answer length — as personal trends
  ("+12% vs last session"), never as a level or grade.
- Next step: "Done" or "Talk more".

### 6.7 Memory

- Two lists: **Phrases** and **Mistakes** (original → better), each with the source sentence and
  status (new / learning / improving / stable / archived).
- "Review now (N due)": a spoken review flow — Eva gives a situation, the learner answers aloud
  using the phrase; result shown as "used it / not yet".
- Search, archive, delete. Calm empty state explaining how phrases get here.

### 6.8 Settings

Groups:

- **Microphone:** device picker, live level meter, 10-second record/playback check.
- **Conversation AI:** provider (Gemini — recommended, Apple on-device, Antigravity — legacy),
  Gemini API key field (password-style, Save / Remove, "Saved, encrypted on this Mac" status, the
  free-tier data notice), "Test AI response" showing *first words* and *full reply* times.
- **Voice:** system voice, speed, preview.
- **Conversation flow:** hands-free on/off, end-of-turn pause (1–3 s), auto-listen after Eva
  speaks, auto-send delay.
- **Personalisation:** short profile (role, stack, interests, goals) and personal glossary
  (technical terms, names) for speech recognition.
- **Privacy:** what stays local, what is sent to the AI, raw audio retention (off by default).

### 6.9 First run

Three short steps: allow microphone (with a level check), choose the AI provider / paste the key,
pick a voice. Skippable; ends on the Talk start state.

## 7. Voice and turn states

The voice visual, the microphone control and the status label must agree. Design each state:

| State | Meaning | Voice visual | Microphone control |
| :--- | :--- | :--- | :--- |
| Idle | Nothing happening | Calm, still | "Press to speak" / Space |
| Listening | Recording the learner | Reacts to the learner's voice level | Active, level meter, Stop, Stuck |
| Auto-listen | Started by itself after Eva finished | Same as Listening, plus a clear "Listening…" cue | Prominent Cancel (Esc) |
| Transcribing | Turning speech into text | Short processing cue | Disabled, "Transcribing…" |
| Review & send | Text ready, auto-send countdown | Calm | Editable text, countdown, Send now, Re-record |
| Thinking | Waiting for Eva's first words | "Thinking" animation | Disabled or "Speak anyway" |
| Eva speaking | Playing Eva's reply | Reacts to Eva's voice | "Interrupt" (speaking or pressing interrupts) |
| Paused | Session paused, microphone released | Dim | "Resume" |
| Error | Microphone lost, AI unavailable, key missing | Neutral | Short message + one fix action |

Notes:

- While a session is active the microphone stays open (macOS shows its orange indicator); show a
  visible **Pause** that releases it.
- Errors are rare and recoverable: one sentence and one button ("Retry", "Open Settings",
  "Switch to Apple on-device").
- If the reply came from the on-device backup model, a subtle "on-device" marker is enough.

## 8. Visual direction

- Dark, calm, focused; the alpha's dark palette with a violet accent is a starting point, not a
  requirement.
- Eva and the learner must be distinguishable at a glance (alignment, colour or avatar).
- Typography tuned for reading short sentences quickly; Eva's question slightly emphasised.
- Motion is purposeful: the voice visual and state transitions only.
- Space for a future 2D/3D avatar replacing the orb, without redesigning the layout.

## 9. Out of scope for this design

Interview packs as a separate mode, drills, progress dashboards and charts, the menu-bar quick
practice window, gamification (XP, badges, streak pressure), pronunciation scoring, avatar art.

## 10. Deliverables

1. Talk screen in every state from §7, at 1280×800 and 960×640.
2. Talk start state, coaching note (loading / ready / say-it-again result), help levels, stuck
   rescue, missing word, wrap-up.
3. Memory list and spoken review.
4. Settings (all groups) and first run.
5. Components with states: microphone control, voice visual, message bubbles, coaching note,
   help bar, toasts/errors.
6. Optional: a clickable prototype of one full turn (Eva speaks → auto-listen → learner speaks →
   transcript with countdown → Eva thinking → Eva speaks, coaching note appears under the answer).
