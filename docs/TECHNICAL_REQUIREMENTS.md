# Technical Requirements & Engineering Standards

This document defines the technical stack, engineering standards, provider boundaries, IPC contracts, local persistence model, macOS integration, and performance requirements for English Trainer.

---

## 1. System Requirements & Toolchain

| Component | Target / Version | Notes |
| :--- | :--- | :--- |
| **OS** | macOS 14.0+ | Apple Silicon first |
| **CPU** | Apple Silicon | M1 and newer |
| **Package Manager** | `bun` >= 1.1 | Frontend scripts and dependencies |
| **Rust Toolchain** | stable Rust >= 1.80 | `aarch64-apple-darwin` |
| **Tauri** | Tauri v2.x | Desktop runtime, IPC, tray, windows |
| **Xcode Tools** | Current compatible Xcode CLI tools | Metal / native build requirements |
| **Local DB** | SQLite | Application state and learning history |
| **Initial LLM Access** | Antigravity CLI (`agy`) | Adapter behind provider interfaces |

The application is macOS-first. Cross-platform support is not an MVP requirement.

---

## 2. Frontend Technology Stack

### 2.1 Core Stack

- React 19;
- TypeScript with strict mode;
- Vite;
- Bun;
- Tailwind CSS v4;
- Shadcn/ui + Radix primitives;
- Lucide React;
- TanStack Router;
- TanStack Query for async command state;
- Zustand or a small explicit state machine for audio/session UI state.

### 2.2 Main Frontend Routes

```text
/                 Dashboard / Daily Practice
/conversation     Fluency-oriented conversation
/rehearsal        Coach mode / re-speaking
/interview        Interview packs
/drills           Focused skill builders
/memory           Learning Memory
/progress         Benchmarks and trends
/settings         Audio, providers, ambient mode, privacy
```

### 2.3 Secondary Window

A compact window is required for Ambient Practice.

Suggested states:

```text
idle
prompt
recording
transcribing
thinking
speaking
feedback
complete
error
```

It should be possible to open this window without showing the full dashboard.

---

## 3. Audio Capture

### 3.1 Input

MVP recording model:

- Push-to-Talk;
- Web Audio API;
- mono input;
- 16-bit PCM;
- target sample rate appropriate for the selected STT engine, with 16 kHz as the default normalization rate;
- in-memory buffer by default.

The implementation must not rely on `MediaRecorder` producing a specific PCM/WAV format across WebKit versions. Prefer explicit PCM capture/encoding through Web Audio / AudioWorklet when deterministic input is required.

### 3.2 Raw Audio Retention

Default:

```text
record → transcribe → extract local metrics → discard raw audio
```

Optional future setting:

```text
Retain recordings for pronunciation / manual review
```

The setting is off by default.

### 3.3 VAD

VAD is not required for the first working speaking loop.

Later VAD requirements:

- tolerate B1 thinking pauses;
- expose configurable endpoint thresholds;
- allow manual override / Push-to-Talk fallback;
- never automatically submit on every short hesitation.

---

## 4. Speech-to-Text Provider

### 4.1 Provider Interface

Rust core should depend on an abstraction similar to:

```rust
#[async_trait]
pub trait SpeechToTextProvider: Send + Sync {
    async fn transcribe(&self, request: TranscriptionRequest)
        -> anyhow::Result<Transcript>;
}
```

Suggested response:

```rust
pub struct Transcript {
    pub text: String,
    pub language: String,
    pub duration_ms: u64,
    pub segments: Vec<TranscriptSegment>,
}
```

### 4.2 Initial Local Provider

Initial implementation:

```text
LocalWhisperProvider
```

Candidate model for the first prototype:

```text
English-only base-class Whisper model
```

Exact model and quantization are benchmark decisions, not permanent product contracts.

### 4.3 Metal / CoreML Validation Spike

Do not hardcode an assumption that `whisper-rs` exposes a `coreml` Cargo feature.

Required engineering spike:

1. build the selected current whisper-rs / whisper.cpp integration on the target macOS version;
2. verify Metal inference;
3. verify whether CoreML / ANE encoder acceleration is available through the selected binding/build path;
4. benchmark 2 s, 5 s, 15 s, and 30 s speech samples;
5. record memory usage and model-load time;
6. choose the production build configuration from measured results.

Metal support is the safe baseline. CoreML/ANE acceleration is an optimization to validate.

### 4.4 Model Provisioning

Models are stored under the app support directory, for example:

```text
~/Library/Application Support/com.englishtrainer.app/models/
```

Requirements:

- first-run model check;
- explicit download progress;
- checksum validation;
- retry / resume strategy where practical;
- model selection in advanced settings;
- no application crash when model files are missing.

---

## 5. Text-to-Speech

### 5.1 MVP Provider

Use system speech synthesis exposed through the macOS WebView where reliable.

Requirements:

- discover available voices at runtime;
- prefer English voices;
- do not assume a named voice always exists;
- configurable speech rate;
- pause / stop / replay;
- interrupt previous speech when a new turn begins if required.

Suggested speech rate range:

```text
0.85x – 1.20x
```

### 5.2 Provider Boundary

```rust
pub trait TextToSpeechProvider {
    // Frontend-backed implementation may use an IPC/event boundary.
}
```

The domain model should refer to a TTS capability rather than to specific voice names.

---

## 6. LLM Provider Architecture

### 6.1 Rule

No domain or learning module may call `agy` directly.

All model access goes through provider interfaces.

### 6.2 Conversation Engine

Purpose:

- keep dialogue natural;
- ask follow-up questions;
- follow scenario constraints;
- produce short text intended for TTS;
- maintain low latency.

Suggested contract:

```rust
#[async_trait]
pub trait ConversationEngine: Send + Sync {
    async fn start_session(&self, request: StartSessionRequest)
        -> anyhow::Result<ConversationTurn>;

    async fn next_turn(&self, request: ConversationRequest)
        -> anyhow::Result<ConversationTurn>;
}
```

### 6.3 Feedback Engine

Purpose:

- grammar analysis;
- B1 → B2 upgrades;
- collocations;
- coherence evidence;
- learning-target extraction;
- benchmark evaluation;
- first-attempt vs re-speaking comparison.

```rust
#[async_trait]
pub trait FeedbackEngine: Send + Sync {
    async fn evaluate_turn(&self, request: FeedbackRequest)
        -> anyhow::Result<TurnFeedback>;

    async fn compare_attempts(&self, request: AttemptComparisonRequest)
        -> anyhow::Result<AttemptComparison>;

    async fn evaluate_benchmark(&self, request: BenchmarkRequest)
        -> anyhow::Result<BenchmarkEvaluation>;
}
```

### 6.4 Initial Antigravity Adapters

```text
AntigravityConversationProvider
AntigravityFeedbackProvider
```

Both may share low-level execution infrastructure.

Model names are configuration values, not types embedded throughout the codebase.

Suggested settings:

```text
conversation_model
feedback_model
benchmark_model
```

The same model may initially be used for all three.

---

## 7. Antigravity CLI Execution Contract

### 7.1 Isolation

Each invocation runs in a dedicated temporary directory:

```text
/tmp/eng-trainer-agy-{uuid}/
```

The execution wrapper should:

1. create scratch directory;
2. write required schema/input files;
3. execute `agy` non-interactively;
4. capture stdout/stderr;
5. parse the final valid structured payload;
6. map it into typed Rust structs;
7. delete temporary files.

### 7.2 Binary Resolution

Resolution order:

1. explicit application setting;
2. `ENG_TRAINER_AGY_BIN` environment variable;
3. system `PATH`;
4. common local paths such as `~/.local/bin`, `/opt/homebrew/bin`, `/usr/local/bin`.

### 7.3 Resilience

Required:

- timeout;
- cancellation where practical;
- provider health check;
- typed error categories;
- one bounded retry for transient parse/process failure when safe;
- preserve conversation session if feedback evaluation fails.

### 7.4 Structured Output

All machine-consumed responses use JSON schema or equivalent strict structured output.

Never parse prose with fragile string matching when a typed field can be required.

---

## 8. Structured Schemas

### 8.1 Conversation Turn

Keep the fast conversation schema intentionally small:

```json
{
  "spoken_reply": "string",
  "question": "string | null",
  "session_phase": "string",
  "is_complete": false
}
```

Scaffolding may be generated separately or as a small optional object when the active mode requires it.

### 8.2 Turn Feedback

Suggested shape:

```json
{
  "focus_feedback": [
    {
      "category": "grammar | vocabulary | coherence | interaction",
      "original": "string",
      "improved": "string",
      "explanation": "string",
      "priority": "low | medium | high",
      "confidence": 0.0
    }
  ],
  "b2_upgrades": [],
  "useful_phrases": [],
  "mistake_candidates": [],
  "dimension_evidence": {
    "accuracy": [],
    "range": [],
    "coherence": [],
    "interaction": []
  }
}
```

Fluency should incorporate locally measured speech timing rather than relying only on the LLM.

### 8.3 Attempt Comparison

```json
{
  "target_fixed": true,
  "improvements": [],
  "remaining_issue": "string | null",
  "recommended_next_action": "accept | retry | save_phrase"
}
```

### 8.4 Benchmark Evaluation

The benchmark schema must return:

- evidence per speaking dimension;
- strengths;
- weaknesses;
- uncertainty / confidence;
- examples from the transcript;
- no unsupported claim that the result is an official CEFR certification.

---

## 9. Local Speech Metrics

The app should compute as much as possible deterministically on-device.

Candidate metrics:

```text
recording_duration_ms
speech_duration_ms
silence_duration_ms
speech_pause_ratio
response_start_latency_ms
long_pause_count
long_pause_duration_ms
words_per_minute
filler_count
filler_rate_per_minute
```

Definitions must be versioned once benchmarks are introduced so historical trends remain comparable.

### 9.1 Fluency Aggregation

Do not infer Fluency from words-per-minute alone.

A fluent B2 response may intentionally contain pauses.

Use a combination of:

- response-start behavior;
- disruptive long pauses;
- filler density;
- continuity;
- successful turn completion;
- benchmark evidence.

---

## 10. Learning Engine

### 10.1 Responsibilities

The Rust learning module owns:

- mistake normalization;
- duplicate detection;
- phrase cards;
- spaced review scheduling;
- mastery state transitions;
- session target selection;
- benchmark trend aggregation;
- Mini Eva XP events derived from real learning events.

### 10.2 Learning Status

Suggested statuses:

```text
new
learning
improving
stable
archived
```

### 10.3 Scheduling

A simplified SM-2-like algorithm can be used initially for phrase/mistake recall.

Do not use the same scheduling model for every signal. For example, a fluency issue such as long pauses should be trained through speaking sessions rather than flashcard review.

---

## 11. SQLite Data Model

Recommended tables:

### 11.1 `sessions`

```text
id
mode
scenario
started_at
ended_at
conversation_provider
feedback_provider
speaking_seconds
metadata_json
```

### 11.2 `turns`

```text
id
session_id
sequence
user_transcript
assistant_reply
created_at
attempt_group_id
is_retry
```

### 11.3 `speech_metrics`

```text
turn_id
recording_duration_ms
speech_duration_ms
silence_duration_ms
response_start_latency_ms
long_pause_count
filler_count
words_per_minute
metrics_version
```

### 11.4 `mistakes`

```text
id
normalized_key
category
original_example
corrected_example
severity
confidence
times_seen
times_correct_afterwards
last_seen_at
next_review_at
status
```

### 11.5 `phrase_cards`

```text
id
phrase
meaning_or_note
source_turn_id
created_at
next_review_at
stability
status
```

### 11.6 `review_events`

```text
id
item_type
item_id
result
created_at
```

### 11.7 `benchmarks`

```text
id
started_at
completed_at
benchmark_version
```

### 11.8 `benchmark_dimension_results`

```text
benchmark_id
dimension
internal_score
confidence
evidence_json
```

### 11.9 `ambient_quests`

```text
id
type
prompt
learning_target_id
scheduled_for
status
created_at
```

### 11.10 `quest_events`

```text
quest_id
event_type
created_at
metadata_json
```

### 11.11 `companion_state`

```text
singleton_id
level
xp
expression
active_theme
last_interaction_at
state_json
```

### 11.12 `settings`

Key/value or typed settings store containing:

- audio preferences;
- provider configuration;
- retention preferences;
- ambient frequency;
- quiet hours;
- autostart;
- notification preferences.

---

## 12. macOS Ambient Integration

### 12.1 Tauri Plugins / Capabilities

Expected desktop capabilities:

- tray icon;
- `tauri-plugin-notification`;
- `tauri-plugin-autostart`;
- optional global shortcut plugin;
- optional positioner/window positioning support;
- single-instance handling.

### 12.2 Menu Bar / Tray

The tray icon provides low-friction access while the main window is hidden.

MVP actions:

```text
Speak now
Give me a quest
Review one phrase
Pause prompts today
Open English Trainer
Quit
```

A rich Mini Eva UI should open in a compact Tauri window rather than depend on a native Swift menu implementation.

### 12.3 Autostart

Autostart is optional.

Requirements:

- disabled until explicitly enabled by the user;
- visible toggle in Settings;
- app can start with main window hidden and tray active;
- user can disable it at any time.

### 12.4 Local Notifications

Requirements:

- permission requested only when Ambient Mode is enabled;
- configurable daily maximum;
- quiet hours;
- no aggressive repeating prompt after dismissal;
- clicking a quest should open an appropriate compact/main app route.

Local notification scheduling should be used for reminders that must still be delivered when the app is not actively open.

### 12.5 WidgetKit — Future Native Extension

A future WidgetKit target can show glanceable state on macOS.

Implementation expectations:

- separate native Swift extension target;
- shared read-only app-group-compatible state or exported snapshot;
- deep links back into English Trainer;
- no dependency on the widget for core learning flows.

WidgetKit is explicitly outside the MVP critical path.

---

## 13. Mini Eva / Gamification Requirements

### 13.1 Rule

Game state is downstream from learning events.

Example:

```text
Successful phrase recall
  → Learning Engine records review success
  → GamificationService awards XP
  → Companion state updates
```

Never:

```text
Companion level increased
  → language score increases
```

### 13.2 XP Sources

Good XP sources:

- completed speaking answer;
- successful re-speaking improvement;
- phrase recall;
- finished benchmark;
- mistake moved to `stable`;
- optional micro-quest.

Avoid awarding meaningful progress merely for opening the app.

### 13.3 No Punitive Decay

No pet death, lost levels, or deleted streak progress because the user missed a day.

---

## 14. IPC API

Suggested Tauri command surface:

| Command | Input | Return | Purpose |
| :--- | :--- | :--- | :--- |
| `transcribe_audio` | audio payload | `Transcript` | Local STT |
| `start_session` | mode + scenario | `SessionState` | Create speaking session |
| `send_turn` | session + audio/transcript | `ConversationTurn` | Fast conversation path |
| `get_turn_feedback` | turn id | `TurnFeedback` | Fetch/evaluate coaching data |
| `retry_turn` | turn id + audio | `AttemptComparison` | Re-speaking comparison |
| `finish_session` | session id | `SessionSummary` | Close and aggregate session |
| `get_daily_practice` | optional goal | `PracticePlan` | Build short daily session |
| `get_learning_memory` | filters | records | Mistakes and phrase cards |
| `submit_review` | item + response | result | SRS review event |
| `start_benchmark` | version | benchmark session | Progress assessment |
| `get_progress` | range | trend data | Dashboard metrics |
| `get_next_micro_quest` | optional category | quest | Ambient practice |
| `complete_micro_quest` | quest + result | completion | Save quest result |
| `get_companion_state` | none | state | Mini Eva UI |
| `get_system_voices` | none | voices | TTS settings |
| `get_provider_health` | none | health report | Diagnostics |

Exact API names may evolve, but responsibilities should stay separated.

---

## 15. Latency Requirements

The most important metric is:

```text
end_of_user_speech → beginning_of_ai_audio
```

Development target:

```text
p50 < 1.5 s
p95 < 3.0 s
```

Measure components independently:

```text
capture finalization
STT
conversation provider
IPC/render
TTS start
```

The targets must be validated on target M1-class hardware.

Deep feedback is not included in the critical conversation latency budget.

---

## 16. Benchmark & Score Requirements

### 16.1 CEFR-Inspired, Not CEFR-Certified

The application can maintain internal trend scores for:

- Fluency;
- Accuracy;
- Range;
- Coherence;
- Interaction.

UI copy must not imply official certification.

### 16.2 Evidence Requirement

Every benchmark dimension result should contain supporting evidence.

The UI should be able to answer:

> Why did this dimension improve or decline?

Examples:

- fewer disruptive pauses;
- successful use of target collocations;
- recurring preposition error still present;
- stronger answer structure;
- improved handling of follow-ups.

### 16.3 Versioning

Store:

```text
benchmark_version
metrics_version
prompt_version
```

when necessary to avoid comparing incompatible historical measurements silently.

---

## 17. Privacy & Permissions

### 17.1 Required / Expected

- microphone permission.

### 17.2 Optional

- notifications, only for Ambient Mode;
- launch-at-login, only when enabled by user.

### 17.3 Not Required for MVP

- Screen Recording;
- Accessibility access;
- active-application monitoring;
- contacts/calendar access;
- privileged daemon installation.

The prompt “What are you working on?” does not imply that the application knows what is on screen.

---

## 18. Error Handling

Use typed errors internally.

Suggested categories:

```text
AudioCaptureError
TranscriptionError
ProviderUnavailable
ProviderTimeout
InvalidStructuredResponse
DatabaseError
PermissionDenied
ModelMissing
NotificationUnavailable
```

Requirements:

- never panic on model/provider output;
- user-readable errors must include a recovery action where possible;
- feedback failure must not destroy a conversation session;
- local history writes should be transactional around critical state changes.

---

## 19. Code Quality Standards

1. **Strict TypeScript:** no unbounded `any` in application code.
2. **Typed Rust domain models:** provider output maps to typed structs.
3. **Small modules:** target <= 300 lines per code file; split by responsibility when complexity grows.
4. **Provider boundaries:** model-specific code stays inside adapters.
5. **No UI business logic:** learning/mastery rules live in Rust/domain modules.
6. **No silent fallback that changes learning semantics:** surface provider degradation explicitly.
7. **Test deterministic logic first:** Learning Engine, scheduling, DB repositories, schema parsing, metrics, state transitions.
8. **Do not block feature delivery on exhaustive UI tests:** test depth can scale with product maturity.

---

## 20. Test Strategy

### 20.1 Required Early Tests

Prioritize tests for logic that is cheap to test and expensive to debug manually:

- schema parsing;
- DB migrations;
- mistake deduplication;
- phrase review scheduling;
- mastery state transitions;
- ambient scheduler quiet-hour rules;
- companion XP rules;
- prompt selection constraints;
- provider timeout/error mapping.

### 20.2 Integration Tests

Add targeted integration tests for:

```text
audio fixture → STT
structured fixture → Feedback Engine parsing
turn → Learning Memory update
retry attempt → mastery update
micro-quest → completion → XP event
```

### 20.3 Manual Product Benchmarks

Maintain a small local fixture set of real B1-style recordings to compare:

- transcription quality;
- inference time;
- long-pause metrics;
- model build changes.

---

## 21. Definition of Done — Technical

A milestone is technically complete when relevant requirements are met:

1. main speaking flow works without cloud STT;
2. Push-to-Talk is reliable;
3. conversation can continue even if feedback analysis fails;
4. provider responses deserialize without application crashes;
5. Learning Memory persists and can be queried;
6. re-speaking updates mastery evidence;
7. raw audio is not persisted by default;
8. latency metrics are observable;
9. menu-bar quick launch works before Ambient Mode is considered complete;
10. proactive notifications respect explicit opt-in and quiet hours;
11. gamification cannot mutate language scores;
12. benchmark scores retain evidence and version information.
