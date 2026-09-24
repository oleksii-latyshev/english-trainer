# Screen 09: Ambient Companion & Quick Practice Window (`/quick-practice`)

## 1. Screen Purpose & Learning Objectives

The **Quick Practice Window** (Ambient Companion) is a secondary, ultra-lightweight desktop surface designed to dissolve the friction of daily English practice.

Traditional language apps demand a deliberate 15–30 minute study block. For busy software engineers and knowledge workers, carving out this dedicated time every day is often difficult. The Ambient Companion bridges this gap by enabling **spontaneous 30–90 second speaking micro-workouts** directly from the macOS Menu Bar (tray) or a global shortcut (e.g., `⌥ + Space`).

### Key Objectives:
1. **Zero-Friction Access:** A compact floating panel (~400 × 520 px) that pops up instantly without opening or navigating the full desktop app.
2. **Context-Driven Micro-Quests:** Rapid speaking prompts directly relevant to a developer’s daily rhythm:
   * *"What are you working on right now?"* (30s standup pitch)
   * *"Defend a quick trade-off"* (45s architectural choice)
   * *"Explain a recent bug or incident"* (45s postmortem clarity)
   * *"Vocabulary upgrade challenge"* (Upgrade a basic sentence using a saved B2/C1 collocation)
3. **Instant Micro-Feedback:** Evaluates speech within 1.5 seconds. Surfaces **exactly one** high-value B2 phrasing upgrade and checks if long pauses were avoided.
4. **Gamified Momentum:** Awards XP, increments streak, and seamlessly syncs to the local SQLite database.

---

## 2. HeroUI v3 & Tailwind CSS Component Mapping

| UI Element | HeroUI v3 / Tailwind Equivalent | Functionality |
| :--- | :--- | :--- |
| **Window Frame** | Compact Popover / Window Frame (400×520px) | macOS floating utility panel with rounded corners and subtle shadow. |
| **Companion Header** | `Avatar`, `Badge`, `Chip` | Mini Eva emotional avatar (focused, cheerful), streak flame badge, and pin toggle. |
| **Micro-Quest Card** | `Card`, `Card.Header`, `Card.Body` | Displays the active prompt, target time (30–60s), and difficulty tag. |
| **Starter Scaffold** | `Accordion` / Collapsible Drawer | "💡 Need a hint / sentence starter" for beginners who freeze up. |
| **Push-to-Talk HUD** | `Button` (Large Rounded), Audio Waveform | Spacebar or click-to-talk with live decibel ring and timer. |
| **Instant Feedback** | `Card`, `Chip` (Success/Warning), `Snippet` | 1-line praise + 1 B2 phrasing upgrade with audio pronunciation test. |
| **Footer Actions** | `Button` (Ghost & Primary Small) | "Next Micro-Quest", "Done / Close", or "Open in Main App". |

---

## 3. Layout Architecture & Compact Flow

```text
┌───────────────────────────────────────────────┐
│ 🎙️ Mini Eva Companion      [📌 Pin] [✕ Close] │
│ 🔥 24-Day Streak  ·  ⚡ +15 XP Quick Practice  │
├───────────────────────────────────────────────┤
│ QUEST: DAILY STANDUP PITCH                    │
│ 🎯 Target: 30–45s speaking                    │
│                                               │
│ "What specific task or feature are you        │
│  tackling right now? Explain the goal in      │
│  two concise sentences."                      │
│                                               │
│ [💡 Show Starter: "Right now I'm working on…"]│
├───────────────────────────────────────────────┤
│              [     🎙️     ]                   │
│         Hold SPACE to Speak (30s)             │
│        ● ● ● ● ● ● ● ● ● ● ● ● ●              │
├───────────────────────────────────────────────┤
│ INSTANT MICRO-FEEDBACK (After Speaking):       │
│ • Speech Pace: 128 wpm  |  Latency: 1.1s  🟢  │
│ • Phrasing Upgrade:                           │
│   You said: "I make a fix for the cache"      │
│   ➔ Better: "I'm optimizing cache eviction"   │
├───────────────────────────────────────────────┤
│ [🔄 Another Quest]        [Done (+15 XP)]     │
│             [↗ Open Full App]                 │
└───────────────────────────────────────────────┘
```

---

## 4. Interaction States

1. **Idle / Prompt Ready:**
   * Shows today's recommended micro-quest.
   * Companion avatar is alert/encouraging.
   * "Hold Space to Speak" prompt button is glowing with subtle indigo accent.

2. **Listening / Recording:**
   * Window border glows red/amber.
   * Animated audio waveform indicates microphone capture.
   * Timer counts up to 45s.

3. **Evaluating (Local Metal Whisper + `agy` CLI):**
   * Pulse animation: *"Transcribing & evaluating phrasing (0.8s)..."*

4. **Feedback & Reward:**
   * Positive reinforcement + single B2 upgrade.
   * Confetti / XP badge pops: `+15 XP Earned`.
   * One-click action to dismiss window or launch full Coach mode.
