# Product Specification: English Trainer

What the app is for and how it should behave. Delivery order is in [ROADMAP.md](ROADMAP.md);
runtime structure in [ARCHITECTURE.md](ARCHITECTURE.md); contracts in
[TECHNICAL_REQUIREMENTS.md](TECHNICAL_REQUIREMENTS.md).

## 1. Vision

A macOS desktop app for spoken English practice: a voice conversation with an AI partner that
answers quickly, helps the learner build an answer while speaking, and turns each session into a
few remembered phrases.

> The learner starts answering in English before composing the whole answer in another language.

## 2. User and problem

- Reads and listens to English daily without difficulty; written English is stronger than speech.
- Speaking is barely trained. The learner knows *what* to say but struggles to connect ideas into
  a structured spoken answer in real time.
- Typical blockers: long pause before answering, translating from Russian, a missing word in the
  middle of a sentence, weak connectors, repeating the same sentence patterns, technical vocabulary
  that is known passively but not produced.
- Work context is software development; work and technical topics matter, and job interviews are a
  later specialisation.

The level is treated as a trend (roughly B1 → B2), never as a certified CEFR result.

## 3. Core loop

```text
AI asks → plan (optional help) → speak → AI replies quickly
        → inline rephrasing of what you meant → say it again (optional)
        → keep useful phrases → they return in later sessions
```

Principles:

1. **Speaking time first.** The learner should speak more than read.
2. **The conversation never waits for coaching.** Feedback appears when ready, under the answer.
3. **One useful correction beats ten.** At most one focus point per answer, plus a natural
   rephrasing.
4. **Help is graduated and fades.** Frame → phrases → full example; cued answers are marked so they
   do not count as independent evidence.
5. **English only in practice.** The learner never needs to switch language to get help. One
   approved exception: on demand, a selected word can be translated into the native language chosen
   in Settings, on this Mac (F13). Conversation, help, coaching and review stay in English.
6. **Evidence, not scores.** Progress is shown as concrete examples and simple local numbers.
7. **Privacy by default.** Speech is transcribed locally and raw audio is discarded unless the learner turns on "Keep raw audio" (local, deletable). The speech check recordings the learner makes are kept locally until deleted.

## 4. Talk screen (main experience)

One chat-style screen replaces the former separate Conversation and Coach modes.

- **Top:** topic and current question; a voice visual (orb/waveform) shows listening, thinking and
  speaking states.
- **Middle:** the dialogue. Each learner message can grow an inline coaching note: "More natural:
  …" and at most one focus point, plus a "Say it again" action that records a second attempt and
  shows what changed.
- **Bottom:** voice-first composer. Push-to-talk or hands-free mode (end of turn after a
  configurable pause; "hold, I'm thinking" keeps the turn open). The recognised text can be
  corrected before it is sent; typing is possible but recorded as typed input.
- **Above the composer:** help for the current question (see §5).
- The AI reply starts playing while it is still being generated. Speaking or pressing record
  interrupts it.

Sessions are time-based (default 10 minutes, suggested, not enforced) and can be finished at any
moment. Closing the app keeps the session resumable.

## 5. Help with structuring an answer

Help is prepared in the background as soon as a question appears, so it opens instantly.

| Level | Content |
| :--- | :--- |
| Frame | Three steps that fit the question type: point → reason → example; past → present → future; situation → action → result; compare → choose → justify. |
| Phrases | Three to five useful connectors and phrases for this exact question. |
| Example | A short complete model answer with replaceable details, which can be played aloud and then hidden before speaking. |

Additional tools:

- **Planning timer:** optional 15–30 s to think, with the frame visible.
- **Stuck rescue:** during an answer, uses what was said so far to suggest the next connector,
  a sentence start, or a simpler way to express the idea.
- **Missing word:** describe the word in English and choose from suggestions.

Every use of help is recorded as a cue for that answer.

## 6. Topics and personalisation

- Topic groups: work and technology, daily life, opinions and debates, plans and stories, job
  interview (HR, behavioural, technical), free topic.
- The AI varies question types: describe, explain, compare, give an opinion, tell a story,
  disagree politely, explain a technical idea simply, react to an unexpected follow-up.
- A short profile (role, stack, interests, goals) makes questions relevant and feeds the speech
  recognition glossary.
- The AI partner speaks natural everyday English and never invents facts about the learner. By
  default (Settings > Conversation AI > Eva's style: Natural) a reply is two to four sentences with
  a varied reaction (agreeing, relating, light humour, a short opinion of her own) and one question;
  "Short and simple" keeps one or two short sentences plus a question.

## 7. Session wrap-up

At the end of a session:

- up to three phrases worth learning and up to two recurring mistakes, each with an example from
  the learner's own answers, saved to Learning Memory in one action;
- local numbers for the session: speaking time, words per minute, average answer length;
- no fluency or level claims.

## 8. Learning Memory

- **Phrases** and **mistakes** (original → corrected) are stored locally with their source answer.
- Due items return as short spoken tasks ("Here is a situation — answer using …") and are woven
  into later conversation questions.
- Optional shadowing: listen to an AI sentence and repeat it.
- Status (`new → learning → improving → stable`, `archived`) changes only from real evidence:
  spoken recall and independent use in conversation. Cued or typed answers never count as
  independent use. The detailed rules are in TECHNICAL_REQUIREMENTS §9.

## 9. Settings

Microphone choice with a short record/playback check; conversation provider and API key; system
voice and rate; personal glossary and profile; hands-free pause length; local data and privacy
notes.

## 10. Later (after the MVP)

Ordered by expected value; each needs real usage data before it starts.

1. Avatar: 2D character with audio-driven animation, then a 3D avatar with lip-sync (needs a
   neural TTS whose audio the app can analyse).
2. Natural neural voice.
3. Interview packs with realistic follow-ups.
4. Progress view: weekly trends with examples.
5. Eva check-ins: an opt-in floating panel that asks one spontaneous question during the day
   ("What are you working on right now?") for a 30–90 s spoken answer, with a user-set frequency,
   quiet hours and Less often / More often / Not now in the panel; also opened from the menu bar.
   No screen access, no guilt mechanics, no punishment for missed check-ins.
6. Pronunciation: shadowing timing feedback, later phoneme-level scoring as a separate pipeline.
   Whisper transcripts are never presented as pronunciation grades.

## 11. Success signals

- The learner practises at least 10 minutes on most days.
- The time between the AI question and the start of the answer shrinks.
- Help is opened less often for the same question types over time.
- Saved phrases appear in later independent answers.
- The learner reports that structuring a spoken answer feels easier.
