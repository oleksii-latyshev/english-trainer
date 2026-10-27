# Features

What is built, grouped by where the learner meets it. Each row links to the `flow.md` that shows how
the feature works as a sequence diagram. IDs and acceptance status are in [ROADMAP](docs/ROADMAP.md);
behaviour is specified in [PRODUCT_SPEC](docs/PRODUCT_SPEC.md).

Code layers: a **screen** composes **features**; features share state through **core** modules and
never import each other ([FRONTEND](docs/engineering/FRONTEND.md)).

## Start

The first screen: how and what to talk about, and what is due today.
Screen: [`screens/talk-start`](src/screens/talk-start/flow.md).

| Feature | ID | What it does | Flow |
| :--- | :---: | :--- | :--- |
| Practice setup | F8 | Speak, Text chat or Write, then speak; a topic; a suggested length or No limit | [practice-setup](src/features/practice-setup/flow.md) |
| Greeting by name | F8 | "Good afternoon, Alex" from the saved profile | [personal-profile](src/features/personal-profile/flow.md) |
| Say it again today | F10 | The next due phrase, with a spoken warm-up before the session or a skip | [review-warmup](src/features/review-warmup/flow.md) |
| Your usual mistakes | F12 | Up to three repeated mistakes and a five-question practice | [usual-mistakes](src/features/usual-mistakes/flow.md) |
| Speaking activity | — | A 26-week grid and "This week" minutes, from local sessions only | [speaking-activity](src/features/speaking-activity/flow.md) |
| Continue | — | Resumes a conversation that is still open, also after a restart | [session-resume](src/features/session-resume/flow.md) |

## Talk

The conversation itself. Screen: [`screens/talk`](src/screens/talk/flow.md).

| Feature | ID | What it does | Flow |
| :--- | :---: | :--- | :--- |
| Streaming conversation | F1, F4 | Eva's reply streams in and is spoken sentence by sentence; the learner can interrupt | [practice-turn](src/core/practice-turn/flow.md) · [talk-dialogue](src/features/talk-dialogue/flow.md) |
| Answer capture | F2, F3 | Warm microphone, push-to-talk or hands-free, turn detection, live transcript | [answer-capture](src/core/answer-capture/flow.md) · [talk-composer](src/features/talk-composer/flow.md) |
| Session header and clock | F8 | Progress, the session clock and Finish | [talk-session](src/features/talk-session/flow.md) |
| Need help? | F6 | Frame, Phrases and a model Example, prepared before the learner starts | [answer-help](src/features/answer-help/flow.md) |
| Stuck | F7 | Next step, a simpler way to say it or a missing word, without ending the recording | [rescue](src/features/rescue/flow.md) |
| Quiet tip marker | F5 | An answer with a review waiting gets a marker; the review itself is on the wrap-up | [talk-dialogue](src/features/talk-dialogue/flow.md) |
| Learning use review | — | Did the learner use a saved phrase or avoid a known mistake | [usage-review](src/features/usage-review/flow.md) |
| Spoken recall | — | After the last answer, say a phrase saved in an earlier session | [spoken-recall](src/features/spoken-recall/flow.md) |
| Write, then speak | F11 | Write an answer, see it reviewed, then say it aloud and see that reviewed | [write-speak](src/features/write-speak/flow.md) |
| Translate a selection | F13 | A selected word or phrase in the learner's language plus an English explanation, on the Mac | [text-translation](src/features/text-translation/flow.md) |

## Wrap-up

The page after Finish. Screen: [`screens/wrap-up`](src/screens/wrap-up/flow.md).

| Feature | ID | What it does | Flow |
| :--- | :---: | :--- | :--- |
| Session summary | F9 | Numbers, up to three phrases worth learning, save and undo | [wrap-up](src/features/wrap-up/flow.md) |
| Your conversation | F5 | Every answer with a more natural version, the changed words marked, one reason, Hear it and Say it again | [coaching-note](src/features/coaching-note/flow.md) |

## Memory

Saved phrases and recurring mistakes. Screens: [`screens/memory`](src/screens/memory/flow.md),
[`screens/spoken-review`](src/screens/spoken-review/flow.md).

| Feature | ID | What it does | Flow |
| :--- | :---: | :--- | :--- |
| Practice cards | F10, F12 | Start the spoken review or the usual-mistakes practice | [memory-practice](src/features/memory-practice/flow.md) |
| Spoken review | F10 | A situation per due item, the answer aloud, Rust decides whether the wording came up | [spoken-review](src/features/spoken-review/flow.md) |
| Library | — | Phrases and mistakes with their evidence (Say it now, With help), search, archive and delete | [memory-library](src/features/memory-library/flow.md) |
| Learning data | — | Reads and decodes Memory from Rust for every feature above | [learning-memory](src/core/learning-memory/flow.md) |

## Eva growth

Eva grows from a seed to full bloom with every minute spoken; nothing wilts and there are no streaks.
Screen: [`screens/growth`](src/screens/growth/flow.md).

| Feature | ID | What it does | Flow |
| :--- | :---: | :--- | :--- |
| Growth card and screen | — | The sidebar card, the stage strip, "How Eva grows" and "Today" | [eva-growth](src/features/eva-growth/flow.md) · [core](src/core/eva-growth/flow.md) |
| Eva's look and Dock icon | — | Colours, motion, show growth, a Dock icon that grows with her | [eva-settings](src/features/eva-settings/flow.md) · [eva-look](src/core/eva-look/flow.md) |

## Settings

Screen: [`screens/settings`](src/screens/settings/flow.md).

| Feature | ID | What it does | Flow |
| :--- | :---: | :--- | :--- |
| Conversation AI | F1 | Provider, Eva's style, Test AI response | [ai-provider](src/features/ai-provider/flow.md) · [ai-settings](src/core/ai-settings/flow.md) |
| Gemini key | F1 | The key goes to an encrypted file; only its status comes back | [gemini-key](src/features/gemini-key/flow.md) |
| Usage | — | Requests counted and limit errors noted for Gemini and `agy` | [api-usage](src/features/api-usage/flow.md) |
| Conversation flow | F2 | Hands-free, listening after Eva, interrupting by voice, end-of-turn pause, auto-send | [conversation-flow-settings](src/features/conversation-flow-settings/flow.md) · [core](src/core/conversation-flow/flow.md) |
| Microphone | F2 | Input device, live level, ten-second check | [microphone-settings](src/features/microphone-settings/flow.md) · [audio](src/core/audio/flow.md) |
| Speech recognition | F3 | Whisper model, a speech check on the learner's own voice, live transcript | [speech-recognition-settings](src/features/speech-recognition-settings/flow.md) |
| Personal glossary | F3 | Words and names Whisper should know | [glossary](src/features/glossary/flow.md) |
| Voice | V1 | Natural local voices or system voices, speed, a sample | [voice-settings](src/features/voice-settings/flow.md) · [voice-preference](src/core/voice-preference/flow.md) · [speech](src/core/speech/flow.md) |
| About you | F8 | Name, role, stack, interests and goals for Eva's prompts | [personal-profile](src/features/personal-profile/flow.md) |
| Translation | F13 | Native language and preparing the language pair | [translation-settings](src/features/translation-settings/flow.md) · [core](src/core/translation-settings/flow.md) |
| Appearance | — | System, Light or Dark | [appearance](src/features/appearance/flow.md) |
| Privacy | — | What stays on the Mac, keeping raw audio, deleting recordings | [privacy](src/features/privacy/flow.md) |
| Setup details | — | What the app found for Whisper, `agy` and the database; run setup again | [setup-details](src/features/setup-details/flow.md) |

## First run

Three steps on the first launch: microphone, AI provider with the Gemini key, and Eva's voice.
Screen: [`screens/first-run`](src/screens/first-run/flow.md) · rules: [first-run](src/core/first-run/flow.md).

## Shared core

| Module | What it owns | Flow |
| :--- | :--- | :--- |
| Practice session | The open conversation, its stage and the Rust boundary | [practice-session](src/core/practice-session/flow.md) |
| External link | Opening links in the browser | [external-link](src/core/external-link/flow.md) |
