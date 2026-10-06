# English Trainer — spoken English practice for macOS

A desktop app for practising **speaking** English: a voice conversation with an AI partner that
answers quickly, helps you structure an answer while you speak, and keeps the phrases worth
remembering. Reading and listening are assumed to be strong already; this app trains the part that
gets the least practice.

```text
AI asks → plan (optional help) → speak → AI replies quickly
        → natural rephrasing of what you meant → say it again
        → useful phrases come back in later sessions
```

Status: personal alpha. Conversation, Coach and Learning Memory work; the roadmap focuses on a
fast streaming voice conversation and answer-structuring help. See [ROADMAP](docs/ROADMAP.md).

## Stack

- **Desktop:** Tauri v2 (macOS 14+, Apple Silicon)
- **Frontend:** React 19, TypeScript, Vite, Bun, Tailwind CSS v4, HeroUI, TanStack Router
- **Core:** Rust, SQLite
- **Speech recognition:** local Whisper (`whisper.cpp`)
- **Speech output:** macOS system voices
- **AI:** Apple Foundation Models (on-device) and the Gemini API as target real-time providers;
  Antigravity CLI (`agy`) as the current legacy adapter

## Privacy

- Speech is transcribed locally; raw audio is discarded after transcription.
- History and Learning Memory are stored locally in SQLite.
- Only the transcript and minimal context are sent to the selected AI provider.
- No screen monitoring, Accessibility or Screen Recording permission.

## Development

```bash
bun install
bun run dev
```

`bun run dev` opens the Tauri desktop app with Vite hot reload. Use `bun run dev:web`
only when you want to inspect the frontend in a browser; native Tauri commands are
available in the desktop app.

### Installable personal alpha

Run `bun run build:desktop` to create an Apple Silicon macOS app and DMG.
See [Personal Alpha setup](docs/PERSONAL_ALPHA.md) for installation, prerequisites,
CI artifacts, and first-session checks.

### Checks before committing

`bun install` installs the Lefthook pre-commit hook. It checks the whole frontend
with Biome, TypeScript, and unit tests, and runs Rust formatting, Clippy with
warnings treated as errors, and Rust tests. These match the CI checks. The hook
does not auto-edit or stage files; use `bun run check:fix` to fix formatting.

Run `bunx lefthook run pre-commit --force` to check manually, or `bunx lefthook install`
to reinstall the hook in an existing checkout. `bun run check:rust` uses the same
Rust checks as CI. On macOS it uses Command Line Tools when installed and
`DEVELOPER_DIR` is unset, without changing the system Xcode selection.

### Local transcription setup

The current Whisper prototype uses a local `whisper-cli` executable and an English `base.en`
model. On a new Mac, install the CLI and place the model in the app data directory:

```bash
brew install whisper.cpp
mkdir -p "$HOME/Library/Application Support/com.user.english-trainer/models"
curl -fL https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin \
  -o "$HOME/Library/Application Support/com.user.english-trainer/models/ggml-base.en.bin"
shasum -a 1 "$HOME/Library/Application Support/com.user.english-trainer/models/ggml-base.en.bin"
```

The expected SHA-1 is `137c40403d78fd54d454da0f9bd998f78703390c`. Set
`ENG_TRAINER_WHISPER_BIN` or `ENG_TRAINER_WHISPER_MODEL` before `bun run dev` to use other
local paths. Automatic model provisioning is planned for a later phase.

## Documentation

- [`docs/ROADMAP.md`](docs/ROADMAP.md) — current priorities, MVP features (one feature per commit), decisions.
- [`docs/PRODUCT_SPEC.md`](docs/PRODUCT_SPEC.md) — what the app does and how practice should feel.
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — runtime structure, current vs target.
- [`docs/TECHNICAL_REQUIREMENTS.md`](docs/TECHNICAL_REQUIREMENTS.md) — contracts: audio, STT, providers, IPC, persistence, learning rules.
- [`CODE_REQUIREMENTS.md`](CODE_REQUIREMENTS.md) — coding conventions.
- [`docs/PERSONAL_ALPHA.md`](docs/PERSONAL_ALPHA.md) — install and set up a local build.
- [`docs/PERSONAL_ALPHA_FEEDBACK.md`](docs/PERSONAL_ALPHA_FEEDBACK.md) — dated log of real-use feedback and investigations.
- [`docs/ui/`](docs/ui/) — early design references and HTML prototypes; not implementation requirements.
