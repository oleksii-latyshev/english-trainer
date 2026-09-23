# Technical Requirements & Engineering Standards

This document establishes the technical stack, engineering standards, IPC contract, and external dependencies for English Trainer.

---

## 1. System Requirements & Toolchain

| Component | Target / Version | Notes |
| :--- | :--- | :--- |
| **OS** | macOS 14.0+ (Apple Silicon) | Optimized for M1/M2/M3/M4 Apple Neural Engine (ANE) |
| **Package Manager** | `bun` (>= 1.1) | Used for all frontend scripts, bundling, and tests |
| **Rust Toolchain** | `rustc` / `cargo` (>= 1.80) | `aarch64-apple-darwin` native target |
| **Tauri** | Tauri v2.x | Native desktop windowing, IPC, and security sandbox |
| **Xcode Tools** | `xcode-select --install` | Metal & CoreML compilation toolchain |
| **Model Access** | Antigravity CLI (`agy`) | Non-interactive execution via JSON schema |

---

## 2. Frontend Technology Stack

- **Runtime & Bundler:** React 19 + TypeScript + Vite with `@vitejs/plugin-react`
- **Styling:** Tailwind CSS v4 + `clsx` + `tailwind-merge`
- **UI Components:** Shadcn/ui (Radix UI primitives) + `lucide-react` icons
- **Navigation:** TanStack Router (type-safe file-based or code-based routing)
- **Data & State Management:**
  - TanStack Query (v5) for async IPC invocation caching and mutation state
  - Audio State Machine: Custom hook/Zustand store for recorder states (`idle`, `recording`, `transcribing`, `thinking`, `speaking`)
- **Audio Capture:**
  - Standard Web Audio API: `AudioContext` set to 16,000 Hz sample rate
  - Encoding: Mono 16-bit PCM WAV buffer transmitted as binary/Uint8Array to Tauri IPC
- **Audio Output (TTS):**
  - Native `window.speechSynthesis` targeting English neural voices (*Ava*, *Samantha*, *Oliver*, *Daniel*)
  - Configurable speech rate (`0.85` to `1.2`) and volume

---

## 3. Backend (Rust) Technology Stack

### 3.1 Crate Dependencies (`src-tauri/Cargo.toml`)
```toml
[dependencies]
tauri = { version = "2", features = ["tray-icon"] }
tauri-plugin-opener = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
tokio = { version = "1", features = ["full"] }
anyhow = "1"
rusqlite = { version = "0.32", features = ["bundled"] }
uuid = { version = "1", features = ["v4"] }
chrono = { version = "0.4", features = ["serde"] }

# Whisper CoreML Speech-to-Text
whisper-rs = { version = "0.13", features = ["coreml", "metal"] }
hound = "3.5" # WAV decoding
```

### 3.2 Whisper CoreML Engine Specification
- **Model:** `ggml-base.en.bin` (~142 MB) + compiled CoreML model (`ggml-base.en-encoder.mlmodelc`).
- **Storage Location:** `~/Library/Application Support/com.englishtrainer.app/models/`.
- **First-run Provisioning:** If the model is missing, the Rust backend automatically downloads the quantized model from HuggingFace with progress events streamed to the UI.
- **Inference Performance:** ~120–180ms on M1 Pro ANE for 5-second voice segments.

---

## 4. Antigravity CLI (`agy`) Contract & JSON Schemas

### 4.1 Invocation Protocol
All calls to `agy` follow the strict sandbox isolation pattern:
1. Rust creates a temporary directory in `/tmp/eng-trainer-agy-{uuid}`.
2. Writes the target JSON schema to `/tmp/eng-trainer-agy-{uuid}/schema.json`.
3. Spawns `agy` with:
   ```bash
   agy --print "<PROMPT>" \
       --model gemini-3.8-flash-medium \
       --output-format json \
       --json-schema /tmp/eng-trainer-agy-{uuid}/schema.json \
       --print-timeout 45s
   ```
4. Parses the final JSON envelope from stdout and deserializes into typed Rust structs.
5. Deletes the scratch directory immediately upon completion.

### 4.2 Interview Turn Schema (`schema_interview_turn.json`)
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["spoken_reply", "coaching", "scaffolding", "interview_progress"],
  "properties": {
    "spoken_reply": {
      "type": "string",
      "description": "What the interviewer speaks out loud to the candidate."
    },
    "coaching": {
      "type": "object",
      "required": ["grammar_corrections", "b2_upgrades", "slavicisms_detected"],
      "properties": {
        "grammar_corrections": {
          "type": "array",
          "items": {
            "type": "object",
            "required": ["original", "corrected", "explanation"],
            "properties": {
              "original": { "type": "string" },
              "corrected": { "type": "string" },
              "explanation": { "type": "string" }
            }
          }
        },
        "b2_upgrades": {
          "type": "array",
          "items": {
            "type": "object",
            "required": ["b1_phrase", "b2_alternative", "reason"],
            "properties": {
              "b1_phrase": { "type": "string" },
              "b2_alternative": { "type": "string" },
              "reason": { "type": "string" }
            }
          }
        },
        "slavicisms_detected": {
          "type": "array",
          "items": { "type": "string" }
        }
      }
    },
    "scaffolding": {
      "type": "object",
      "required": ["sentence_starters", "recommended_vocab", "star_step_focus"],
      "properties": {
        "sentence_starters": {
          "type": "array",
          "items": { "type": "string" },
          "description": "2-3 conversational openings to help user start speaking without freezing"
        },
        "recommended_vocab": {
          "type": "array",
          "items": { "type": "string" }
        },
        "star_step_focus": {
          "type": "string",
          "enum": ["Situation", "Task", "Action", "Result", "General"]
        }
      }
    },
    "interview_progress": {
      "type": "object",
      "required": ["phase", "overall_score_out_of_10", "is_complete"],
      "properties": {
        "phase": { "type": "string" },
        "overall_score_out_of_10": { "type": "number" },
        "is_complete": { "type": "boolean" }
      }
    }
  }
}
```

---

## 5. Tauri IPC API Specification

| Command Name | Input Arguments | Return Type | Description |
| :--- | :--- | :--- | :--- |
| `transcribe_audio` | `{ wav_bytes: Vec<u8> }` | `Result<String, String>` | Transcribes audio using Whisper CoreML on ANE |
| `start_interview` | `{ role: InterviewRole, difficulty: String }` | `Result<InterviewTurn, String>` | Starts a mock session, returns opening question & hints |
| `send_interview_turn` | `{ session_id: String, transcript: String }` | `Result<InterviewTurn, String>` | Sends user reply, returns interviewer response & feedback |
| `generate_drill` | `{ category: DrillCategory }` | `Result<DrillPayload, String>` | Creates dynamic exercises adapted to user's mistake vault |
| `get_mistake_vault` | `{ limit: u32, category: Option<String> }` | `Result<Vec<MistakeRecord>, String>` | Fetches recurring grammar and vocabulary weak points |
| `get_system_voices` | None | `Result<Vec<VoiceInfo>, String>` | Lists available macOS speech synthesis voices |

---

## 6. Code Quality Standards (from `grind-test`)

1. **Strict File Limits:** Maximum 300 lines per file (enforced for both TypeScript and Rust).
2. **Clear Boundaries:** Rust owns all model calls, audio processing, and local database operations; TypeScript only handles presentation, audio input stream capture, and TTS playback.
3. **Zero `any`:** Strict TypeScript typing matching Rust `serde` structs.
4. **Resilience:** Automatic fallback to system PATH if `ENG_TRAINER_AGY_BIN` is unspecified; retry mechanism for CLI invocations.
