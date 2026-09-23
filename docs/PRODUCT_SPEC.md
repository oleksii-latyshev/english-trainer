# Product Specification: English Trainer (B1 → B2)

This document defines the product vision, pedagogical methodology, user personas, and feature specifications for the English Trainer application.

---

## 1. Problem Statement & User Profile

### The B1 → B2 "Speaking Gap"
- **Current State (B1):** Good reading comprehension, solid listening comprehension, basic grammar knowledge.
- **The Bottleneck:** Severe speaking hesitation, freezing up during active conversation, constructing sentences in Russian first and translating word-by-word into English, and lack of technical interview vocabulary.
- **Target Goal (B2 Professional):** Confident, spontaneous speech during international job interviews (HR screening, Technical Deep-Dive, System Design, Behavioral/STAR rounds), expressing opinions clearly, and handling unexpected follow-up questions.

---

## 2. Pedagogical Methodology

To break through speaking paralysis, the app uses three cognitive learning principles:

1. **Scaffolding ("Training Wheels"):** Beginners never stare at a blank screen. Whenever an interviewer asks a question, the UI offers **Sentence Starters**, **Structure Roadmaps**, and **Target Vocabulary** that users can glance at while speaking.
2. **Immediate "B1 → B2 Rephrasing":** Rather than just correcting grammar rules, the AI shows how a Senior Engineer or native speaker would express the exact same thought with stronger verbs and professional collocations.
3. **Adaptive Mistake Memory (Mistake Vault):** Grammar slips and repeated vocabulary bottlenecks are logged into a local vault. The AI dynamically adapts future interviews to test those specific weak areas.

---

## 3. Core Features Breakdown

### Feature 1: "The Hot Seat" — Voice-Only Mock Interview
*Primary Objective: Eliminate speaking anxiety and simulate authentic interview conditions.*

- **Interview Modes:**
  - **HR / Screening:** Background, career goals, salary expectations, motivation, strengths/weaknesses.
  - **Technical / System Design:** Explaining architectural decisions, trade-offs (SQL vs NoSQL, monolith vs microservices), debugging stories.
  - **Behavioral (STAR Method):** Handling conflicts, missed deadlines, taking initiative, teamwork.
- **"Training Wheels" Assistant (Toggleable):**
  - Displays 2–3 suggested sentence openings (e.g., *"When tackling this challenge, my initial priority was to..."*).
  - Highlights 3 recommended B2 keywords to incorporate (e.g., *streamline, bottleneck, trade-off*).
  - Shows a 3-step structural bullet guide (1. Context → 2. Technical choice → 3. Measurable result).
- **Controls & Accessibility:**
  - **Push-to-Talk or Voice Activity Detection (VAD).**
  - **"Repeat / Rephrase Question" button:** Asks the interviewer to say the question simpler or slower.
  - **Speed Selector (0.85x, 1.0x, 1.15x):** Adjusts native macOS voice speed.

---

### Feature 2: "The Rehearsal Room" — Interactive Dual-Layer Chat
*Primary Objective: Safe environment to inspect speech, correct mistakes, and polish phrasing.*

- Supports both Voice input (transcribed via Whisper CoreML) and Text input.
- **Dual-Layer Turn Interface:**
  1. **Spoken Dialogue Bubble:** The conversational response from the interviewer (which gets voiced out loud).
  2. **Coaching & Correction Card:**
     - **Grammar & Syntax Fixes:** Highlights errors without pedantry (e.g., *"I was worked"* → *"I worked"*).
     - **B2 Vocabulary Upgrade:** *"You said: 'I made the database work faster'. More professional B2 phrasing: 'I optimized query performance and reduced query latency by 40%'."*
     - **Slavicisms / Russian-isms Alert:** Flags literal translations (e.g., *"I feel myself good"* → *"I feel good"*, *"It depends from"* → *"It depends on"*).

---

### Feature 3: "Skill Builders" — Targeted Speaking Drills & Quizzes
*Primary Objective: Active practice of high-frequency interview patterns.*

1. **STAR Story Vocalizer:**
   - Guided 4-step wizard to build and record your core portfolio stories:
     - **S**ituation: Set the scene in 15 seconds.
     - **T**ask: Define the exact objective.
     - **A**ction: What *you* personally did (focusing on "I", not "we").
     - **R**esult: Measurable impact and lessons learned.
2. **Rapid 30-Second Elevator Pitch Drill:**
   - Random curveball questions (e.g., *"Why should we choose you over other candidates?", "Tell me about a technical failure you had."*).
   - 10-second preparation countdown, 30-second speech recording.
   - Evaluated on punchiness, structure, and absence of filler sounds (*"uhm", "err"*).
3. **Collocation & False Friends Quizzes:**
   - Fill-in-the-blank and speaking drills focused on typical errors made by Russian speakers in English.
   - Generated on the fly by Gemini 3.8 Flash based on user's recent mistakes.
4. **Shadowing & Intonation Echo:**
   - Plays a native audio sentence of technical English.
   - User repeats the sentence into the mic; Whisper compares accuracy and highlights dropped words or mispronunciations.

---

### Feature 4: "The Mistake Vault" & Adaptive Progress
*Primary Objective: Turn recurring weaknesses into permanent strengths.*

- **Local Weakness Matrix:**
  - Tracks error categories: *Prepositions, Tenses, Articles (a/the), Collocations, Fillers*.
  - Calculates a "Readiness Score" for job interviews (B1 → B1+ → B2).
- **Adaptive Prompt Injection:**
  - Before every interview turn, the backend injects the user's top 3 frequent mistakes into the Gemini 3.8 Flash system prompt:
    > *"User often confuses 'make a decision' with 'take a decision' and drops past simple endings. In your next questions, gently prompt them to discuss past project decisions to test these skills."*
- **Spaced Repetition Review:**
  - Review queue for corrected phrases using a simplified SM-2 spaced repetition algorithm.
