# Design

The approved visual design is the **glass design canvas**:
<https://claude.ai/artifact/2JbngoUp7LVQToZZgzzmuK> — Start, Talk (all turn states, help, stuck,
translate), Wrap-up, Review, Write-then-speak, Mistake practice, Memory, Settings, First run, Growth,
app icon, components. It supersedes the earlier violet canvas and the HTML prototypes (in git history).

Every element of the canvas is either built or listed in [ROADMAP](ROADMAP.md); none is dropped
silently. Light boards exist for Talk and Start; the other screens follow their tokens. Not yet designed: the
"Your own character" card. Which boards each migration step builds: [MIGRATION.md](engineering/MIGRATION.md) §3.

## Principles

1. **Voice first.** The microphone state is the most visible thing on screen; typing is secondary.
2. **One next step.** At any moment one action is obvious: listen, speak or continue.
3. **The conversation never waits for coaching.** Feedback arrives later, quietly, under its answer.
4. **Graduated help.** Frame → phrases → example, each step more revealing.
5. **Calm, not gamified.** No streak pressure, no red failure states for language mistakes;
   mistakes read as "More natural: …", never as errors. Growth is a reward, never a punishment.
6. **Short, plain English UI text**, with room for ~30 % longer strings for a future localisation.

## Platform

- macOS Tauri WebView. Default window 1280×800, minimum 960×640 (sidebar collapses to an icon rail);
  must also work at 1440×900 and full screen.
- React + Tailwind v4 + our UI kit in `src/shared/ui/` (Base UI primitives styled with Tailwind on
  the tokens below, defined once as `@theme` variables in `src/app/styles.css`); custom drawing only
  for the voice visual and Eva.
- Fully keyboard operable: Space hold = push-to-talk, Esc = cancel / stop Eva, H = help, S = stuck,
  ⌘↩ = send typed text.
- Respect Reduce Motion (static fallbacks), WCAG AA contrast, states never by colour alone.

## Visual language

| Token | Value |
| :--- | :--- |
| Ground | `#05070C`, soft radial glow |
| Glass inset | white 4 % + line 8 % (rows inside a card) |
| Glass card | white 5.5 % + line 11 % + top highlight 16 % + shadow `0 24px 60px -24px` black 65 % + `backdrop-filter: blur(28px) saturate(170%)`, 24 px radius |
| Sky glass | accent 16 % + accent line 42 % + glow 60 % (selected, learner turn) |
| Accent (Eva, primary actions) | sky `#6CC4FF`, text on it `#04192C` |
| "More natural" | green `#8BE3A9` |
| Attention | amber `#F5C26B` (no red) |
| Text | `#F2F5FA`, secondary `#A9B3C4`, tertiary `#8E99AC` |
| Buttons | primary: accent fill, 48 px pill, 15/700, glow; secondary: white 8.5 % + line 14 %, 40 px, 600; quiet: white 6 % + line 10 %; round mic 56 px |
| Controls | switch 42×26 (on: accent + glow, off: white 16 %); segmented control: white 8.5 % track, selected white 16 %; chip selected = sky glass, default = quiet |
| Type | SF Pro (system font): large title 34/700, title 20/700, message 15/1.45, secondary 13, label 11/700 caps |

Layout: sidebar (Talk · Memory · Settings, Eva's growth card at the bottom); screens put Eva large and
centred on top; Talk floats a translucent chat over Eva (video-call feel), hands-free and pause as
header pills; 8 px spacing grid.

## Eva

Eva is the conversation partner and the mascot: **Mochi** — a squishy cloud-white blob with rosy
cheeks and a smile — with a **sprout** on top that grows with speaking (see ROADMAP › Eva grows).

- Emotions: idle (blink), listening (looks at the learner), processing, thinking (glance away),
  speaking (moves with her voice), happy, encouraging, curious, concerned, asleep (paused).
- She appears on Talk, the start greeting, review, first run, message avatars and the app icon —
  never twice on one screen. Colours (body, eyes, leaves, bloom) are adjustable in Settings › Eva.
- With Reduce Motion she keeps still and only changes expression.

## Turn states

The voice visual, the microphone control and the status label always agree.

| State | Eva | Microphone control |
| :--- | :--- | :--- |
| Idle | calm | "Press to speak" / Space |
| Listening | reacts to the learner's level | level meter, Stop, Stuck |
| Auto-listen | listening + clear "Listening…" cue | prominent Cancel (Esc) |
| Transcribing | short processing cue | disabled, "Transcribing…" |
| Review & send | calm | editable text, countdown, Send now, Re-record |
| Thinking | thinking | disabled or "Speak anyway" |
| Eva speaking | moves with her voice | Interrupt |
| Paused | asleep, microphone released | Resume |
| Error | concerned | one sentence + one fix ("Retry", "Open Settings", "Switch to Apple on-device") |

While a session is active the microphone stays open (macOS orange indicator), so Pause is always
visible. A reply from the on-device backup model carries a subtle "on-device" marker.
