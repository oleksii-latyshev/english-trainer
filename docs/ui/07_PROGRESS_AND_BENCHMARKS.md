# Screen 07: Progress & Benchmarks (`/progress`)

## 1. Screen Purpose & Learning Objectives

The Progress & Benchmarks screen provides **evidence-based, objective visibility** into the learner's spoken English trajectory. 

Language learners (especially developers and technical professionals moving from B1 to B2) frequently suffer from the *“plateau illusion”*—feeling as if their speaking is not improving even when their vocabulary and fluency have advanced significantly. Conversely, subjective feelings can mask persistent grammatical fossilizations or excessive filler dependencies.

This screen solves this by separating subjective impressions from **deterministic acoustic and linguistic measurements**:
1. **Multi-dimensional CEFR Speaking Radar (5 Dimensions):** Fluency, Accuracy, Lexical Range, Coherence, and Spontaneous Interaction.
2. **Objective Audio & Timing Metrics:** Response latency (time-to-speak), frequency of long pauses (>2.0s), and filler word density per 100 words—measured deterministically by the local Rust audio engine.
3. **Longitudinal Comparison:** Clear visual contrast between **Day 1 Baseline** and **Current 14-day Rolling Average**.
4. **Error Elimination Funnel:** Visual proof of recurring mistakes transitioning from `New` to `Mastered/Stable`.
5. **Periodic Standardized Benchmarks:** Standardized 8–10 minute speaking assessments taken every 1–2 weeks to track formal CEFR progress without day-to-day noise.

---

## 2. HeroUI v3 & Tailwind CSS Component Mapping

| UI Section | HeroUI v3 / Tailwind Component | Purpose & State |
| :--- | :--- | :--- |
| **Header & CEFR Band** | `Chip` (Color: Primary/Success), `Badge`, `Button` | Displays current level (B1+), target band (B2), and CTA to run new benchmark. |
| **5-Dimension Radar** | SVG Polygon / Canvas with Tailwind gradients | Visualizes speaking balance; overlays Baseline vs Current. |
| **Objective Audio Cards** | `Card`, `Card.Header`, `Card.Body`, `Progress` | Response latency, pause frequency, filler density with trend indicators (green arrows). |
| **Error Funnel** | `Progress` (stacked/segmented), `Chip` | Proportions of mistakes in `Mastered`, `Improving`, `Learning`, `New`. |
| **View Tabs** | `Tabs`, `Tab.List`, `Tab.Panel` | Toggle between "Executive Radar", "Acoustic & Fluency Metrics", and "Benchmark History". |
| **Benchmark History** | `Table`, `Table.Header`, `Table.Row`, `Badge` | Historical timeline of completed evaluations with scores and diff summaries. |
| **Benchmark Runner Modal** | `Modal`, `Modal.Dialog`, `Card`, `Button` | 3-part structured assessment modal (Intro, Project Explain, Follow-up Pressure). |

---

## 3. Information Architecture & Layout Hierarchy

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ Navigation Sidebar (Logo, Dashboard, Coach, Conversation, Interview, Drills, Memory, Settings) │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ Header: Progress & Objective Benchmarks                                               │
│ [CEFR: B1+ ➔ Target B2]   [Filter: Last 30 Days ▾]      [🎯 Start Benchmark (10m)]   │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ TAB NAVIGATION: [Overview & Radar]   [Acoustic & Fluency Metrics]   [Benchmark History] │
├───────────────────────────────────────┬────────────────────────────────────────────────┤
│ LEFT COLUMN: 5-DIMENSION CEFR RADAR   │ RIGHT COLUMN: OBJECTIVE ACOUSTIC METRICS       │
│                                       │                                                │
│         Fluency (78)                  │ ⏱️ Speech Latency (Time-to-Speak):            │
│            /\                         │    1.3s  [ -58% vs Day 1 (3.1s) 🟢 Improved ] │
│  Coherence/  \ Accuracy (72)          │                                                │
│   (84)   /    \                       │ ⏸️ Hesitation Pauses (>2.0s):                  │
│         /  /\  \                      │    1.6 / min  [ -65% vs Day 1 (4.6 / min) 🟢 ] │
│  Inter- \ /    / Lexical Range (80)   │                                                │
│  action  \    /                       │ 🗣️ Filler Word Density ("um", "like"):         │
│   (70)    \  /                        │    1.8 / 100 words  [ -72% vs Day 1 🟢 ]       │
│                                       │                                                │
│ [ ■ Baseline (Day 1)  ■ Current (Day 24) ] │ 🔁 Re-Speaking First-Attempt Fix Rate:    │
│                                       │    84% of flagged issues fixed in Turn 2       │
├───────────────────────────────────────┴────────────────────────────────────────────────┤
│ MISTAKE ELIMINATION FUNNEL & SLAVICISM RESOLUTION                                      │
│ Total Issues Tracked: 48  |  Mastered: 26 (54%)  |  Improving: 14  |  Active/New: 8     │
│ [██████████████████████████████████████████████████████░░░░░░░░░░░░░░░░░░░░░░░░]       │
│ Highlight: "depends of" ➔ 100% eliminated  |  "make decision" ➔ 92% eliminated         │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ BENCHMARK LOG & CEFR MILESTONES TABLE                                                  │
│ Date        | Assessment Type       | CEFR Level | Latency | Fluency Score | Action   │
│ Mar 24      | Bi-Weekly Benchmark   | B2 Entry   | 1.3s    | 76 / 100      | [Report] │
│ Mar 17      | Weekly Check-in       | B1+ Strong | 1.8s    | 68 / 100      | [Report] │
│ Mar 10      | Day 1 Initial Baseline| B1 Thresh. | 3.1s    | 54 / 100      | [Report] │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Speaking Dimensions Explained

The app tracks 5 core dimensions grounded in the CEFR B1–B2 Can-Do descriptors:

1. **Fluency & Temporal Flow (Weight: 25%):**
   * Metrics: Speech tempo (target: 110–140 words per minute), articulation rate, continuous run length between pauses.
   * Day 1 vs Current: Eliminates long awkward silences while searching for words.

2. **Grammatical Accuracy (Weight: 20%):**
   * Metrics: Ratio of error-free sentences, correct tense selection (Past Simple for past events, Present Perfect for ongoing impacts), preposition accuracy.
   * Focus: Persistent Slavicisms and article drops.

3. **Lexical Range & Idiomatic Upgrades (Weight: 20%):**
   * Metrics: Ratio of B2/C1 vocabulary vs basic A2 words, variety of verbs/adjectives, presence of professional collocations (*"trade-off"*, *"bottleneck"*, *"streamline"*).

4. **Coherence & Discourse Structure (Weight: 20%):**
   * Metrics: Adherence to STAR structure in interview answers, use of logical discourse markers (*"whereas"*, *"consequently"*, *"on the other hand"*).

5. **Spontaneous Interaction & Recovery (Weight: 15%):**
   * Metrics: Recovery latency when interrupted or given an unexpected follow-up, use of clarification requests instead of silence, ability to paraphrase when stuck.

---

## 5. Offline & Privacy Contract

- All metrics are computed locally in Rust and stored in SQLite tables: `benchmarks`, `speech_metrics`, `session_history`.
- Audio waveforms and recordings are **not** required to calculate these metrics; Whisper word timestamps (`start` and `end` offsets) provide millisecond-accurate latency and pause duration without retaining raw audio.
