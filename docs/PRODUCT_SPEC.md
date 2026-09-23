# Product Specification: English Trainer (B1 → B2 Speaking Coach)

This document defines the product vision, learning model, user experience, feature set, gamification principles, and success criteria for English Trainer.

---

## 1. Product Vision

English Trainer is a macOS-first desktop speaking coach for learners who understand English reasonably well but still hesitate, translate mentally, and struggle to speak spontaneously.

The product is designed around one primary outcome:

> Help a B1 learner become a more fluent, independent, and confident B2-level speaker through repeated voice practice, focused feedback, re-speaking, adaptive review, and lightweight practice throughout the day.

Technical interview preparation is the first professional specialization of the product, not the whole product.

---

## 2. Target User & Core Problem

### 2.1 Primary User Profile

- Current English level: approximately B1.
- Reading and listening are stronger than speaking.
- Grammar knowledge is sufficient to recognize many mistakes after they happen.
- Main bottlenecks:
  - long hesitation before answering;
  - constructing the sentence in Russian/Ukrainian first and translating it;
  - weak active vocabulary despite larger passive vocabulary;
  - repetitive sentence structures;
  - fear of making mistakes while speaking;
  - difficulty handling unexpected follow-up questions;
  - limited professional and interview vocabulary.

### 2.2 Target Outcome

The user should become better at:

- speaking without long preparation;
- maintaining a stable conversational rhythm;
- expressing the same idea in more than one way;
- connecting ideas clearly;
- using a wider active vocabulary and stronger collocations;
- recovering when a word is forgotten;
- handling follow-up questions naturally;
- explaining technical decisions and past experience clearly;
- participating confidently in HR, technical, system-design, and behavioral interviews.

---

## 3. Learning Model

English Trainer uses a CEFR-inspired speaking profile. It is not an official language certification and must not present its internal scores as an official CEFR assessment.

### 3.1 Speaking Dimensions

The user profile is tracked across five dimensions:

| Dimension | Product interpretation | Example signals |
| :--- | :--- | :--- |
| **Fluency** | Ability to keep speaking without disruptive pauses | response latency, long pauses, filler frequency, speech/pause ratio |
| **Accuracy** | Ability to produce understandable and grammatically reliable language | recurring grammar errors, corrected errors, error rate by category |
| **Range** | Breadth of vocabulary and grammatical structures | lexical diversity, collocations, paraphrasing ability, sentence variety |
| **Coherence** | Ability to organize and connect ideas | connectors, answer structure, sequencing, STAR completeness |
| **Interaction** | Ability to react to another speaker in real time | follow-ups, clarification, turn-taking, recovery from unexpected questions |

### 3.2 Professional Readiness

Interview readiness is tracked separately from general speaking ability.

It can include:

- concise self-introduction;
- STAR story quality;
- technical explanation clarity;
- trade-off vocabulary;
- measurable result framing;
- handling salary, motivation, weakness, conflict, failure, and system-design questions.

A user can therefore improve general speaking without artificially receiving a higher interview score, and vice versa.

---

## 4. Core Learning Loop

The primary training loop is:

```text
Speak
  ↓
Receive focused feedback
  ↓
See a stronger B2-level version of the same idea
  ↓
Speak the answer again
  ↓
Store important mistakes / useful phrases
  ↓
Retest them in a later session
```

The product should avoid overwhelming the user with every possible mistake. A normal turn should surface no more than 1–3 high-value corrections unless the user explicitly opens a detailed review.

### 4.1 Re-Speaking Is a Core Feature

After important feedback, the user can immediately record the answer again.

The second attempt is compared with the first attempt on:

- whether the target mistake was fixed;
- whether the target vocabulary was used;
- whether the answer became clearer or more concise;
- whether hesitation decreased.

This is a core learning mechanism and belongs in the first usable product version.

---

## 5. Practice Modes

### 5.1 Daily Practice — Default Entry Point

The main dashboard should not force the user to choose between many tools before every session.

Primary CTA:

> **Start 10–15 Minute Practice**

A suggested session structure:

1. **Warm-up (1–2 min):** simple personal question.
2. **Conversation (5–7 min):** general or professional topic.
3. **Focused Re-Speaking (2–3 min):** redo the two most useful answers.
4. **Recall (1–2 min):** repeat 2–4 phrases currently due for review.
5. **Session Summary:** one strength, one current focus, optional detailed report.

### 5.2 Conversation Mode

Primary objective: fluency and spontaneous interaction.

Rules:

- no grammar card after every turn;
- the AI continues the conversation naturally;
- feedback is collected silently and shown after a block of conversation;
- interruptions are minimized;
- the user is encouraged to keep speaking even when language is imperfect.

Suggested scenarios:

- daily life;
- opinions and preferences;
- explaining a concept;
- comparing alternatives;
- storytelling;
- polite disagreement;
- explaining a technical concept to a non-technical person;
- spontaneous follow-up questions.

### 5.3 Rehearsal / Coach Mode

Primary objective: deliberate correction.

Each turn may show:

- grammar and syntax corrections;
- a more natural or professional alternative;
- one B1 → B2 vocabulary upgrade;
- literal-translation / Slavicism warning when relevant;
- a short explanation;
- **Try Again** action.

The user can repeat the corrected idea immediately.

### 5.4 Interview Mode — “The Hot Seat”

Primary objective: professional speaking under realistic pressure.

Interview packs:

- **HR / Screening:** background, career goals, motivation, salary, strengths and weaknesses.
- **Technical Deep-Dive:** projects, debugging, architecture choices, databases, APIs, performance, incidents.
- **System Design:** trade-offs, constraints, scalability, reliability, security.
- **Behavioral / STAR:** conflict, failure, deadlines, initiative, leadership, teamwork.

The interviewer should ask realistic follow-up questions instead of moving through a static list.

### 5.5 Skill Builders

Focused short exercises:

- STAR Story Vocalizer;
- 30-second elevator pitch;
- paraphrase challenge;
- collocation recall;
- “explain it simpler” challenge;
- sentence expansion;
- rapid unexpected question;
- shadowing and rhythm practice.

---

## 6. Progressive Scaffolding (“Training Wheels”)

Hints should help the user start speaking without becoming a permanent dependency.

Scaffolding levels:

1. **Full Help**
   - 2–3 sentence starters;
   - 3 target words / collocations;
   - short structure roadmap.

2. **Partial Help**
   - structure roadmap;
   - optional vocabulary reveal.

3. **Rescue Only**
   - no visible hint initially;
   - hint appears after a long pause or when the user requests help.

4. **Independent**
   - no hints unless manually requested.

The application can gradually reduce assistance when the user demonstrates repeated success.

---

## 7. Baseline & Progress Measurement

### 7.1 Initial Baseline

During onboarding, the user completes an approximately 8–12 minute speaking assessment containing several task types:

- introduce yourself;
- describe a recent or past event;
- explain a project or technical concept;
- express and defend an opinion;
- answer an unexpected follow-up.

The result creates the initial Speaking Profile.

### 7.2 Weekly / Biweekly Benchmark

The product periodically repeats comparable tasks with different prompts.

Progress should be explained with evidence such as:

- average response-start latency;
- long pauses per minute;
- filler frequency;
- repeated grammar mistakes;
- successfully corrected recurring mistakes;
- active vocabulary / target collocation usage;
- answer structure completion;
- handling of follow-up questions.

The UI should emphasize trends, not a false-precision single number.

### 7.3 Session-Level Feedback

At the end of a normal session, show:

- **One thing that improved**;
- **One thing to focus on next**;
- 1–3 phrases worth keeping;
- optional detailed language report.

---

## 8. Learning Memory

The previous “Mistake Vault” evolves into a broader **Learning Memory**.

### 8.1 Mistake Records

Each meaningful recurring issue can store:

- original phrase;
- corrected phrase;
- category;
- severity / learning value;
- evaluator confidence;
- times observed;
- times subsequently used correctly;
- last seen time;
- next review time;
- source session / turn;
- status: `new`, `learning`, `improving`, `stable`, `archived`.

Suggested categories:

- articles;
- prepositions;
- tense / aspect;
- word order;
- collocations;
- literal translations / Slavicisms;
- fillers;
- weak vocabulary;
- coherence / answer structure.

### 8.2 Phrase Memory

Useful phrases are tracked independently from mistakes.

Examples:

- “The main trade-off was…”
- “What I would do differently is…”
- “The bottleneck turned out to be…”

A phrase becomes “active” only after the user recalls and uses it correctly across multiple sessions.

### 8.3 Adaptive Scheduling

A normal generated session should roughly balance:

- **70% natural conversation / current goal**;
- **20% due weaknesses and phrases**;
- **10% stretch material / new skill**.

The ratios are guidance, not a hard runtime rule.

The system should avoid forcing every conversation toward the same top three errors.

---

## 9. Ambient Practice & Companion Mode

The product should not require a single long daily study block. It should also support small spontaneous interactions throughout the day.

### 9.1 Design Goal

Turn English practice into lightweight “micro-quests” that take approximately 20–90 seconds and can be started without navigating through the full application.

Examples:

- **What are you working on right now?** — explain it for 30 seconds.
- **One sentence upgrade** — replace a weak verb with a stronger one.
- **Word of the moment** — recall the meaning and say one original sentence.
- **Quick opinion** — answer an unexpected question for 45 seconds.
- **Paraphrase** — explain the same thought in another way.
- **Yesterday in 3 sentences** — train Past Simple / sequencing.
- **Explain to a non-technical person** — simplify a technical idea.
- **Phrase recall** — use a due phrase from Learning Memory in context.

These prompts are context invitations, not surveillance. The application does not need to inspect the user’s screen to ask “What are you doing right now?”

### 9.2 Ambient Surfaces

Initial surfaces:

- macOS menu bar / tray companion;
- native local notifications;
- compact quick-practice window;
- global shortcut for “Speak now”.

Later surface:

- macOS WidgetKit desktop / Notification Center widget for glanceable vocabulary, current quest, progress, and companion state.

The widget should not be required for the MVP because it needs a separate native extension.

### 9.3 User Control

Ambient practice must be opt-in and configurable:

- number of prompts per day;
- allowed time window;
- quiet hours;
- weekdays / weekends;
- categories to include;
- pause for today;
- disable all proactive prompts.

The system should prefer fewer useful prompts over notification spam.

---

## 10. Mini Eva — Companion & Gamification

Mini Eva is an optional companion character that represents learning momentum and turns practice into a light game.

### 10.1 Role

Mini Eva can:

- deliver micro-quests;
- react to completed practice;
- celebrate newly mastered phrases;
- show the current learning focus;
- appear in the menu bar / quick window;
- unlock cosmetic expressions, animations, or small environmental changes.

Mini Eva should never become more important than actual speaking practice.

### 10.2 Progress Model

Possible game systems:

- **XP:** awarded mainly for speaking and successful retrieval, not for simply opening the app.
- **Quest chain:** several optional short quests across a day.
- **Mastery items:** phrases or skills Mini Eva “learns” together with the user.
- **Levels / zones:** unlock themes or visual states after real learning milestones.
- **Collections:** badges for meaningful achievements such as “10 spontaneous answers” or “5 phrases moved to stable”.

### 10.3 Anti-Guilt Rules

The companion must not punish the user for taking breaks.

Avoid:

- pet death;
- losing progress because a day was missed;
- aggressive streak pressure;
- guilt-based notifications;
- excessive random interruptions.

A missed day should simply mean: “Welcome back.”

The goal is to make practice inviting, not compulsive.

---

## 11. Shadowing & Pronunciation Scope

### 11.1 MVP: Shadowing & Rhythm

Whisper-based transcription can support:

- missing / added word detection;
- phrase completion;
- rough timing comparison;
- pause and rhythm metrics;
- whether the intended sentence was understood.

It must not claim reliable phoneme-level pronunciation scoring.

### 11.2 Later: Pronunciation Lab

A future dedicated pronunciation pipeline may include:

```text
Expected text
  → phoneme representation
  → forced alignment
  → acoustic segment analysis
  → phoneme / stress / timing feedback
```

Pronunciation scoring is intentionally separated from normal Whisper transcription.

---

## 12. Product Principles

1. **Speaking first.** The user should spend more time speaking than reading feedback.
2. **One useful correction beats ten minor corrections.**
3. **Fluency and accuracy are trained differently.** Conversation Mode should not feel like a grammar exam.
4. **Re-speaking converts feedback into active skill.**
5. **Progress must be evidence-based.** Show trends and examples, not mysterious AI scores.
6. **Hints fade over time.** The product should create independence.
7. **Short practice counts.** A 45-second micro-quest is valid learning.
8. **Gamification supports learning, not addiction.**
9. **Privacy by default.** No screen monitoring is required for Ambient Mode.
10. **The app should feel like a companion, not homework.**

---

## 13. MVP Scope

The first genuinely usable version should contain:

- microphone recording with Push-to-Talk;
- local English STT;
- conversational AI response + TTS;
- Conversation and Coach behavior;
- focused feedback;
- B1 → B2 rewrite;
- immediate Try Again / re-speaking;
- local session history;
- basic Learning Memory;
- one 10–15 minute Daily Practice flow;
- menu bar quick launch;
- optional local micro-practice notifications.

Not required for the first MVP:

- full WidgetKit extension;
- phoneme-level pronunciation scoring;
- advanced companion cosmetics;
- automatic screen / application context reading;
- complex social features;
- exact CEFR certification claims.

---

## 14. Product Success Criteria

The product is successful when the user can use it repeatedly for real practice and observe concrete improvement over time.

Key product signals:

- speaking minutes per week;
- number of spontaneous answers;
- re-speaking completion rate;
- due phrase recall success;
- recurring mistakes that move to `stable`;
- decreasing long-pause / response-latency trend;
- benchmark improvement across the five speaking dimensions;
- optional ambient micro-quest completion without notification fatigue.

The most important qualitative signal is simple:

> The user starts answering in English before mentally composing the full answer in another language.
